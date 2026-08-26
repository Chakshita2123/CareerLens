'use client'
import React from 'react'
import { motion } from 'framer-motion'

interface Props {
  active?: boolean
  label?: string
}

/**
 * ScanSweep: Horizontal optical laser beam that sweeps vertically across
 * the target card/dropzone simulating camera autofocus / document scanning.
 */
export function ScanSweep({ active = true, label = 'SCANNING RESUME ARCHITECTURE…' }: Props) {
  if (!active) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl z-20">
      {/* Optical Laser Beam line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-lens-cyan to-transparent shadow-[0_0_16px_#00f0ff]"
        initial={{ top: '0%' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Trailing scan gradient wash behind beam */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-lens-cyan/20 to-transparent pointer-events-none" />
      </motion.div>

      {/* Optical Reticle Center Marker */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
        <div className="w-24 h-24 border border-lens-cyan/40 rounded-full flex items-center justify-center animate-ping duration-1000">
          <div className="w-1.5 h-1.5 bg-lens-cyan rounded-full" />
        </div>
      </div>

      {/* Scan Status HUD Overlay */}
      {label && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-surface-base/90 border border-lens-cyan/40 px-3 py-1 rounded-full shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lens-cyan animate-ping" />
          <span className="font-mono text-[10px] text-lens-cyan tracking-wider font-bold">
            {label}
          </span>
        </div>
      )}
    </div>
  )
}
