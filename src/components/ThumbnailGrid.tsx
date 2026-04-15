import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ThumbnailGridProps {
  files: File[]
  onRemove?: (index: number) => void
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
}

const item = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1 },
}

export function ThumbnailGrid({ files, onRemove }: ThumbnailGridProps) {
  if (files.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/40">
        {files.length} 张素材图已就绪
      </p>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5"
      >
        {files.map((file, index) => (
          <motion.div
            key={`${file.name}-${index}`}
            variants={item}
            className="relative aspect-square rounded-lg overflow-hidden group"
          >
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {onRemove && (
              <button
                onClick={() => onRemove(index)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <X size={14} className="text-white" />
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
