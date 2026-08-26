'use client'
import { useState } from 'react'
import { clsx } from 'clsx'
import type { SemanticMatch } from '@/lib/api'

type Variant = 'matched' | 'related' | 'missing'

interface Props {
  skill: string
  variant: Variant
  matchInfo?: SemanticMatch // for related chips — shown in tooltip
}

const styles: Record<Variant, { bg: string; text: string; border: string; indicator: string }> = {
  matched: {
    bg: 'bg-focus-locked-dim hover:bg-focus-locked/20',
    text: 'text-focus-locked',
    border: 'border-focus-locked/30 hover:border-focus-locked/70',
    indicator: '✓',
  },
  related: {
    bg: 'bg-lens-cyan-dim hover:bg-lens-cyan/20',
    text: 'text-lens-cyan',
    border: 'border-lens-cyan/30 hover:border-lens-cyan/70',
    indicator: '≈',
  },
  missing: {
    bg: 'bg-focus-lost-dim hover:bg-focus-lost/20',
    text: 'text-focus-lost',
    border: 'border-focus-lost/30 hover:border-focus-lost/70',
    indicator: '✗',
  },
}

/**
 * SkillChip: Features a camera autofocus micro-interaction on hover
 * with corner reticle brackets snapping in, and optical telemetry tooltips.
 */
export function SkillChip({ skill, variant, matchInfo }: Props) {
  const [showTip, setShowTip] = useState(false)
  const st = styles[variant]

  return (
    <div className="relative inline-flex group">
      <span
        className={clsx(
          'relative inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium',
          'border cursor-default transition-all duration-200 select-none backdrop-blur-sm',
          st.bg,
          st.text,
          st.border,
          'hover:shadow-[0_0_12px_rgba(0,240,255,0.15)] hover:scale-[1.02]'
        )}
        onMouseEnter={() => matchInfo && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        {/* Autofocus Corner Brackets on Hover */}
        <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-t border-l border-current opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 border-t border-r border-current opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        <span className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 border-b border-l border-current opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-b border-r border-current opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

        {/* Optical Symbol */}
        <span className="text-[10px] font-bold opacity-80">{st.indicator}</span>
        <span>{skill}</span>
      </span>

      {/* Optical Telemetry Tooltip for semantically matched skills */}
      {showTip && matchInfo && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50
                     bg-surface-card/95 backdrop-blur-xl border border-lens-cyan/40 rounded-xl
                     p-3 shadow-[0_0_24px_rgba(0,0,0,0.6)] min-w-[200px] text-left pointer-events-none"
        >
          {/* Corner viewfinder brackets */}
          <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t border-r border-lens-cyan" />
          <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b border-l border-lens-cyan" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-surface-border">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
              SEMANTIC FIT RETICLE
            </span>
            <span className="font-mono text-[9px] text-lens-cyan font-bold bg-lens-cyan-dim px-1.5 py-0.5 rounded border border-lens-cyan/30">
              {(matchInfo.similarity * 100).toFixed(1)}% SIM
            </span>
          </div>

          <div className="pt-2 text-xs font-medium text-white space-y-1">
            <div className="text-slate-400 text-[11px]">
              Resume: <span className="text-lens-cyan font-mono">{matchInfo.resume_skill}</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Matched JD: <span className="text-slate-200 font-mono">&ldquo;{matchInfo.jd_term}&rdquo;</span>
            </div>
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-card" />
        </div>
      )}
    </div>
  )
}
