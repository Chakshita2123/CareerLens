'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, ChevronDown, ChevronUp, AlertCircle, Sparkles,
  Award, CheckCircle2, Link2, XCircle, ArrowRight, Loader2,
  Compass, Crosshair, Target
} from 'lucide-react'
import { useSelectedVersion, useUserId } from '@/lib/hooks'
import { getRecommendations, listVersions } from '@/lib/api'
import type { RoleRecommendation, ResumeVersion } from '@/lib/api'
import { ApertureGauge } from '@/components/ui/ApertureGauge'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { SkillChip } from '@/components/ui/SkillChip'
import { ApertureSpinner, SkeletonCard } from '@/components/ui/Skeleton'
import { ScanSweep } from '@/components/ui/ScanSweep'
import Link from 'next/link'

function scoreBadge(score: number) {
  if (score >= 70) {
    return {
      label: 'Focus Locked',
      bg: 'bg-focus-locked-dim text-focus-locked border-focus-locked/30',
      bar: 'from-lens-cyan via-lens-sapphire to-focus-locked',
    }
  }
  if (score >= 50) {
    return {
      label: 'Calibrating Fit',
      bg: 'bg-focus-calibrating-dim text-focus-calibrating border-focus-calibrating/30',
      bar: 'from-lens-sapphire to-focus-calibrating',
    }
  }
  return {
    label: 'Partial Focus',
    bg: 'bg-focus-lost-dim text-focus-lost border-focus-lost/30',
    bar: 'from-focus-calibrating to-focus-lost',
  }
}

function RoleCardContent({
  rec,
  index,
  isTop,
}: {
  rec: RoleRecommendation
  index: number
  isTop: boolean
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const badge = scoreBadge(rec.match_score)

  return (
    <div className={`card flex flex-col justify-between overflow-hidden transition-all duration-300 group relative
      ${
        isTop
          ? 'border-lens-cyan/50 bg-surface-card/95 shadow-[0_0_32px_rgba(0,240,255,0.15)]'
          : 'border-surface-border bg-surface-card/90 hover:border-lens-cyan/40 hover:bg-surface-card'
      }`}
    >
      {/* Top calibration progress line */}
      <div className="h-1 bg-surface-elevated overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${badge.bar} shadow-[0_0_8px_rgba(0,240,255,0.3)]`}
          initial={{ width: 0 }}
          animate={{ width: `${rec.match_score}%` }}
          transition={{ duration: 1, delay: index * 0.08, ease: 'easeOut' }}
        />
      </div>

      <div className="p-5 sm:p-6 space-y-5 flex-1 flex flex-col justify-between">
        {/* Card Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 border transition-all
                ${
                  isTop
                    ? 'bg-lens-cyan text-black border-lens-cyan shadow-[0_0_16px_rgba(0,240,255,0.5)]'
                    : 'bg-surface-elevated text-slate-400 border-surface-border group-hover:border-lens-cyan/40 group-hover:text-lens-cyan'
                }`}
              >
                #{index + 1}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-base sm:text-lg text-white leading-tight">
                    {rec.role_title}
                  </h3>
                  {isTop && (
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-lens-cyan bg-lens-cyan-dim border border-lens-cyan/40 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                      <Sparkles size={10} className="text-lens-cyan" />
                      PRIMARY FOCUS
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Aperture Score Gauge */}
            <div className="shrink-0 flex items-center justify-center">
              <ApertureGauge
                score={rec.match_score}
                size={84}
                strokeWidth={6}
                showApertureBlades={true}
                showCalibration={false}
              />
            </div>
          </div>

          {/* Gap Summary Callout */}
          <div className="bg-surface-elevated/70 border-l-2 border-lens-cyan p-3 rounded-lg border border-surface-border text-xs leading-relaxed text-slate-300 font-sans">
            <p className="font-medium">{rec.gap_summary}</p>
          </div>
        </div>

        {/* Skills Breakdown Section */}
        <div className="space-y-3 pt-2">
          {/* Matched Skills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <CheckCircle2 size={13} className="text-focus-locked" />
                <span>Focus Locked</span>
              </span>
              <span className="text-[11px] font-bold text-focus-locked tabular-nums">
                {rec.matched_skills.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rec.matched_skills.slice(0, expanded ? undefined : 6).map((skill) => (
                <SkillChip key={skill} skill={skill} variant="matched" />
              ))}
              {!expanded && rec.matched_skills.length > 6 && (
                <span className="text-[10px] font-mono text-slate-500 self-center">
                  +{rec.matched_skills.length - 6} more
                </span>
              )}
            </div>
          </div>

          {/* Missing Skills / Gaps */}
          {rec.missing_skills.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <XCircle size={13} className="text-focus-lost" />
                  <span>Optical Blindspots</span>
                </span>
                <span className="text-[11px] font-bold text-focus-lost tabular-nums">
                  {rec.missing_skills.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rec.missing_skills.slice(0, expanded ? undefined : 4).map((skill) => (
                  <SkillChip key={skill} skill={skill} variant="missing" />
                ))}
                {!expanded && rec.missing_skills.length > 4 && (
                  <span className="text-[10px] font-mono text-slate-500 self-center">
                    +{rec.missing_skills.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Related / Semantic Skills */}
          {expanded && rec.related_skills.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5 pt-1"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <Link2 size={13} className="text-lens-cyan" />
                  <span>Semantic Vector Hits</span>
                </span>
                <span className="text-[11px] font-bold text-lens-cyan tabular-nums">
                  {rec.related_skills.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rec.related_skills.map((item, idx) => (
                  <SkillChip key={idx} skill={item.resume_skill} variant="related" matchInfo={item} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Card Footer Toggle */}
        <div className="pt-3 border-t border-surface-border/80 flex items-center justify-between font-mono">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-lens-cyan hover:text-white transition-colors"
          >
            <span>{expanded ? 'Collapse Breakdown' : 'Inspect Full Reticle'}</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <Link
            href="/match"
            className="text-[11px] font-medium text-slate-500 hover:text-lens-cyan flex items-center gap-1 transition-colors"
          >
            <span>Test on JD</span>
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function RoleCard({
  rec,
  index,
}: {
  rec: RoleRecommendation
  index: number
}) {
  const isTop = index === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="h-full"
    >
      {isTop ? (
        <ViewfinderFrame tag="TOP FOCUS" active glow cornerSize="lg">
          <RoleCardContent rec={rec} index={index} isTop={isTop} />
        </ViewfinderFrame>
      ) : (
        <RoleCardContent rec={rec} index={index} isTop={isTop} />
      )}
    </motion.div>
  )
}

export default function RolesPage() {
  const userId = useUserId()
  const [versionId, setVersionId] = useSelectedVersion()
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<RoleRecommendation[] | null>(null)

  // Fetch available versions
  useEffect(() => {
    if (!userId) return
    let isMounted = true
    listVersions(userId)
      .then((res) => {
        if (isMounted) {
          setVersions(res)
          if (!versionId && res.length > 0) {
            setSelectedId(res[0]._id)
            setVersionId(res[0]._id)
          }
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [userId, versionId, setVersionId])

  useEffect(() => {
    if (versionId) setSelectedId(versionId)
  }, [versionId])

  const handleLoad = async () => {
    if (!selectedId) return
    setError(null)
    setLoading(true)
    try {
      const data = await getRecommendations(selectedId, 6)
      setRecs(data.recommendations)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)]">
      {/* Ambient optical glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-lens-cyan/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-mono font-semibold text-lens-cyan tracking-wider shadow-sm">
            <Compass size={13} className="text-lens-cyan" />
            <span>CALIBRATED ROLE BENCHMARK</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-gradient">
            Role Recommendations
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-sans">
            Your profile benchmarked against 25 calibrated industry roles to discover
            your sharpest career matches and actionable skill gaps.
          </p>
        </motion.div>

        {/* Action Panel Card with Viewfinder Framing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <ViewfinderFrame tag="ROLE-INDEXER" active={Boolean(selectedId)}>
            <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-7 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
              {versions.length > 1 ? (
                <div className="space-y-2 font-mono">
                  <label className="label text-[11px] text-slate-400 block">// RESUME VERSION TO BENCHMARK</label>
                  <div className="relative">
                    <select
                      value={selectedId}
                      onChange={(e) => {
                        setSelectedId(e.target.value)
                        setVersionId(e.target.value)
                      }}
                      className="w-full bg-surface-elevated/80 border border-surface-border rounded-xl
                                 px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-lens-cyan/60
                                 appearance-none cursor-pointer transition-colors"
                    >
                      {versions.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.version_label} (ATS: {v.ats_score?.overall_score ?? '—'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              ) : !selectedId ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-focus-calibrating-dim border border-focus-calibrating/30 text-focus-calibrating text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>Upload a resume first to benchmark roles.</span>
                  </div>
                  <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Upload Resume →
                  </Link>
                </div>
              ) : null}

              {selectedId && (
                <button
                  onClick={handleLoad}
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg group"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Scanning 25 Roles via Vector Embeddings…</span>
                    </>
                  ) : (
                    <>
                      <Compass size={16} className="group-hover:rotate-45 transition-transform duration-300" />
                      <span>{recs ? 'Re-calibrate Role Fits' : 'Benchmark Role Fits'}</span>
                    </>
                  )}
                </button>
              )}

              {error && (
                <div className="flex items-center gap-2 text-focus-lost text-xs p-3 bg-focus-lost-dim border border-focus-lost/30 rounded-xl font-mono">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </ViewfinderFrame>
        </motion.div>

        {/* Loading State with ScanSweep and Iris Spinner */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl mx-auto">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <ApertureSpinner size={52} />
              </div>
              <p className="text-sm font-display font-semibold text-lens-cyan">Auditing Taxonomy Vectors…</p>
              <p className="text-xs font-mono text-slate-500 animate-pulse">Running semantic skill matching & cosine distance across 25 curated roles</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} lines={3} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Populated Results Grid */}
        <AnimatePresence>
          {recs && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 max-w-5xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-surface-border pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <Award size={18} className="text-lens-cyan" />
                    Top Calibrated Role Matches
                  </h2>
                  <p className="text-xs font-mono text-slate-400">Ranked by combined skill overlap (60%) & semantic cosine similarity (40%)</p>
                </div>
                <span className="text-xs font-mono font-semibold text-lens-cyan bg-lens-cyan-dim px-3 py-1 rounded-full border border-lens-cyan/30">
                  {recs.length} ROLES BENCHMARKED
                </span>
              </div>

              {/* 2-Column Responsive Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recs.map((rec, idx) => (
                  <RoleCard key={rec.role_title} rec={rec} index={idx} />
                ))}
              </div>

              {/* Bottom Next Step Callout */}
              <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

                <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
                  // READY TO MATCH YOUR RESUME AGAINST A SPECIFIC TARGET POSTING?
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/match" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                    <span>Try Job Match Analyzer</span>
                    <ArrowRight size={13} />
                  </Link>

                  <Link href="/improve" className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5">
                    <span>Enhance Weak Bullets</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
