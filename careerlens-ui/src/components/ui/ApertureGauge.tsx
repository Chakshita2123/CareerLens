'use client'
import React, { useMemo } from 'react'
import { useCountUp, useInView } from '@/lib/hooks'

interface Props {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  showApertureBlades?: boolean
  showCalibration?: boolean
}

/**
 * Focus State helper based on score
 */
function getOpticalStatus(score: number) {
  if (score >= 70) {
    return {
      status: 'FOCUS LOCKED',
      color: '#00e676', // precision emerald
      glow: 'rgba(0, 230, 118, 0.4)',
      textClass: 'text-focus-locked',
      badgeClass: 'bg-focus-locked-dim border-focus-locked/30 text-focus-locked',
      fStop: 'f/1.4',
    }
  }
  if (score >= 45) {
    return {
      status: 'CALIBRATING',
      color: '#ffb300', // amber
      glow: 'rgba(255, 179, 0, 0.4)',
      textClass: 'text-focus-calibrating',
      badgeClass: 'bg-focus-calibrating-dim border-focus-calibrating/30 text-focus-calibrating',
      fStop: 'f/4.0',
    }
  }
  return {
    status: 'OUT OF FOCUS',
    color: '#ff3366', // ruby
    glow: 'rgba(255, 51, 102, 0.4)',
    textClass: 'text-focus-lost',
    badgeClass: 'bg-focus-lost-dim border-focus-lost/30 text-focus-lost',
    fStop: 'f/16',
  }
}

/**
 * Camera Aperture / Optical Lens Gauge
 * 
 * Replaces generic circular progress bars with a real camera lens iris:
 * 1. Physical aperture iris blades that rotate and dilate open with the score
 * 2. Concentric optical calibration dial with precision reticle tick marks
 * 3. Technical mono readout with focal indicators (f-stop / degree scale)
 */
export function ApertureGauge({
  score,
  size = 180,
  strokeWidth = 8,
  label,
  sublabel,
  showApertureBlades = true,
  showCalibration = true,
}: Props) {
  const { ref, inView } = useInView(0.25)
  const animatedScore = useCountUp(score, 1400, inView)
  const opt = useMemo(() => getOpticalStatus(score), [score])

  const center = size / 2
  const dialRadius = center - strokeWidth - (size > 120 ? 8 : 4)
  const circumference = 2 * Math.PI * dialRadius
  const progressRatio = Math.min(100, Math.max(0, animatedScore)) / 100
  const dashOffset = circumference * (1 - progressRatio)

  // Aperture iris geometry: 6 overlapping blades
  const numBlades = 6
  // As score opens from 0 to 100, iris dilation ratio increases
  const irisDilation = 0.28 + (progressRatio * 0.42) // pupil opening ratio (0.28 -> 0.70)
  const bladeRadius = dialRadius * 0.78
  const pupilRadius = bladeRadius * irisDilation

  // Precompute blade polygon vertices
  const blades = useMemo(() => {
    const bladeList: string[] = []
    for (let i = 0; i < numBlades; i++) {
      const angle1 = (i * (360 / numBlades) * Math.PI) / 180
      const angle2 = ((i + 1) * (360 / numBlades) * Math.PI) / 180
      const angle3 = ((i + 1.8) * (360 / numBlades) * Math.PI) / 180

      // Outer chord points
      const p1x = center + Math.cos(angle1) * bladeRadius
      const p1y = center + Math.sin(angle1) * bladeRadius

      const p2x = center + Math.cos(angle2) * bladeRadius
      const p2y = center + Math.sin(angle2) * bladeRadius

      // Inner tangent pupil edge point
      const p3x = center + Math.cos(angle3) * pupilRadius
      const p3y = center + Math.sin(angle3) * pupilRadius

      // Tip curve
      const p4x = center + Math.cos(angle1 + 0.3) * pupilRadius
      const p4y = center + Math.sin(angle1 + 0.3) * pupilRadius

      bladeList.push(`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`)
    }
    return bladeList
  }, [center, bladeRadius, pupilRadius, numBlades])

  // Precision dial tick marks
  const tickMarks = useMemo(() => {
    if (!showCalibration || size < 110) return []
    const count = 36 // every 10 degrees
    const ticks = []
    const innerR = dialRadius + 4
    const outerMajor = dialRadius + 8
    const outerMinor = dialRadius + 6

    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) * Math.PI) / 180
      const isMajor = i % 3 === 0
      const outR = isMajor ? outerMajor : outerMinor
      const x1 = center + Math.cos(angle) * innerR
      const y1 = center + Math.sin(angle) * innerR
      const x2 = center + Math.cos(angle) * outR
      const y2 = center + Math.sin(angle) * outR
      ticks.push({ x1, y1, x2, y2, isMajor, key: i })
    }
    return ticks
  }, [center, dialRadius, showCalibration, size])

  return (
    <div ref={ref} className="flex flex-col items-center gap-2 select-none group">
      <div className="relative" style={{ width: size, height: size }}>
        
        {/* SVG Optical Lens Assembly */}
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            {/* Blade shading gradient */}
            <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#111724" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#1a2232" stopOpacity="0.95" />
            </linearGradient>

            {/* Lens glass reflections */}
            <radialGradient id="glassReflect" cx="30%" cy="25%" r="70%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
            </radialGradient>

            {/* Arc glow filter */}
            <filter id={`gaugeGlow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Outer Lens Housing Ring */}
          <circle
            cx={center}
            cy={center}
            r={center - 2}
            fill="#0b0e15"
            stroke="#1b2436"
            strokeWidth="1.5"
          />

          {/* Precision Calibration Dial Ticks */}
          {tickMarks.map((tick) => (
            <line
              key={tick.key}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={tick.isMajor ? '#334155' : '#1e293b'}
              strokeWidth={tick.isMajor ? 1.2 : 0.8}
            />
          ))}

          {/* Aperture Iris Blades Layer (Rotates smoothly with opening) */}
          {showApertureBlades && size >= 80 && (
            <g
              transform={`rotate(${animatedScore * 0.45} ${center} ${center})`}
              className="transition-transform duration-300"
            >
              {blades.map((points, idx) => (
                <polygon
                  key={idx}
                  points={points}
                  fill="url(#bladeGrad)"
                  stroke="#222f44"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
              ))}
            </g>
          )}

          {/* Optical Glass Lens Flare Overlay */}
          <circle
            cx={center}
            cy={center}
            r={dialRadius * 0.82}
            fill="url(#glassReflect)"
          />

          {/* Inner Optical Reticle Crosshairs */}
          {size >= 120 && (
            <g opacity="0.3" stroke="#00f0ff" strokeWidth="0.75" strokeDasharray="2 3">
              <line x1={center - pupilRadius} y1={center} x2={center + pupilRadius} y2={center} />
              <line x1={center} y1={center - pupilRadius} x2={center} y2={center + pupilRadius} />
              <circle cx={center} cy={center} r={pupilRadius * 0.45} fill="none" />
            </g>
          )}

          {/* Track Arc Base */}
          <circle
            cx={center}
            cy={center}
            r={dialRadius}
            fill="none"
            stroke="#182130"
            strokeWidth={strokeWidth}
            transform={`rotate(-90 ${center} ${center})`}
          />

          {/* Active Animated Optical Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={dialRadius}
            fill="none"
            stroke={opt.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            filter={`url(#gaugeGlow-${size})`}
            transform={`rotate(-90 ${center} ${center})`}
            style={{
              transition: 'stroke-dashoffset 0.08s linear',
            }}
          />

          {/* Viewfinder Cardinal Ticks */}
          {size >= 130 && (
            <>
              {/* Top Tick */}
              <line x1={center} y1={center - dialRadius - strokeWidth} x2={center} y2={center - dialRadius + 2} stroke="#00f0ff" strokeWidth="1.5" />
              {/* Right Tick */}
              <line x1={center + dialRadius - 2} y1={center} x2={center + dialRadius + strokeWidth} y2={center} stroke="#475569" strokeWidth="1" />
              {/* Bottom Tick */}
              <line x1={center} y1={center + dialRadius - 2} x2={center} y2={center + dialRadius + strokeWidth} stroke="#475569" strokeWidth="1" />
              {/* Left Tick */}
              <line x1={center - dialRadius - strokeWidth} y1={center} x2={center - dialRadius + 2} y2={center} stroke="#475569" strokeWidth="1" />
            </>
          )}
        </svg>

        {/* Viewfinder Center Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Focal / F-stop HUD Tag */}
          {size >= 140 && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 font-semibold mb-0.5">
              {opt.fStop} · ISO 100
            </span>
          )}

          {/* Score Numeric Readout */}
          <div className="flex items-baseline justify-center">
            <span
              className={`font-mono font-bold tabular-nums tracking-tighter ${opt.textClass} ${
                size < 85
                  ? 'text-xl leading-none'
                  : size < 125
                  ? 'text-2xl leading-none'
                  : size < 165
                  ? 'text-3xl sm:text-4xl'
                  : 'text-4xl sm:text-5xl'
              }`}
              style={{ textShadow: `0 0 16px ${opt.glow}` }}
            >
              {animatedScore}
            </span>
            {size >= 120 && (
              <span className="font-mono text-xs text-slate-500 font-medium ml-1">/100</span>
            )}
          </div>

          {/* Optical Sub-Status */}
          {size >= 150 && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: opt.color }} />
              <span className="font-mono text-[10px] tracking-wider uppercase font-semibold text-slate-400">
                {opt.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Label and Sublabel */}
      {label && (
        <div className="text-center space-y-0.5">
          <span className="text-xs font-display font-semibold text-slate-300 tracking-wide block">
            {label}
          </span>
          {sublabel && (
            <span className="text-[10px] font-mono text-slate-500 block">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
