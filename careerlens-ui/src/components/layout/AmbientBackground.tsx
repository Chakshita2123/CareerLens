'use client'

import React, { useEffect, useRef } from 'react'

/**
 * AmbientBackground — Persistent, Global Optical Bokeh & Focus Spotlight
 *
 * Concepts:
 * 1. Drifting Bokeh Orbs: 3 large, heavily blurred gradient orbs (cyan, sapphire, violet)
 *    drifting continuously on smooth, GPU-accelerated organic keyframe loops.
 * 2. Focus Spotlight: A soft radial gradient that follows the cursor using smoothed
 *    linear interpolation (lerp) via requestAnimationFrame and CSS variables.
 *    Sleeps automatically when the mouse is at rest for zero CPU overhead.
 * 3. Graceful degradation: Disables cursor follow on touch devices and respects
 *    OS-level `prefers-reduced-motion`.
 */
export function AmbientBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 1. Accessibility & Capability Checks
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isPointerFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (prefersReducedMotion || !isPointerFine) {
      // Default to a soft static center glow on mobile/reduced-motion
      if (containerRef.current) {
        containerRef.current.style.setProperty('--spotlight-x', '50%')
        containerRef.current.style.setProperty('--spotlight-y', '25%')
      }
      return
    }

    const container = containerRef.current
    if (!container) return

    // 2. Physics / Easing Setup
    const LERP_FACTOR = 0.075 // Smooth fluid camera focus tracking
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight * 0.25
    let currentX = targetX
    let currentY = targetY
    let isRunning = false
    let rafId: number

    // Set initial position
    container.style.setProperty('--spotlight-x', `${targetX.toFixed(1)}px`)
    container.style.setProperty('--spotlight-y', `${targetY.toFixed(1)}px`)

    const updatePosition = () => {
      // Linear interpolation (lerp)
      currentX += (targetX - currentX) * LERP_FACTOR
      currentY += (targetY - currentY) * LERP_FACTOR

      container.style.setProperty('--spotlight-x', `${currentX.toFixed(1)}px`)
      container.style.setProperty('--spotlight-y', `${currentY.toFixed(1)}px`)

      // If still moving towards target, continue loop; otherwise sleep
      const deltaX = Math.abs(targetX - currentX)
      const deltaY = Math.abs(targetY - currentY)

      if (deltaX > 0.1 || deltaY > 0.1) {
        rafId = requestAnimationFrame(updatePosition)
      } else {
        isRunning = false
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY

      if (!isRunning) {
        isRunning = true
        rafId = requestAnimationFrame(updatePosition)
      }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* ─── 1. Cursor-Tracking Optical Spotlight ─────────────────────────── */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(
            680px circle at var(--spotlight-x, 50%) var(--spotlight-y, 25%),
            rgba(0, 240, 255, 0.045) 0%,
            rgba(14, 165, 233, 0.03) 30%,
            rgba(139, 92, 246, 0.02) 55%,
            transparent 75%
          )`,
        }}
      />

      {/* ─── 2. Drifting Bokeh Orbs (Organic Depth) ────────────────────────── */}
      {/* Orb 1: Primary Aperture Cyan (Top-Left quadrant drift) */}
      <div
        className="ambient-bokeh-orb ambient-orb-cyan absolute rounded-full"
        style={{
          width: '580px',
          height: '580px',
          background:
            'radial-gradient(circle, rgba(0, 240, 255, 0.09) 0%, rgba(14, 165, 233, 0.04) 45%, transparent 75%)',
          filter: 'blur(95px)',
          top: '-8%',
          left: '8%',
          willChange: 'transform',
        }}
      />

      {/* Orb 2: Secondary Optical Violet (Mid-Right drift) */}
      <div
        className="ambient-bokeh-orb ambient-orb-violet absolute rounded-full"
        style={{
          width: '620px',
          height: '620px',
          background:
            'radial-gradient(circle, rgba(139, 92, 246, 0.075) 0%, rgba(59, 130, 246, 0.03) 45%, transparent 75%)',
          filter: 'blur(105px)',
          top: '32%',
          right: '4%',
          willChange: 'transform',
        }}
      />

      {/* Orb 3: Deep Sapphire / Focus Green Tint (Bottom-Center drift) */}
      <div
        className="ambient-bokeh-orb ambient-orb-sapphire absolute rounded-full"
        style={{
          width: '540px',
          height: '540px',
          background:
            'radial-gradient(circle, rgba(2, 132, 199, 0.07) 0%, rgba(0, 230, 118, 0.025) 50%, transparent 75%)',
          filter: 'blur(100px)',
          bottom: '2%',
          left: '28%',
          willChange: 'transform',
        }}
      />

      {/* ─── 3. Subtle Optical Sensor Micro-Dot Matrix ────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #00f0ff 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />
    </div>
  )
}
