'use client'
import React from 'react'

/**
 * ApertureSpinner: A spinning mechanical camera iris shutter spinner
 */
export function ApertureSpinner({ size = 48, className = '' }: { size?: number; className?: string }) {
  const center = size / 2
  const r = size * 0.42
  const blades = 6

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="animate-aperture-spin-fast">
        <circle cx={center} cy={center} r={r} fill="none" stroke="#20293a" strokeWidth="2" />
        {Array.from({ length: blades }).map((_, i) => {
          const angle = (i * (360 / blades) * Math.PI) / 180
          const x1 = center + Math.cos(angle) * (r * 0.4)
          const y1 = center + Math.sin(angle) * (r * 0.4)
          const x2 = center + Math.cos(angle + 0.8) * r
          const y2 = center + Math.sin(angle + 0.8) * r
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#00f0ff"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.4 + (i / blades) * 0.6}
            />
          )
        })}
      </svg>
      <div className="absolute w-2 h-2 rounded-full bg-lens-cyan shadow-[0_0_8px_#00f0ff]" />
    </div>
  )
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />
}

export function SkeletonRing() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <div className="shimmer rounded-full w-40 h-40 border border-surface-border" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ApertureSpinner size={56} />
        </div>
      </div>
      <div className="shimmer rounded h-4 w-32" />
    </div>
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 space-y-3 relative overflow-hidden">
      <SkeletonBlock className="h-5 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3.5 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  )
}

export function SkeletonChips({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`shimmer rounded-full h-7 ${i % 3 === 0 ? 'w-20' : i % 3 === 1 ? 'w-28' : 'w-16'}`} />
      ))}
    </div>
  )
}
