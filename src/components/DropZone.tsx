import { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ImagePlus, X } from 'lucide-react'

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void
  multiple?: boolean
  label: string
  sublabel: string
  accept?: string
  icon?: 'upload' | 'image'
  maxFiles?: number
  minFiles?: number
  previewUrl?: string | null
  onClear?: () => void
}

export function DropZone({
  onFilesSelected,
  multiple = false,
  label,
  sublabel,
  accept = 'image/*',
  icon = 'upload',
  maxFiles,
  minFiles,
  previewUrl,
  onClear,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const processFiles = useCallback(
    (fileList: FileList) => {
      const imageFiles = Array.from(fileList).filter((f) =>
        f.type.startsWith('image/')
      )

      if (maxFiles && imageFiles.length > maxFiles) {
        alert(`最多只能上传 ${maxFiles} 张图片`)
        return
      }
      if (minFiles && imageFiles.length < minFiles) {
        alert(`请至少上传 ${minFiles} 张图片`)
        return
      }

      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles)
      }
    },
    [onFilesSelected, maxFiles, minFiles]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files)
      }
    },
    [processFiles]
  )

  const IconComponent = icon === 'upload' ? Upload : ImagePlus

  if (previewUrl) {
    return (
      <motion.div
        layout
        className="relative rounded-2xl overflow-hidden border-2 border-primary/30 bg-surface-light"
      >
        <img
          src={previewUrl}
          alt="Preview"
          className="w-full h-48 object-cover"
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative rounded-2xl border-2 border-dashed p-8 cursor-pointer
        transition-all duration-300 ease-out
        flex flex-col items-center justify-center gap-3
        min-h-[180px]
        ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-surface-lighter bg-surface-light/50 hover:border-accent/50 hover:bg-surface-light'
        }
      `}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/5 rounded-2xl"
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          y: isDragging ? -4 : 0,
          scale: isDragging ? 1.1 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <IconComponent
          size={36}
          className={`transition-colors ${
            isDragging ? 'text-primary' : 'text-accent/60'
          }`}
        />
      </motion.div>

      <div className="text-center">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="text-xs text-white/40 mt-1">{sublabel}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />
    </motion.div>
  )
}
