'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Crosshair, Sparkles, Scan, FileText, Target, Award } from 'lucide-react'

const SCAN_STEPS = [
  { label: 'ATS Structure Audit', status: 'Passed (92/100)', color: 'text-focus-locked' },
  { label: 'MiniLM Semantic Embeddings', status: 'Vectors Calibrated', color: 'text-lens-cyan' },
  { label: 'Role Bank Alignment', status: 'Full-Stack (89%)', color: 'text-lens-cyan' },
  { label: 'STAR Bullet Quality', status: '4 Measurable Metrics', color: 'text-focus-locked' },
]

export function HeroScannerGraphic() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % SCAN_STEPS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-lens-cyan/15 via-lens-sapphire/10 to-lens-violet/15 blur-2xl rounded-3xl -z-10" />

      {/* Main Viewfinder Frame Card */}
      <div className="relative bg-surface-card/90 border border-surface-border rounded-2xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden">
        
        {/* Optical Corner Viewfinder Brackets */}
        <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-lens-cyan" />
        <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-lens-cyan" />
        <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-lens-cyan" />
        <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-lens-cyan" />

        {/* Viewfinder Top Telemetry Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border/80 font-mono text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 text-lens-cyan font-bold">
            <Scan size={12} className="animate-pulse" />
            <span>OPTICAL SCANNER [LIVE]</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">f/1.8 · ISO 100</span>
            <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-focus-locked font-semibold">
              CALIBRATED
            </span>
          </div>
        </div>

        {/* Simulated Resume Document Preview with Laser Scan Sweep */}
        <div className="relative my-4 p-4 rounded-xl bg-surface-elevated/80 border border-surface-border/80 overflow-hidden space-y-3">
          
          {/* Laser Scanning Beam */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-lens-cyan to-transparent shadow-[0_0_12px_rgba(0,240,255,0.9)] z-20 pointer-events-none"
            animate={{
              top: ['0%', '100%', '0%'],
            }}
            transition={{
              duration: 3.6,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />

          {/* Document Header Representation */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-3 w-32 rounded bg-slate-200/90" />
              <div className="h-2 w-20 rounded bg-slate-500/70" />
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-focus-locked-dim border border-focus-locked/30 font-mono text-[10px] text-focus-locked font-bold">
              <CheckCircle2 size={11} />
              <span>88 / 100 ATS</span>
            </div>
          </div>

          {/* Simulated Resume Sections */}
          <div className="space-y-2 pt-1">
            {/* Skills chip line */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-lens-cyan/15 border border-lens-cyan/30 text-lens-cyan font-mono text-[9px] font-semibold">
                React.js
              </span>
              <span className="px-2 py-0.5 rounded bg-lens-cyan/15 border border-lens-cyan/30 text-lens-cyan font-mono text-[9px] font-semibold">
                TypeScript
              </span>
              <span className="px-2 py-0.5 rounded bg-lens-cyan/15 border border-lens-cyan/30 text-lens-cyan font-mono text-[9px] font-semibold">
                FastAPI
              </span>
              <span className="px-2 py-0.5 rounded bg-focus-locked/15 border border-focus-locked/30 text-focus-locked font-mono text-[9px] font-semibold">
                PostgreSQL
              </span>
            </div>

            {/* Bullet points line */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-lens-cyan" />
                <div className="h-2 flex-1 rounded bg-slate-400/50" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-lens-cyan" />
                <div className="h-2 w-5/6 rounded bg-slate-400/40" />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Status Rotator */}
        <div className="pt-2 border-t border-surface-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-lens-cyan animate-ping" />
            <span className="text-slate-300 font-medium text-[11px]">
              {SCAN_STEPS[activeStep].label}:
            </span>
            <span className={`font-semibold text-[11px] ${SCAN_STEPS[activeStep].color}`}>
              {SCAN_STEPS[activeStep].status}
            </span>
          </div>

          <span className="font-mono text-[9px] text-slate-500">
            0{activeStep + 1}/04
          </span>
        </div>
      </div>
    </div>
  )
}
