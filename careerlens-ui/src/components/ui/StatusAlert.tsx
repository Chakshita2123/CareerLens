'use client'
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, AlertTriangle, Info, RefreshCw, X, Sparkles, CheckCircle2, Clock } from 'lucide-react'

export interface StatusAlertProps {
  variant?: 'error' | 'warning' | 'info' | 'cold-start' | 'success'
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
  className?: string
}

export function StatusAlert({
  variant = 'error',
  title,
  message,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  className = '',
}: StatusAlertProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          container: 'bg-focus-lost-dim border-focus-lost/40 text-slate-200',
          icon: <AlertCircle className="text-focus-lost shrink-0" size={18} />,
          titleColor: 'text-focus-lost',
          buttonStyle: 'bg-focus-lost/20 hover:bg-focus-lost/30 text-focus-lost border-focus-lost/40',
        }
      case 'warning':
        return {
          container: 'bg-focus-calibrating-dim border-focus-calibrating/40 text-slate-200',
          icon: <AlertTriangle className="text-focus-calibrating shrink-0" size={18} />,
          titleColor: 'text-focus-calibrating',
          buttonStyle: 'bg-focus-calibrating/20 hover:bg-focus-calibrating/30 text-focus-calibrating border-focus-calibrating/40',
        }
      case 'cold-start':
        return {
          container: 'bg-lens-cyan-dim border-lens-cyan/40 text-slate-200 shadow-[0_0_20px_rgba(0,240,255,0.15)]',
          icon: <Clock className="text-lens-cyan shrink-0 animate-pulse" size={18} />,
          titleColor: 'text-lens-cyan',
          buttonStyle: 'bg-lens-cyan/20 hover:bg-lens-cyan/30 text-lens-cyan border-lens-cyan/40',
        }
      case 'success':
        return {
          container: 'bg-focus-locked-dim border-focus-locked/40 text-slate-200',
          icon: <CheckCircle2 className="text-focus-locked shrink-0" size={18} />,
          titleColor: 'text-focus-locked',
          buttonStyle: 'bg-focus-locked/20 hover:bg-focus-locked/30 text-focus-locked border-focus-locked/40',
        }
      case 'info':
      default:
        return {
          container: 'bg-surface-elevated border-surface-border text-slate-300',
          icon: <Info className="text-lens-cyan shrink-0" size={18} />,
          titleColor: 'text-white',
          buttonStyle: 'bg-surface-card hover:bg-surface-hover text-slate-200 border-surface-border',
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      role={variant === 'error' ? 'alert' : 'status'}
      className={`relative flex items-start gap-3.5 p-4 rounded-xl border backdrop-blur-md font-sans text-xs sm:text-sm ${styles.container} ${className}`}
    >
      <div className="pt-0.5">{styles.icon}</div>

      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <h4 className={`font-display font-bold tracking-tight text-xs sm:text-sm ${styles.titleColor}`}>
            {title}
          </h4>
        )}
        <p className="leading-relaxed text-slate-300 text-xs sm:text-sm">
          {message}
        </p>

        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold transition-all duration-200 cursor-pointer ${styles.buttonStyle}`}
            >
              <RefreshCw size={12} className="shrink-0" />
              <span>{retryLabel}</span>
            </button>
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  )
}
