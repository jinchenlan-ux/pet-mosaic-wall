import { useState, useCallback, useRef } from 'react'
import type { TileColorResult } from '../workers/mosaic.worker'
import {
  loadImage,
  resizeForAnalysis,
  getImageData,
  pixelateImage,
  getPixelColors,
  extractForeground,
  computeGridMaskWeights,
  resizeImage,
} from '../utils/imageUtils'

// 浏览器 canvas 安全像素上限 ~16M，留余量取 14M
const MAX_CANVAS_PIXELS = 14_000_000
const IDEAL_HD_CELL = 80

export interface MosaicState {
  status: 'idle' | 'segmenting' | 'analyzing' | 'matching' | 'rendering' | 'done' | 'exporting'
  progress: number
  message: string
}

interface UseMosaicOptions {
  gridSize: number
  tintOpacity: number
  edgeFeather: number
}

export function useMosaic(options: UseMosaicOptions) {
  const { gridSize, tintOpacity, edgeFeather } = options
  const [state, setState] = useState<MosaicState>({
    status: 'idle',
    progress: 0,
    message: '',
  })

  const workerRef = useRef<Worker | null>(null)
  const tileCanvasesRef = useRef<HTMLCanvasElement[]>([])
  const tileImagesRef = useRef<HTMLImageElement[]>([])
  const gridColorsRef = useRef<[number, number, number][]>([])
  const gridAssignRef = useRef<number[]>([])
  const gridWeightsRef = useRef<Float32Array>(new Float32Array(0))
  const gridDimsRef = useRef<{ cols: number; rows: number; w: number; h: number }>({ cols: 0, rows: 0, w: 0, h: 0 })

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/mosaic.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  function sendAndWait<T>(worker: Worker, message: unknown, responseType: string): Promise<T> {
    return new Promise<T>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === responseType) {
          worker.removeEventListener('message', handler)
          resolve(e.data.results ?? e.data.matches)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage(message)
    })
  }

  function euclideanDist(a: [number, number, number], b: [number, number, number]): number {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]
    return dr * dr + dg * dg + db * db
  }

  const generateMosaic = useCallback(
    async (
      tileFiles: File[],
      targetFile: File,
      previewCanvas: HTMLCanvasElement
    ) => {
      const worker = getWorker()

      try {
        setState({ status: 'segmenting', progress: 2, message: '正在抠图，首次加载模型约需 10-20 秒...' })

        const fgImg = await extractForeground(
          targetFile,
          (msg) => setState((s) => ({ ...s, message: msg }))
        )

        setState({ status: 'analyzing', progress: 25, message: '正在像素化...' })

        const cols = Math.ceil(fgImg.width / gridSize)
        const rows = Math.ceil(fgImg.height / gridSize)
        const targetW = cols * gridSize
        const targetH = rows * gridSize
        gridDimsRef.current = { cols, rows, w: targetW, h: targetH }

        const pixelCanvas = pixelateImage(fgImg, cols, rows)
        const pixelColors = getPixelColors(pixelCanvas)
        gridColorsRef.current = pixelColors

        setState({ status: 'analyzing', progress: 30, message: '正在计算边界权重...' })

        const weights = computeGridMaskWeights(fgImg, cols, rows, targetW, targetH, edgeFeather)
        gridWeightsRef.current = weights

        setState({ status: 'analyzing', progress: 35, message: '正在加载素材照片...' })

        const tileImages = await Promise.all(tileFiles.map((f) => loadImage(f)))
        tileImagesRef.current = tileImages
        const tileSmall = tileImages.map((img) => resizeForAnalysis(img))

        tileCanvasesRef.current = tileImages.map((img) =>
          resizeImage(img, gridSize, gridSize)
        )

        setState({ status: 'analyzing', progress: 50, message: '正在分析素材颜色...' })

        const tiles = tileSmall.map((canvas, i) => {
          const data = getImageData(canvas)
          return { index: i, data: Array.from(data.data), width: 100, height: 100 }
        })

        const tileColorResults = await sendAndWait<TileColorResult[]>(
          worker,
          { type: 'computeTileColors', tiles },
          'tileColorsResult'
        )

        setState({ status: 'matching', progress: 65, message: '正在匹配颜色...' })

        const totalCells = cols * rows
        const assigned: number[] = new Array(totalCells)
        const TOP_N = Math.min(5, tileColorResults.length)

        for (let i = 0; i < totalCells; i++) {
          if (weights[i] < 0.05) {
            assigned[i] = -1
            continue
          }

          const targetColor = pixelColors[i]
          const candidates: { idx: number; dist: number }[] = []
          for (const tile of tileColorResults) {
            candidates.push({ idx: tile.index, dist: euclideanDist(targetColor, tile.avgColor) })
          }
          candidates.sort((a, b) => a.dist - b.dist)
          // 从 top-N 中随机选一个，避免大面积重复同一张
          assigned[i] = candidates[Math.min(Math.floor(Math.random() * TOP_N), candidates.length - 1)].idx
        }

        gridAssignRef.current = assigned

        setState({ status: 'rendering', progress: 85, message: '正在渲染马赛克...' })

        renderSync(previewCanvas, tileCanvasesRef.current, gridSize)

        setState({ status: 'done', progress: 100, message: '马赛克生成完成!' })
      } catch (err) {
        console.error('Mosaic generation failed:', err)
        setState({ status: 'idle', progress: 0, message: '生成失败，请重试' })
      }
    },
    [getWorker, gridSize, tintOpacity, edgeFeather]
  )

  const renderSync = useCallback(
    (canvas: HTMLCanvasElement, tileSources: HTMLCanvasElement[], cellPx: number) => {
      const { cols, rows } = gridDimsRef.current

      canvas.width = cols * cellPx
      canvas.height = rows * cellPx
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const assigned = gridAssignRef.current
      const colors = gridColorsRef.current
      const weights = gridWeightsRef.current

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col
          if (assigned[idx] === -1) continue

          const weight = weights[idx]
          if (weight < 0.05) continue

          const dx = col * cellPx
          const dy = row * cellPx

          ctx.globalAlpha = weight
          const src = tileSources[assigned[idx]]
          if (src) {
            ctx.drawImage(src, dx, dy, cellPx, cellPx)
          }

          if (tintOpacity > 0 && colors[idx]) {
            const [r, g, b] = colors[idx]
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tintOpacity * weight})`
            ctx.fillRect(dx, dy, cellPx, cellPx)
          }

          ctx.globalAlpha = 1.0
        }
      }
    },
    [tintOpacity]
  )

  function computeSafeHdCellSize(cols: number, rows: number): number {
    const maxCell = Math.floor(Math.sqrt(MAX_CANVAS_PIXELS / (cols * rows)))
    return Math.max(gridSize, Math.min(IDEAL_HD_CELL, maxCell))
  }

  const exportHD = useCallback(
    async (petName: string, onProgress?: (p: number) => void) => {
      if (gridAssignRef.current.length === 0) return null

      setState({ status: 'exporting', progress: 0, message: '正在生成高清大图...' })
      onProgress?.(5)

      const { cols, rows } = gridDimsRef.current
      const hdCell = computeSafeHdCellSize(cols, rows)

      setState((s) => ({ ...s, message: `正在生成高清大图 (${cols * hdCell}x${rows * hdCell})...` }))
      onProgress?.(10)
      await new Promise((r) => setTimeout(r, 0))

      const hdTiles = tileImagesRef.current.map((img) =>
        resizeImage(img, hdCell, hdCell)
      )

      onProgress?.(20)
      await new Promise((r) => setTimeout(r, 0))

      const hdCanvas = document.createElement('canvas')
      hdCanvas.width = cols * hdCell
      hdCanvas.height = rows * hdCell
      const ctx = hdCanvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const assigned = gridAssignRef.current
      const colors = gridColorsRef.current
      const weights = gridWeightsRef.current
      const total = cols * rows
      const BATCH = 500

      for (let i = 0; i < total; i++) {
        if (assigned[i] === -1) continue
        const weight = weights[i]
        if (weight < 0.05) continue

        const col = i % cols
        const row = Math.floor(i / cols)
        const dx = col * hdCell
        const dy = row * hdCell

        ctx.globalAlpha = weight
        const src = hdTiles[assigned[i]]
        if (src) ctx.drawImage(src, dx, dy, hdCell, hdCell)

        if (tintOpacity > 0 && colors[i]) {
          const [r, g, b] = colors[i]
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tintOpacity * weight})`
          ctx.fillRect(dx, dy, hdCell, hdCell)
        }
        ctx.globalAlpha = 1.0

        if (i % BATCH === 0) {
          onProgress?.(20 + Math.round((i / total) * 55))
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      onProgress?.(80)
      await new Promise((r) => setTimeout(r, 0))

      const watermarkText = `Created by ${petName || 'Pet'}'s Moments`
      const fontSize = Math.max(16, Math.round(hdCanvas.width / 60))
      ctx.font = `${fontSize}px 'Inter', sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.fillText(watermarkText, hdCanvas.width - 20, hdCanvas.height - 15)

      onProgress?.(90)
      await new Promise((r) => setTimeout(r, 0))

      const blob = await new Promise<Blob | null>((resolve) => {
        hdCanvas.toBlob(resolve, 'image/png')
      })

      onProgress?.(100)
      setState({ status: 'done', progress: 100, message: '导出完成!' })

      return blob
    },
    [gridSize, tintOpacity]
  )

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, message: '' })
    tileCanvasesRef.current = []
    tileImagesRef.current = []
    gridColorsRef.current = []
    gridAssignRef.current = []
    gridWeightsRef.current = new Float32Array(0)
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  return {
    state,
    generateMosaic,
    exportHD,
    reset,
  }
}
