import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Download,
  RotateCcw,
  Settings2,
  PawPrint,
} from 'lucide-react'
import { DropZone } from './components/DropZone'
import { ProgressBar } from './components/ProgressBar'
import { ThumbnailGrid } from './components/ThumbnailGrid'
import { ExportOverlay } from './components/ExportOverlay'
import { useMosaic } from './hooks/useMosaic'

type AppStep = 'upload' | 'processing' | 'result'

export default function App() {
  const [step, setStep] = useState<AppStep>('upload')
  const [tileFiles, setTileFiles] = useState<File[]>([])
  const [targetFile, setTargetFile] = useState<File | null>(null)
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null)
  const [petName, setPetName] = useState('')
  const [gridSize, setGridSize] = useState(12)
  const [tintOpacity, setTintOpacity] = useState(0.55)
  const [edgeFeather, setEdgeFeather] = useState(2)
  const [showSettings, setShowSettings] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingGenerate, setPendingGenerate] = useState(false)
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { state: mosaicState, generateMosaic, exportHD, reset: resetMosaic } = useMosaic({
    gridSize,
    tintOpacity,
    edgeFeather,
  })

  const handleTileFiles = useCallback((files: File[]) => {
    setTileFiles((prev) => {
      const combined = [...prev, ...files]
      if (combined.length > 100) {
        alert('素材图片最多 100 张，已截取前 100 张')
        return combined.slice(0, 100)
      }
      return combined
    })
  }, [])

  const handleTargetFile = useCallback((files: File[]) => {
    const file = files[0]
    if (file) {
      setTargetFile(file)
      setTargetPreviewUrl(URL.createObjectURL(file))
    }
  }, [])

  const clearTarget = useCallback(() => {
    setTargetFile(null)
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl)
    setTargetPreviewUrl(null)
  }, [targetPreviewUrl])

  const removeTile = useCallback((index: number) => {
    setTileFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const canGenerate = tileFiles.length >= 20 && targetFile !== null

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !targetFile) return
    setStep('processing')
    setPendingGenerate(true)
  }, [canGenerate, targetFile])

  useEffect(() => {
    if (!pendingGenerate || !canvasRef.current || !targetFile) return
    setPendingGenerate(false)

    const run = async () => {
      await generateMosaic(tileFiles, targetFile, canvasRef.current!)
      setResultImageUrl(canvasRef.current!.toDataURL('image/png'))
      setStep('result')
    }
    run()
  }, [pendingGenerate, targetFile, tileFiles, generateMosaic])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)
    const blob = await exportHD(petName, setExportProgress)
    setIsExporting(false)

    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pet-mosaic-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [exportHD, petName])

  const handleReset = useCallback(() => {
    setStep('upload')
    setTileFiles([])
    setTargetFile(null)
    if (targetPreviewUrl) URL.revokeObjectURL(targetPreviewUrl)
    setTargetPreviewUrl(null)
    setPetName('')
    setResultImageUrl(null)
    resetMosaic()
  }, [targetPreviewUrl, resetMosaic])

  const isProcessing = mosaicState.status !== 'idle' && mosaicState.status !== 'done'
  const showCanvas = step === 'processing' || step === 'result'

  return (
    <div className="min-h-screen relative">
      <ExportOverlay show={isExporting} progress={exportProgress} />

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <PawPrint size={32} className="text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              Pet Mosaic Wall
            </h1>
          </div>
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            Upload your pet photos and a target image to create a stunning photo mosaic
          </p>
        </motion.header>

        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
                    上传宠物素材图
                  </h2>
                  <DropZone
                    onFilesSelected={handleTileFiles}
                    multiple
                    label="拖拽或点击上传宠物照片"
                    sublabel="支持 20-100 张图片，JPG / PNG 格式"
                    icon="upload"
                    minFiles={1}
                    maxFiles={100}
                  />
                  <ThumbnailGrid files={tileFiles} onRemove={removeTile} />
                </div>

                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
                    上传目标封面图
                  </h2>
                  <DropZone
                    onFilesSelected={handleTargetFile}
                    label="拖拽或点击上传封面图"
                    sublabel="马赛克将拼成此图的形状"
                    icon="image"
                    previewUrl={targetPreviewUrl}
                    onClear={clearTarget}
                  />

                  <div className="space-y-2">
                    <label className="text-sm text-white/60">
                      宠物名称（可选，用于水印）
                    </label>
                    <input
                      type="text"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="例如：Milo"
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-surface-lighter text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    <Settings2 size={14} />
                    高级设置
                  </button>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3"
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-white/50">
                            <span>网格大小</span>
                            <span className="font-mono">{gridSize}px</span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={30}
                            step={2}
                            value={gridSize}
                            onChange={(e) => setGridSize(Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-white/50">
                            <span>着色强度（越高越像原图）</span>
                            <span className="font-mono">{Math.round(tintOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={80}
                            step={5}
                            value={tintOpacity * 100}
                            onChange={(e) => setTintOpacity(Number(e.target.value) / 100)}
                            className="w-full accent-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-white/50">
                            <span>边缘羽化（越高边缘越柔和）</span>
                            <span className="font-mono">{edgeFeather}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={6}
                            step={1}
                            value={edgeFeather}
                            onChange={(e) => setEdgeFeather(Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <motion.div
                className="flex justify-center pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`
                    flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-sm
                    transition-all duration-300 cursor-pointer
                    ${
                      canGenerate
                        ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 active:scale-95'
                        : 'bg-surface-lighter text-white/30 cursor-not-allowed'
                    }
                  `}
                >
                  <Sparkles size={18} />
                  生成马赛克墙
                </button>
              </motion.div>

              {!canGenerate && (
                <p className="text-center text-xs text-white/30">
                  {tileFiles.length < 20
                    ? `还需上传 ${20 - tileFiles.length} 张素材图`
                    : '请上传目标封面图'}
                </p>
              )}
            </motion.div>
          )}

          {showCanvas && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <ProgressBar
                progress={mosaicState.progress}
                message={mosaicState.message}
                show={isProcessing}
              />

              <div className="flex justify-center">
                <div className="rounded-2xl overflow-hidden border border-surface-lighter bg-surface-light/30 shadow-2xl max-w-full">
                  {resultImageUrl ? (
                    <img
                      src={resultImageUrl}
                      alt="Mosaic result"
                      className="max-w-full h-auto"
                    />
                  ) : (
                    <div className="w-[600px] max-w-full aspect-[3/2] flex items-center justify-center">
                      <div className="text-white/30 text-sm">{mosaicState.message}</div>
                    </div>
                  )}
                </div>
              </div>

              {step === 'result' && mosaicState.status === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-4"
                >
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download size={16} />
                    导出高清图
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-lighter text-white/70 font-medium text-sm hover:bg-surface-light hover:text-white transition-all cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    重新开始
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
