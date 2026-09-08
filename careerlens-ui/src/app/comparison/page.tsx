'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, TrendingUp, TrendingDown, Minus,
  Sparkles, Calendar, FileText, RefreshCw,
  Clock, CheckCircle2, Target, Zap, Plus, Upload,
} from 'lucide-react'
import { useUserId, useSelectedVersion } from '@/lib/hooks'
import { getComparison } from '@/lib/api'
import type { ComparisonEntry, ComparisonResponse } from '@/lib/api'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceDot, ReferenceArea,
} from 'recharts'
import { ApertureGauge } from '@/components/ui/ApertureGauge'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { ApertureSpinner } from '@/components/ui/Skeleton'
import Link from 'next/link'

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ value, label = 'pts' }: { value: number | null; label?: string }) {
  if (value === null) {
    return (
      <span className="font-mono text-[10px] font-semibold text-slate-500 bg-surface-elevated px-2.5 py-1 rounded-lg border border-surface-border tracking-wider">
        BASELINE
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-focus-locked bg-focus-locked-dim px-2.5 py-0.5 rounded-full border border-focus-locked/30">
        <TrendingUp size={11} />
        <span>+{value} {label}</span>
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-focus-lost bg-focus-lost-dim px-2.5 py-0.5 rounded-full border border-focus-lost/30">
        <TrendingDown size={11} />
        <span>{value} {label}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-slate-400 bg-surface-elevated px-2.5 py-0.5 rounded-full border border-surface-border">
      <Minus size={11} />
      <span>±0 {label}</span>
    </span>
  )
}

// ─── Version Timeline Card ────────────────────────────────────────────────────

function TimelineVersionCard({
  entry, isHighlighted, onSelect, index, isLatest, total,
}: {
  entry: ComparisonEntry
  isHighlighted: boolean
  onSelect: () => void
  index: number
  isLatest: boolean
  total: number
}) {
  const dateStr = new Date(entry.uploaded_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const timeStr = new Date(entry.uploaded_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })

  const footerMsg = (() => {
    if (entry.delta.ats_delta === null) return 'Baseline calibration · First revision indexed in session.'
    if (entry.delta.ats_delta > 0) return `↑ Gained +${entry.delta.ats_delta} ATS pts from prior iteration — aperture sharpened.`
    if (entry.delta.ats_delta < 0) return `↓ Lost ${Math.abs(entry.delta.ats_delta)} ATS pts vs prior — review structural changes.`
    return 'Score maintained · Calibration held steady across iterations.'
  })()

  const footerColor = (() => {
    if (entry.delta.ats_delta === null || entry.delta.ats_delta === 0) return 'text-slate-500'
    return entry.delta.ats_delta > 0 ? 'text-focus-locked/80' : 'text-focus-lost/80'
  })()

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      id={`version-${entry._id}`}
      onClick={onSelect}
      className="relative pl-8 sm:pl-12 group cursor-pointer"
    >
      {/* Timeline Reticle Node */}
      <div
        className={`absolute left-0 top-6 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-300 z-10
          ${isHighlighted
            ? 'bg-lens-cyan text-black border-lens-cyan shadow-[0_0_20px_rgba(0,240,255,0.8)] scale-110'
            : isLatest
            ? 'bg-focus-locked text-black border-focus-locked shadow-[0_0_14px_rgba(0,230,118,0.6)]'
            : 'bg-surface-elevated text-slate-400 border-surface-border group-hover:border-lens-cyan/60 group-hover:text-lens-cyan'
          }`}
      >
        {isLatest ? '★' : total - index}
      </div>

      {/* Card */}
      <ViewfinderFrame
        tag={isLatest ? 'CURRENT FOCUS' : `CAL-REV #${total - index}`}
        active={isHighlighted || isLatest}
        cornerSize="sm"
      >
        <div
          className={`card transition-all duration-300 space-y-4 overflow-hidden
            ${isHighlighted
              ? 'border-lens-cyan/60 bg-surface-card shadow-[0_0_32px_rgba(0,240,255,0.18)] scale-[1.01]'
              : isLatest
              ? 'border-focus-locked/30 bg-surface-card/95'
              : 'border-surface-border bg-surface-card/85 hover:border-lens-cyan/40 hover:bg-surface-card'
            }`}
        >
          {/* Score progress bar across the very top of the card */}
          <div className="h-0.5 w-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                entry.overall_ats_score >= 70
                  ? 'bg-gradient-to-r from-lens-cyan to-focus-locked shadow-[0_0_6px_#00e676]'
                  : entry.overall_ats_score >= 45
                  ? 'bg-gradient-to-r from-lens-sapphire to-focus-calibrating'
                  : 'bg-gradient-to-r from-focus-lost to-focus-calibrating'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${entry.overall_ats_score}%` }}
              transition={{ duration: 1.2, delay: index * 0.08, ease: 'easeOut' }}
            />
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left: meta */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
                    {entry.version_label}
                  </h3>
                  {isLatest && (
                    <span className="font-mono text-[9px] font-bold text-lens-cyan bg-lens-cyan-dim border border-lens-cyan/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      CURRENT FOCUS
                    </span>
                  )}
                </div>

                {/* JetBrains Mono timestamp */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-lens-cyan/60" />
                    <span className="tabular-nums">{dateStr}</span>
                    <span className="text-slate-700">·</span>
                    <span className="tabular-nums text-slate-600">{timeStr}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-500 truncate max-w-[200px]">
                    <FileText size={11} />
                    <span>{entry.raw_filename}</span>
                  </span>
                </div>

                {/* Focus state label */}
                <div className={`font-mono text-[10px] uppercase tracking-wider font-bold pt-0.5 ${
                  entry.overall_ats_score >= 70 ? 'text-focus-locked' :
                  entry.overall_ats_score >= 45 ? 'text-focus-calibrating' : 'text-focus-lost'
                }`}>
                  {entry.overall_ats_score >= 70 ? '● FOCUS LOCKED' :
                   entry.overall_ats_score >= 45 ? '● CALIBRATING' : '● OUT OF FOCUS'}
                </div>
              </div>

              {/* Right: Gauges */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                    ATS DELTA
                  </div>
                  <DeltaBadge value={entry.delta.ats_delta} label="pts" />
                </div>

                <ApertureGauge
                  score={entry.overall_ats_score}
                  size={80}
                  strokeWidth={6}
                  showApertureBlades={true}
                  showCalibration={false}
                />

                {entry.latest_job_match_score !== null && (
                  <div className="border-l border-surface-border pl-4 text-center font-mono">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      JOB MATCH
                    </div>
                    <div className="font-extrabold text-lg text-focus-locked tabular-nums leading-none">
                      {entry.latest_job_match_score}
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">/ 100</div>
                    {entry.delta.match_score_delta !== null && (
                      <DeltaBadge value={entry.delta.match_score_delta} label="pts" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-surface-border/60 flex flex-wrap items-center justify-between gap-3">
              <span className={`text-[11px] font-mono ${footerColor}`}>
                {footerMsg}
              </span>
              <div className="flex items-center gap-3 font-mono text-xs">
                <Link href="/match" className="text-lens-cyan hover:text-white font-medium flex items-center gap-1 transition-colors">
                  <Target size={12} />
                  <span>Test Match</span>
                </Link>
                <Link href="/improve" className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 transition-colors">
                  <Zap size={12} />
                  <span>Enhance Bullets</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </ViewfinderFrame>
    </motion.div>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload: { label: string; date: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  return (
    <div className="bg-surface-card/95 backdrop-blur-xl border border-lens-cyan/40 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[180px] relative">
      <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-t border-l border-lens-cyan" />
      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-b border-r border-lens-cyan" />
      <div>
        <span className="font-display font-bold text-white block text-sm">{label}</span>
        {item?.label && <span className="font-mono text-[10px] text-slate-400 truncate block max-w-[200px]">{item.label}</span>}
        {item?.date && <span className="font-mono text-[10px] text-slate-600 block">{item.date}</span>}
      </div>
      <div className="space-y-1.5 pt-1 border-t border-surface-border font-mono">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-slate-300 font-medium">{p.name}:</span>
            </div>
            <span className="font-bold tabular-nums" style={{ color: p.color }}>{p.value} / 100</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Optical Loading State ────────────────────────────────────────────────────

function OpticalLoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <div className="flex flex-col items-center gap-4 py-6">
        <ApertureSpinner size={56} />
        <div className="text-center space-y-1">
          <p className="text-sm font-display font-semibold text-lens-cyan">Indexing Calibration Timeline…</p>
          <p className="text-xs font-mono text-slate-500 animate-pulse">
            Fetching version history and computing score deltas
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 space-y-2.5">
            <div className="shimmer h-3 w-20 rounded" />
            <div className="shimmer h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
      <ViewfinderFrame tag="PROGRESSION-CURVE">
        <div className="card p-6 h-64 relative overflow-hidden">
          <div className="absolute inset-0 shimmer opacity-40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[9px] text-lens-cyan/40 tracking-widest uppercase">Rendering Curve…</span>
          </div>
        </div>
      </ViewfinderFrame>
      {[1, 2].map((i) => (
        <div key={i} className="card p-6 space-y-4 ml-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="shimmer h-5 w-48 rounded" />
              <div className="shimmer h-3 w-32 rounded" />
            </div>
            <div className="shimmer rounded-full w-20 h-20" />
          </div>
          <div className="shimmer h-px w-full rounded" />
          <div className="shimmer h-3 w-64 rounded" />
        </div>
      ))}
    </motion.div>
  )
}

// ─── Optical Empty State ──────────────────────────────────────────────────────

function OpticalEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto"
    >
      <ViewfinderFrame tag="ARCHIVE-EMPTY" cornerSize="lg">
        <div className="card p-10 text-center space-y-6 border-surface-border/80 bg-surface-card/95">
          {/* Animated optical lens illustration */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
            <motion.div
              className="absolute inset-1 rounded-full border border-dashed border-lens-cyan/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-3 rounded-full border border-surface-border/80 bg-surface-elevated/50 flex items-center justify-center">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Upload size={22} className="text-lens-cyan" />
              </motion.div>
            </div>
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute inset-0 flex items-start justify-center"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div className="w-[1.5px] h-2.5 bg-lens-cyan/40 rounded-full mt-0.5" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-bold text-white text-lg">No Calibrations Indexed</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Upload your first resume to start tracking ATS score progression,
              version deltas, and calibration curves over time.
            </p>
          </div>

          {/* F-stop scale decoration */}
          <div className="flex items-center justify-center gap-2.5 font-mono text-[9px] text-slate-700 uppercase tracking-widest">
            {['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/16'].map((f, i, arr) => (
              <span key={f} className={i === 0 ? 'text-lens-cyan/40' : i === arr.length - 1 ? 'text-focus-lost/30' : ''}>
                {f}
              </span>
            ))}
          </div>

          <Link href="/" className="btn-primary text-sm py-2.5 px-6 inline-flex items-center gap-2">
            <Plus size={15} />
            <span>Mount First Resume</span>
          </Link>
        </div>
      </ViewfinderFrame>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComparisonPage() {
  const userId = useUserId()
  const [, setVersionId] = useSelectedVersion()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const handleLoad = useCallback(async () => {
    if (!userId) return
    setError(null)
    setLoading(true)
    try {
      const res = await getComparison(userId)
      setData(res)
      if (res.versions.length > 0) {
        setVersionId(res.versions[res.versions.length - 1]._id)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load comparison')
    } finally {
      setLoading(false)
    }
  }, [userId, setVersionId])

  useEffect(() => {
    if (userId) handleLoad()
  }, [userId, handleLoad])

  const chartData =
    data?.versions.map((v, i) => ({
      name: `v${i + 1}`,
      label: v.version_label,
      ATS: v.overall_ats_score,
      ...(v.latest_job_match_score !== null ? { Match: v.latest_job_match_score } : {}),
      id: v._id,
      date: new Date(v.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    })) ?? []

  const handleChartClick = (d: { activePayload?: Array<{ payload: { id: string } }> }) => {
    const id = d?.activePayload?.[0]?.payload?.id
    if (id) {
      setHighlightId(id)
      document.getElementById(`version-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const totalVersions = data?.total_versions ?? 0
  const allAts = data?.versions.map((v) => v.overall_ats_score) ?? []
  const bestAts = allAts.length > 0 ? Math.max(...allAts) : 0
  const firstAts = allAts.length > 0 ? allAts[0] : 0
  const latestAts = allAts.length > 0 ? allAts[allAts.length - 1] : 0
  const totalGrowth = latestAts - firstAts

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-lens-cyan/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-96 right-1/4 w-[400px] h-[250px] bg-lens-violet/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-mono font-semibold text-lens-cyan tracking-wider shadow-sm">
            <BarChart2 size={13} className="text-lens-cyan" />
            <span>OPTICAL CALIBRATION TIMELINE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-gradient">
            Resume Version History
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-sans">
            Track your ATS score gains and job match metrics across iterations.
            Each upload is a calibration snapshot in your focus progression curve.
          </p>
        </motion.div>

        {/* Optical loading state */}
        {loading && <OpticalLoadingState />}

        {/* Empty / error state */}
        {!loading && error && <OpticalEmptyState />}

        {/* Populated State */}
        <AnimatePresence>
          {data && !loading && totalVersions > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-10 max-w-4xl mx-auto"
            >
              {/* Single Version Tip */}
              {totalVersions === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-lens-cyan-dim border border-lens-cyan/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono relative"
                >
                  <span className="absolute top-1 left-1 w-2 h-2 border-t border-l border-lens-cyan/60" />
                  <span className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-lens-cyan/60" />
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <Sparkles size={15} className="text-lens-cyan shrink-0 animate-pulse" />
                    <span>
                      <strong className="text-lens-cyan">1 calibration indexed.</strong> Upload an improved revision to reveal your score progression curve and delta tracking.
                    </span>
                  </div>
                  <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1.5">
                    <Plus size={12} />
                    Upload v2 →
                  </Link>
                </motion.div>
              )}

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  { label: 'Total Versions', value: totalVersions, icon: Clock, color: 'text-lens-cyan' },
                  { label: 'Peak ATS Score', value: `${bestAts}/100`, icon: CheckCircle2, color: 'text-focus-locked' },
                  { label: 'Latest Score', value: `${latestAts}/100`, icon: BarChart2, color: 'text-lens-sapphire' },
                  {
                    label: 'Overall Growth',
                    value: totalGrowth >= 0 ? `+${totalGrowth} pts` : `${totalGrowth} pts`,
                    icon: TrendingUp,
                    color: totalGrowth >= 0 ? 'text-focus-locked' : 'text-focus-lost',
                  },
                ].map((stat, si) => {
                  const Icon = stat.icon
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: si * 0.06 }}
                      className="card p-4 space-y-1.5 bg-surface-card/90 border-surface-border relative group hover:border-lens-cyan/30 transition-colors"
                    >
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-current opacity-20 group-hover:opacity-60 transition-opacity" />
                      <div className="flex items-center justify-between text-slate-400 font-mono">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">{stat.label}</span>
                        <Icon size={13} className={stat.color} />
                      </div>
                      <div className={`text-2xl font-mono font-extrabold tabular-nums ${stat.color}`}>
                        {stat.value}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Score Progression Area Chart with semantic bands */}
              {chartData.length > 1 && (
                <ViewfinderFrame tag="PROGRESSION-CURVE">
                  <div className="card p-6 sm:p-7 space-y-5 bg-surface-card/95 shadow-2xl border-surface-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                      <div>
                        <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                          <TrendingUp size={16} className="text-lens-cyan" />
                          <span>Optical Score Progression Curve</span>
                        </h2>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Click any node to inspect · Color bands indicate focus quality
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                        <div className="flex items-center gap-1.5 text-lens-cyan">
                          <span className="w-2.5 h-2.5 rounded-full bg-lens-cyan shadow-[0_0_6px_#00f0ff]" />
                          <span>ATS</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-focus-locked">
                          <span className="w-2.5 h-2.5 rounded-full bg-focus-locked shadow-[0_0_6px_#00e676]" />
                          <span>Match</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-72 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                          <defs>
                            <linearGradient id="colorAts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorMatch" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00e676" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#00e676" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#182232" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                          <RechartsTooltip content={<CustomTooltip />} />

                          {/* Semantic score band: Focus Locked ≥70 */}
                          <ReferenceArea y1={70} y2={100} fill="#00e676" fillOpacity={0.045} stroke="#00e676" strokeOpacity={0.15} strokeDasharray="4 4" strokeWidth={1}
                            label={{ value: 'FOCUS LOCKED', position: 'insideTopRight', fill: '#00e676', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', opacity: 0.4 }}
                          />
                          {/* Semantic score band: Calibrating 45–70 */}
                          <ReferenceArea y1={45} y2={70} fill="#ffb300" fillOpacity={0.025} stroke="#ffb300" strokeOpacity={0.1} strokeDasharray="4 4" strokeWidth={1}
                            label={{ value: 'CALIBRATING', position: 'insideTopRight', fill: '#ffb300', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', opacity: 0.35 }}
                          />
                          {/* Semantic score band: Out of Focus 0–45 */}
                          <ReferenceArea y1={0} y2={45} fill="#ff3366" fillOpacity={0.02} stroke="#ff3366" strokeOpacity={0.08} strokeDasharray="4 4" strokeWidth={1}
                            label={{ value: 'OUT OF FOCUS', position: 'insideTopRight', fill: '#ff3366', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', opacity: 0.3 }}
                          />

                          <Area type="monotone" dataKey="ATS" stroke="#00f0ff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAts)"
                            dot={{ r: 5, fill: '#00f0ff', strokeWidth: 2, stroke: '#06070a' }} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                          />
                          <Area type="monotone" dataKey="Match" stroke="#00e676" strokeWidth={2} fillOpacity={1} fill="url(#colorMatch)"
                            dot={{ r: 4, fill: '#00e676', strokeWidth: 2, stroke: '#06070a' }} activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }} connectNulls
                          />

                          {highlightId && (() => {
                            const idx = chartData.findIndex((d) => d.id === highlightId)
                            if (idx < 0) return null
                            return (
                              <ReferenceDot x={chartData[idx].name} y={chartData[idx].ATS} r={12}
                                fill="rgba(0,240,255,0.25)" stroke="#00f0ff" strokeWidth={2}
                              />
                            )
                          })()}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Score band legend */}
                    <div className="flex items-center justify-end gap-5 text-[10px] font-mono text-slate-500 pt-1 border-t border-surface-border/40">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-focus-locked/15 border border-focus-locked/25" />
                        ≥70 Focus Locked
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-focus-calibrating/15 border border-focus-calibrating/25" />
                        45–69 Calibrating
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-focus-lost/15 border border-focus-lost/25" />
                        &lt;45 Out of Focus
                      </span>
                    </div>
                  </div>
                </ViewfinderFrame>
              )}

              {/* Vertical Calibration Timeline */}
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <div>
                    <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                      <Clock size={16} className="text-lens-cyan" />
                      <span>Calibration Timeline</span>
                    </h2>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                      {totalVersions} revision{totalVersions !== 1 ? 's' : ''} indexed · f/1.4 → f/16 aperture scale
                    </p>
                  </div>
                  <button onClick={handleLoad} className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 font-mono">
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Stem with f-stop graduation ticks */}
                <div className="relative ml-3.5 pb-2">
                  {/* Gradient stem line */}
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-lens-cyan/60 via-surface-border to-surface-border/30 rounded-full" />

                  {/* F-stop graduation ticks along stem */}
                  {Array.from({ length: 7 }).map((_, ti) => (
                    <div
                      key={ti}
                      className="absolute left-[-1px] flex items-center pointer-events-none"
                      style={{ top: `${(ti / 6) * 100}%` }}
                    >
                      <div className={`${ti === 0 ? 'w-3 h-[1.5px] bg-lens-cyan/70' : ti === 6 ? 'w-2.5 h-[1.5px] bg-focus-lost/40' : 'w-1.5 h-px bg-surface-border/80'} rounded-full`} />
                      {(ti === 0 || ti === 6) && (
                        <span className={`ml-1.5 font-mono text-[8px] tracking-wider uppercase ${ti === 0 ? 'text-lens-cyan/40' : 'text-focus-lost/30'}`}>
                          {ti === 0 ? 'f/1.4' : 'f/16'}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Version cards */}
                  <div className="space-y-7">
                    {[...data.versions].reverse().map((entry, idx, arr) => (
                      <TimelineVersionCard
                        key={entry._id}
                        entry={entry}
                        index={idx}
                        total={arr.length}
                        isHighlighted={highlightId === entry._id}
                        isLatest={idx === 0}
                        onSelect={() => setHighlightId((h) => (h === entry._id ? null : entry._id))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />
                <div className="text-center sm:text-left">
                  <p className="text-xs font-mono text-slate-400">// READY TO TEST YOUR LATEST EDITS?</p>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5">Mount a new revision to extend your calibration curve and track delta improvements.</p>
                </div>
                <Link href="/" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shrink-0">
                  <Plus size={14} />
                  <span>Mount New Revision</span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
