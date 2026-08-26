'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, AlertCircle, TrendingUp, TrendingDown, Minus,
  Sparkles, Calendar, FileText, ArrowRight, RefreshCw,
  Clock, CheckCircle2, Target, Zap, Plus, Compass, Crosshair
} from 'lucide-react'
import { useUserId, useSelectedVersion } from '@/lib/hooks'
import { getComparison } from '@/lib/api'
import type { ComparisonEntry, ComparisonResponse } from '@/lib/api'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceDot,
} from 'recharts'
import { ApertureGauge } from '@/components/ui/ApertureGauge'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { SkeletonCard } from '@/components/ui/Skeleton'
import Link from 'next/link'

function DeltaBadge({ value, label = 'ATS' }: { value: number | null; label?: string }) {
  if (value === null) {
    return (
      <span className="font-mono text-[10px] font-medium text-slate-500 bg-surface-elevated px-2 py-0.5 rounded border border-surface-border">
        BASELINE
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-focus-locked bg-focus-locked-dim px-2.5 py-0.5 rounded-full border border-focus-locked/30">
        <TrendingUp size={12} />
        <span>+{value} {label}</span>
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-focus-lost bg-focus-lost-dim px-2.5 py-0.5 rounded-full border border-focus-lost/30">
        <TrendingDown size={12} />
        <span>{value} {label}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-slate-400 bg-surface-elevated px-2.5 py-0.5 rounded-full border border-surface-border">
      <Minus size={12} />
      <span>0 {label}</span>
    </span>
  )
}

function TimelineVersionCard({
  entry,
  isHighlighted,
  onSelect,
  index,
  isLatest,
}: {
  entry: ComparisonEntry
  isHighlighted: boolean
  onSelect: () => void
  index: number
  isLatest: boolean
}) {
  const dateStr = new Date(entry.uploaded_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = new Date(entry.uploaded_at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      id={`version-${entry._id}`}
      onClick={onSelect}
      className="relative pl-8 sm:pl-10 group cursor-pointer"
    >
      {/* Optical Timeline Reticle Node */}
      <div
        className={`absolute left-0 top-6 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-300 z-10
          ${
            isHighlighted
              ? 'bg-lens-cyan text-black border-lens-cyan shadow-[0_0_18px_rgba(0,240,255,0.7)] scale-110'
              : isLatest
              ? 'bg-focus-locked text-black border-focus-locked shadow-[0_0_14px_rgba(0,230,118,0.5)]'
              : 'bg-surface-elevated text-slate-400 border-surface-border group-hover:border-lens-cyan/60 group-hover:text-lens-cyan'
          }`}
      >
        {isLatest ? '★' : index + 1}
      </div>

      {/* Main Card Container with Viewfinder Frame */}
      <ViewfinderFrame
        tag={isLatest ? 'LATEST REVISION' : `CAL-REV #${index + 1}`}
        active={isHighlighted || isLatest}
        cornerSize="sm"
      >
        <div
          className={`card p-5 sm:p-6 transition-all duration-300 space-y-4
            ${
              isHighlighted
                ? 'border-lens-cyan/60 bg-surface-card shadow-[0_0_32px_rgba(0,240,255,0.18)] scale-[1.01]'
                : isLatest
                ? 'border-lens-cyan/40 bg-surface-card/95'
                : 'border-surface-border bg-surface-card/85 hover:border-lens-cyan/40 hover:bg-surface-card'
            }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-lens-cyan/70" />
                  <span>{dateStr} at {timeStr}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-slate-400 truncate max-w-[200px]">
                  <FileText size={12} />
                  <span>{entry.raw_filename}</span>
                </span>
              </div>
            </div>

            {/* Scores & Deltas Container */}
            <div className="flex items-center gap-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    ATS DELTA
                  </div>
                  <DeltaBadge value={entry.delta.ats_delta} label="pts" />
                </div>
                <ApertureGauge
                  score={entry.overall_ats_score}
                  size={76}
                  strokeWidth={6}
                  showApertureBlades={true}
                  showCalibration={false}
                />
              </div>

              {entry.latest_job_match_score !== null && (
                <div className="border-l border-surface-border pl-4 text-center font-mono">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    JOB MATCH
                  </div>
                  <div className="font-extrabold text-base text-focus-locked tabular-nums">
                    {entry.latest_job_match_score}
                  </div>
                  {entry.delta.match_score_delta !== null && (
                    <span className={`text-[10px] font-bold ${entry.delta.match_score_delta >= 0 ? 'text-focus-locked' : 'text-focus-lost'}`}>
                      {entry.delta.match_score_delta >= 0 ? `+${entry.delta.match_score_delta}` : entry.delta.match_score_delta}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Bar on Card */}
          <div className="pt-3 border-t border-surface-border/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <span className="text-slate-400">
              {entry.delta.ats_delta !== null && entry.delta.ats_delta > 0
                ? `🚀 Gained +${entry.delta.ats_delta} ATS points from previous iteration.`
                : 'Calibration snapshot preserved in session index.'}
            </span>

            <div className="flex items-center gap-3">
              <Link
                href="/match"
                className="text-lens-cyan hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <Target size={12} />
                <span>Test Match</span>
              </Link>
              <Link
                href="/improve"
                className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 transition-colors"
              >
                <Zap size={12} />
                <span>Enhance Bullets</span>
              </Link>
            </div>
          </div>
        </div>
      </ViewfinderFrame>
    </motion.div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
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
        {item?.label && (
          <span className="font-mono text-[10px] text-slate-400 truncate block max-w-[200px]">{item.label}</span>
        )}
      </div>

      <div className="space-y-1.5 pt-1 border-t border-surface-border font-mono">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-slate-300 font-medium">{p.name}:</span>
            </div>
            <span className="font-bold tabular-nums" style={{ color: p.color }}>
              {p.value} / 100
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

  // Automatically fetch on mount if userId is available
  useEffect(() => {
    if (userId) handleLoad()
  }, [userId, handleLoad])

  // Chart data — chronological (oldest to newest)
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

  // Statistical calculations
  const totalVersions = data?.total_versions ?? 0
  const allAts = data?.versions.map((v) => v.overall_ats_score) ?? []
  const bestAts = allAts.length > 0 ? Math.max(...allAts) : 0
  const firstAts = allAts.length > 0 ? allAts[0] : 0
  const latestAts = allAts.length > 0 ? allAts[allAts.length - 1] : 0
  const totalGrowth = latestAts - firstAts

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)]">
      {/* Ambient optical glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-lens-cyan/10 blur-[140px] rounded-full pointer-events-none -z-10" />

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
            Compare versions side-by-side to ensure every adjustment sharpens your profile focus.
          </p>
        </motion.div>

        {/* Loading Skeletons */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-4 space-y-2">
                  <div className="shimmer h-6 w-16 rounded-md" />
                  <div className="shimmer h-3 w-20 rounded" />
                </div>
              ))}
            </div>
            <div className="card p-6 h-64 shimmer rounded-2xl" />
            {[1, 2].map((i) => <SkeletonCard key={i} lines={3} />)}
          </motion.div>
        )}

        {/* Error / Empty State with Viewfinder Frame */}
        {error && (
          <div className="max-w-md mx-auto">
            <ViewfinderFrame tag="ARCHIVE-EMPTY">
              <div className="card p-8 text-center space-y-4 border-surface-border bg-surface-card/95">
                <div className="w-12 h-12 rounded-xl bg-lens-cyan-dim border border-lens-cyan/30 flex items-center justify-center mx-auto text-lens-cyan shadow-[0_0_16px_rgba(0,240,255,0.3)]">
                  <Compass size={24} />
                </div>
                <h3 className="font-display font-bold text-white text-base">No Saved Iterations Found</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Upload your first resume to start tracking ATS score progression and calibration deltas over time.
                </p>
                <Link href="/" className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
                  <Plus size={14} />
                  <span>Mount First Resume</span>
                </Link>
              </div>
            </ViewfinderFrame>
          </div>
        )}

        {/* Populated State */}
        <AnimatePresence>
          {data && !loading && totalVersions > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-10 max-w-4xl mx-auto"
            >
              {/* Single Version Tip Banner */}
              {totalVersions === 1 && (
                <div className="p-4 rounded-2xl bg-lens-cyan-dim border border-lens-cyan/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Sparkles size={16} className="text-lens-cyan shrink-0" />
                    <span>
                      You have <strong>1 saved calibration</strong>. Upload an improved revision (e.g. after sharpening action verbs) to view your progression curve!
                    </span>
                  </div>
                  <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Upload v2 →
                  </Link>
                </div>
              )}

              {/* KPI Stat Cards with Optical Styling */}
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
                ].map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="card p-4 space-y-1.5 bg-surface-card/90 border-surface-border relative group">
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-current opacity-20 group-hover:opacity-100" />
                      <div className="flex items-center justify-between text-slate-400 font-mono">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">{stat.label}</span>
                        <Icon size={14} className={stat.color} />
                      </div>
                      <div className={`text-2xl font-mono font-extrabold tabular-nums ${stat.color}`}>
                        {stat.value}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Score Progression Area Chart */}
              {chartData.length > 1 && (
                <ViewfinderFrame tag="PROGRESSION-CURVE">
                  <div className="card p-6 sm:p-7 space-y-5 bg-surface-card/95 shadow-2xl border-surface-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                      <div>
                        <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                          <TrendingUp size={16} className="text-lens-cyan" />
                          <span>Optical Score Progression Curve</span>
                        </h2>
                        <p className="text-[11px] font-mono text-slate-500">Click any node on the curve to inspect that iteration below</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                        <div className="flex items-center gap-1.5 text-lens-cyan">
                          <span className="w-2.5 h-2.5 rounded-full bg-lens-cyan shadow-[0_0_6px_#00f0ff]" />
                          <span>ATS Compatibility</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-focus-locked">
                          <span className="w-2.5 h-2.5 rounded-full bg-focus-locked shadow-[0_0_6px_#00e676]" />
                          <span>Job Match</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-64 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                          <defs>
                            <linearGradient id="colorAts" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorMatch" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#00e676" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#182232" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'monospace' }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'monospace' }} />
                          <RechartsTooltip content={<CustomTooltip />} />

                          <Area
                            type="monotone"
                            dataKey="ATS"
                            stroke="#00f0ff"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorAts)"
                            dot={{ r: 5, fill: '#00f0ff', strokeWidth: 2, stroke: '#06070a' }}
                            activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                          />

                          <Area
                            type="monotone"
                            dataKey="Match"
                            stroke="#00e676"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorMatch)"
                            dot={{ r: 5, fill: '#00e676', strokeWidth: 2, stroke: '#06070a' }}
                            activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls
                          />

                          {highlightId && (() => {
                            const idx = chartData.findIndex((d) => d.id === highlightId)
                            if (idx < 0) return null
                            return (
                              <ReferenceDot
                                x={chartData[idx].name}
                                y={chartData[idx].ATS}
                                r={11}
                                fill="rgba(0,240,255,0.3)"
                                stroke="#00f0ff"
                                strokeWidth={2}
                              />
                            )
                          })()}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </ViewfinderFrame>
              )}

              {/* Vertical Calibration Timeline of Version Cards */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <Clock size={16} className="text-lens-cyan" />
                    <span>Calibration Timeline</span>
                  </h2>
                  <button
                    onClick={handleLoad}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 font-mono"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Timeline stem line with calibration ticks */}
                <div className="relative border-l-2 border-surface-border/80 ml-3.5 space-y-6 pb-2">
                  {[...data.versions].reverse().map((entry, idx) => (
                    <TimelineVersionCard
                      key={entry._id}
                      entry={entry}
                      index={idx}
                      isHighlighted={highlightId === entry._id}
                      isLatest={idx === 0}
                      onSelect={() => setHighlightId((h) => (h === entry._id ? null : entry._id))}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Upload New Version CTA */}
              <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

                <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
                  // READY TO TEST YOUR LATEST EDITS? MOUNT A NEW VERSION TO UPDATE YOUR PROGRESSION.
                </div>

                <Link href="/" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
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
