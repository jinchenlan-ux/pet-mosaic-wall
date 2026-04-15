import { removeBackground } from '@imgly/background-removal'

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image: ${file.name}`))
    }
    img.src = url
  })
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load blob image'))
    }
    img.src = url
  })
}

export function resizeImage(
  img: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function resizeForAnalysis(img: HTMLImageElement): HTMLCanvasElement {
  return resizeImage(img, 100, 100)
}

export function pixelateImage(
  img: HTMLImageElement,
  cols: number,
  rows: number,
): HTMLCanvasElement {
  const tiny = document.createElement('canvas')
  tiny.width = cols
  tiny.height = rows
  const tCtx = tiny.getContext('2d')!
  tCtx.imageSmoothingEnabled = true
  tCtx.drawImage(img, 0, 0, cols, rows)
  return tiny
}

export function getPixelColors(
  pixelCanvas: HTMLCanvasElement
): [number, number, number][] {
  const ctx = pixelCanvas.getContext('2d')!
  const data = ctx.getImageData(0, 0, pixelCanvas.width, pixelCanvas.height).data
  const colors: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) {
    colors.push([data[i], data[i + 1], data[i + 2]])
  }
  return colors
}

export async function extractForeground(
  file: File,
  onProgress?: (msg: string) => void
): Promise<HTMLImageElement> {
  onProgress?.('正在抠图，首次加载模型约需 10-20 秒...')
  const blob = await removeBackground(file, {
    output: { format: 'image/png' },
  })
  onProgress?.('抠图完成')
  return loadImageFromBlob(blob)
}

export function computeGridMaskWeights(
  fgImg: HTMLImageElement,
  cols: number,
  rows: number,
  targetW: number,
  targetH: number,
  featherRadius: number,
): Float32Array {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = targetW
  maskCanvas.height = targetH
  const mCtx = maskCanvas.getContext('2d')!
  mCtx.drawImage(fgImg, 0, 0, targetW, targetH)
  const maskData = mCtx.getImageData(0, 0, targetW, targetH).data

  const gridSize = Math.round(targetW / cols)
  const raw = new Float32Array(cols * rows)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * gridSize
      const y0 = r * gridSize
      const x1 = Math.min(x0 + gridSize, targetW)
      const y1 = Math.min(y0 + gridSize, targetH)
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += maskData[(y * targetW + x) * 4 + 3]
          count++
        }
      }
      raw[r * cols + c] = sum / (count * 255)
    }
  }

  if (featherRadius <= 0) return raw

  // 1D 高斯核
  const kernelSize = featherRadius * 2 + 1
  const kernel = new Float32Array(kernelSize)
  const sigma = featherRadius / 2.5
  let kSum = 0
  for (let i = 0; i < kernelSize; i++) {
    const d = i - featherRadius
    kernel[i] = Math.exp(-(d * d) / (2 * sigma * sigma))
    kSum += kernel[i]
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= kSum

  // 水平 pass
  const temp = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let v = 0
      for (let k = 0; k < kernelSize; k++) {
        const sc = Math.min(Math.max(c + k - featherRadius, 0), cols - 1)
        v += raw[r * cols + sc] * kernel[k]
      }
      temp[r * cols + c] = v
    }
  }

  // 垂直 pass
  const result = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let v = 0
      for (let k = 0; k < kernelSize; k++) {
        const sr = Math.min(Math.max(r + k - featherRadius, 0), rows - 1)
        v += temp[sr * cols + c] * kernel[k]
      }
      result[r * cols + c] = Math.min(v, 1)
    }
  }

  return result
}
