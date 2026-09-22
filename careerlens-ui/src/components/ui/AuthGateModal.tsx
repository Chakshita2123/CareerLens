'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { LogIn, X, Sparkles, Shield, Scan } from 'lucide-react'

interface AuthGateModalProps {
  isOpen: boolean
  onClose: () => void
  /** Context message shown below the heading, e.g. "Sign in to analyze your resume" */
  message?: string
  /** Optional extra detail line */
  detail?: string
}

export function AuthGateModal({ isOpen, onClose, message, detail }: AuthGateModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="auth-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Panel */}
          <motion.div
            key="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-sm pointer-events-auto">
              {/* Outer optical glow */}
              <div className="absolute -inset-6 bg-lens-cyan/8 blur-[60px] rounded-full pointer-events-none" />

              {/* Card */}
              <div className="relative bg-[#090b12] border border-surface-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden">
                {/* Top cyan bar */}
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-lens-cyan to-transparent" />

                {/* Corner viewfinder ticks */}
                <span className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-lens-cyan/60" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-lens-cyan/60" />
                <span className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-lens-cyan/60" />
                <span className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-lens-cyan/60" />

                {/* Dismiss button */}
                <button
                  id="auth-modal-close"
                  type="button"
                  onClick={onClose}
                  aria-label="Close sign in dialog"
                  className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400 hover:text-white hover:border-lens-cyan/40 transition-colors focus:outline-none focus:ring-2 focus:ring-lens-cyan/50"
                >
                  <X size={14} />
                </button>

                <div className="p-6 space-y-5">
                  {/* Brand + icon */}
                  <div className="flex flex-col items-center gap-3 text-center">
                    {/* Aperture icon */}
                    <div className="relative w-14 h-14 rounded-2xl bg-lens-cyan-dim border border-lens-cyan/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.25)]">
                      <Scan size={26} className="text-lens-cyan animate-pulse" />
                      <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan/70" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan/70" />
                    </div>

                    <div className="space-y-1">
                      <h2
                        id="auth-modal-title"
                        className="font-display font-extrabold text-lg text-white tracking-tight"
                      >
                        {message ?? 'Sign in to continue'}
                      </h2>
                      {detail && (
                        <p className="text-xs text-slate-400 font-sans leading-relaxed max-w-[240px] mx-auto">
                          {detail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sign in button */}
                  <button
                    id="auth-modal-google-signin"
                    type="button"
                    onClick={() => signIn('google')}
                    className="w-full btn-primary flex items-center justify-center gap-2.5 py-3 text-sm font-semibold"
                  >
                    {/* Google G icon */}
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
                    </svg>
                    <span>Sign in with Google</span>
                    <LogIn size={15} />
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 pt-1 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Shield size={11} className="text-focus-locked" />
                      Secure OAuth
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={11} className="text-lens-cyan" />
                      Saves your history
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
