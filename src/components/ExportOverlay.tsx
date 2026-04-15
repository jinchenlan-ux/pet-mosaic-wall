import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ExportOverlayProps {
  show: boolean
  progress: number
}

export function ExportOverlay({ show, progress }: ExportOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-light rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"
          >
            <Loader2 size={48} className="text-primary animate-spin" />
            <p className="text-white/80 text-lg font-medium">
              正在生成高清大图...
            </p>
            <div className="w-64 h-2 bg-surface-lighter rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-primary font-mono text-sm">
              {Math.round(progress)}%
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
