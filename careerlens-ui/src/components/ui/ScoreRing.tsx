'use client'
import { ApertureGauge } from './ApertureGauge'

interface Props {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
}

/**
 * ScoreRing drop-in wrapper delegating to our camera ApertureGauge
 */
export function ScoreRing({ score, size = 160, strokeWidth = 8, label }: Props) {
  return (
    <ApertureGauge
      score={score}
      size={size}
      strokeWidth={strokeWidth}
      label={label}
    />
  )
}
