import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number
  message: string
  show: boolean
}

export function ProgressBar({ progress, message, show }: ProgressBarProps) {
  if (!show) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full space-y-2"
    >
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/60">{message}</span>
        <span className="text-primary font-mono">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-surface-lighter rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}
