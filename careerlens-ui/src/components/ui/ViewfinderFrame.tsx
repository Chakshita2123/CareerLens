'use client'
import React from 'react'
import { clsx } from 'clsx'

interface Props {
  children: React.ReactNode
  className?: string
  tag?: string
  active?: boolean
  cornerSize?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

/**
 * ViewfinderFrame: Surrounds cards or upload zones with camera viewfinder brackets
 * ┌                     ┐
 * └                     ┘
 * with optional HUD optical telemetry tags ([AF-L], [SCAN ACTIVE], [TARGET LOCKED]).
 */
export function ViewfinderFrame({
  children,
  className = '',
  tag,
  active = false,
  cornerSize = 'md',
  glow = false,
}: Props) {
  const sizeClass = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-5 h-5',
  }[cornerSize]

  const borderColor = active
    ? 'border-lens-cyan'
    : 'border-slate-600 group-hover:border-lens-cyan/70'

  return (
    <div
      className={clsx(
        'relative rounded-2xl transition-all duration-300 group',
        glow && 'shadow-[0_0_30px_rgba(0,240,255,0.15)]',
        className
      )}
    >
      {/* Top-Left Bracket */}
      <span
        className={clsx(
          'absolute -top-1 -left-1 border-t-2 border-l-2 rounded-tl-sm pointer-events-none transition-colors duration-300',
          sizeClass,
          borderColor
        )}
      />

      {/* Top-Right Bracket */}
      <span
        className={clsx(
          'absolute -top-1 -right-1 border-t-2 border-r-2 rounded-tr-sm pointer-events-none transition-colors duration-300',
          sizeClass,
          borderColor
        )}
      />

      {/* Bottom-Left Bracket */}
      <span
        className={clsx(
          'absolute -bottom-1 -left-1 border-b-2 border-l-2 rounded-bl-sm pointer-events-none transition-colors duration-300',
          sizeClass,
          borderColor
        )}
      />

      {/* Bottom-Right Bracket */}
      <span
        className={clsx(
          'absolute -bottom-1 -right-1 border-b-2 border-r-2 rounded-br-sm pointer-events-none transition-colors duration-300',
          sizeClass,
          borderColor
        )}
      />

      {/* Optional Optical HUD Tag in corner */}
      {tag && (
        <div className="absolute top-2 right-3 pointer-events-none flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-lens-cyan animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-lens-cyan font-bold bg-surface-base/80 px-1.5 py-0.5 rounded border border-lens-cyan/30">
            {tag}
          </span>
        </div>
      )}

      {children}
    </div>
  )
}
