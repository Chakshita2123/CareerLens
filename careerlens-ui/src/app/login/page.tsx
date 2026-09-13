'use client'

import React, { useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { ApertureSpinner } from '@/components/ui/Skeleton'

/**
 * Official Google 'G' Logo SVG
 */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  // Auto-redirect if already signed in
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl)
    }
  }, [status, router, callbackUrl])

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl })
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Optical Background Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-lens-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-12 right-1/4 w-[400px] h-[250px] bg-lens-violet/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <ViewfinderFrame tag="AUTH-LOCK" active glow>
          <div className="card p-7 sm:p-9 space-y-6 bg-surface-card/95 backdrop-blur-2xl shadow-2xl border-surface-border">
            
            {/* Header Badge & Title */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lens-cyan-dim border border-lens-cyan/30 text-lens-cyan text-xs font-mono font-semibold tracking-wider">
                <Sparkles size={13} />
                <span>AUTHENTICATION GATEWAY</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                Welcome to Career<span className="text-lens-cyan">Lens</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 font-sans leading-relaxed max-w-xs mx-auto">
                Sign in with your Google account to calibrate your resume, save ATS history, and run AI mock interviews.
              </p>
            </div>

            {/* Google OAuth Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-[0_0_24px_rgba(255,255,255,0.25)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <ApertureSpinner size={20} />
                ) : (
                  <>
                    <GoogleLogo size={20} />
                    <span>Continue with Google</span>
                    <ArrowRight size={16} className="text-slate-500 ml-auto" />
                  </>
                )}
              </button>
            </div>

            {/* Value Proposition Checklist */}
            <div className="space-y-2.5 pt-4 border-t border-surface-border/70 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={14} className="text-focus-locked shrink-0" />
                <span>Deterministic ATS Scoring (100% private)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={14} className="text-focus-locked shrink-0" />
                <span>Resume version progression tracking across devices</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={14} className="text-focus-locked shrink-0" />
                <span>Grounded AI mock interview simulator</span>
              </div>
            </div>

            {/* Security Guarantee */}
            <div className="p-3 rounded-xl bg-surface-elevated/50 border border-surface-border flex items-center gap-2.5 text-[11px] text-slate-400">
              <Shield size={16} className="text-lens-cyan shrink-0" />
              <span>We only request your basic profile and email. Your resume files are never shared or sold.</span>
            </div>

          </div>
        </ViewfinderFrame>
      </motion.div>
    </div>
  )
}
