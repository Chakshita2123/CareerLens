'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Copy, Check, AlertCircle, Sparkles, CheckCircle2,
  ChevronDown, ArrowRight, Loader2, RefreshCw, FileText, CheckCheck,
  Crosshair, Sliders
} from 'lucide-react'
import { useSelectedVersion, useUserId } from '@/lib/hooks'
import { improveBullets, listVersions } from '@/lib/api'
import type { BulletImprovement, ResumeVersion } from '@/lib/api'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { ApertureSpinner, SkeletonCard } from '@/components/ui/Skeleton'
import Link from 'next/link'

const PROVIDER_BADGE: Record<string, { label: string; cls: string }> = {
  gemini: { label: 'Gemini 1.5 Flash', cls: 'bg-lens-cyan-dim text-lens-cyan border-lens-cyan/30' },
  groq:   { label: 'Groq Llama-3',     cls: 'bg-lens-violet-dim text-lens-violet border-lens-violet/30' },
  mock:   { label: 'Rule Calibrator',  cls: 'bg-surface-elevated text-slate-400 border-surface-border' },
}

/**
 * Highlight bracketed placeholders like [X]%, [N units], [describe outcome]
 * with distinct styling so the user immediately knows to fill in their real metrics.
 */
function renderHighlightedText(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span
          key={i}
          className="inline-block bg-focus-calibrating-dim text-focus-calibrating border border-dashed border-focus-calibrating/60
                     px-1.5 py-0.5 rounded font-mono font-semibold text-xs mx-0.5"
          title="Replace this placeholder with your real metric"
        >
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function BulletCard({ item, index }: { item: BulletImprovement; index: number }) {
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [copied, setCopied] = useState(false)

  const currentSuggestion = item.suggestions[selectedSuggestion] || item.suggestions[0] || ''

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const provider = PROVIDER_BADGE[item.provider] ?? PROVIDER_BADGE.mock

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <ViewfinderFrame tag={`AUDIT #${index + 1}`} cornerSize="sm">
        <div className="card overflow-hidden border-surface-border bg-surface-card/95 shadow-xl transition-all">
          
          {/* Context & Weakness Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-surface-border bg-surface-elevated/70">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={13} className="text-lens-cyan shrink-0" />
              <span className="font-mono text-xs font-semibold text-slate-300 truncate">{item.context}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0 font-mono">
              {item.issues.map((issue) => (
                <span
                  key={issue}
                  className="text-[9px] font-bold text-focus-lost bg-focus-lost-dim border border-focus-lost/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                >
                  {issue}
                </span>
              ))}

              <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${provider.cls}`}>
                {provider.label}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Side-by-Side 2-Column (Desktop) / Stacked (Mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              
              {/* 1. Original Bullet */}
              <div className="flex flex-col justify-between space-y-2 bg-surface-elevated/50 border border-surface-border rounded-2xl p-4 relative">
                <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-focus-lost" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      // ORIGINAL BULLET (OUT OF FOCUS)
                    </span>
                    <span className="font-mono text-[9px] font-semibold text-focus-lost bg-focus-lost-dim border border-focus-lost/30 px-2 py-0.5 rounded">
                      Weak
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed italic font-sans">
                    &ldquo;{item.original}&rdquo;
                  </p>
                </div>
                <div className="pt-2 text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-focus-lost" />
                  <span>Needs stronger action verbs or measurable impact</span>
                </div>
              </div>

              {/* 2. Suggested Rewrite (Hero Option) */}
              <div className="flex flex-col justify-between space-y-3 bg-lens-cyan-dim border border-lens-cyan/40 rounded-2xl p-4 shadow-[0_0_24px_rgba(0,240,255,0.1)] relative">
                <span className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-lens-cyan" />
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-lens-cyan" />
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-lens-cyan">
                        // AI FOCUSED REWRITE
                      </span>
                      <span className="font-mono text-[9px] font-bold text-focus-locked bg-focus-locked-dim border border-focus-locked/30 px-2 py-0.5 rounded">
                        Sharp
                      </span>
                    </div>

                    {/* Switcher if multiple suggestions */}
                    {item.suggestions.length > 1 && (
                      <div className="flex items-center gap-1 bg-surface-card/90 border border-surface-border rounded-lg p-0.5">
                        {item.suggestions.map((_, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => setSelectedSuggestion(sIdx)}
                            className={`px-2 py-0.5 font-mono text-[9px] font-bold rounded transition-all ${
                              selectedSuggestion === sIdx
                                ? 'bg-lens-cyan text-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Opt {sIdx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rewritten Text with highlighted metric placeholders */}
                  <div className="text-sm font-medium text-slate-100 leading-relaxed font-sans">
                    {renderHighlightedText(currentSuggestion)}
                  </div>
                </div>

                {/* Copy CTA */}
                <div className="pt-3 border-t border-lens-cyan/20 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Sparkles size={11} className="text-lens-cyan" />
                    <span>Ready to mount into resume</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => copy(currentSuggestion)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all duration-200 ${
                      copied
                        ? 'bg-focus-locked text-black shadow-[0_0_14px_rgba(0,230,118,0.5)] scale-95'
                        : 'bg-lens-cyan hover:bg-lens-cyan text-black shadow-[0_0_14px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95'
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckCheck size={13} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Focus Line</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Note from Model */}
            {item.note && (
              <div className="flex items-start gap-2 text-xs text-slate-400 border-t border-surface-border/70 pt-3 font-sans">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-lens-cyan" />
                <p className="leading-relaxed">{item.note}</p>
              </div>
            )}
          </div>
        </div>
      </ViewfinderFrame>
    </motion.div>
  )
}

export default function ImprovePage() {
  const userId = useUserId()
  const [versionId, setVersionId] = useSelectedVersion()
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ total: number; weak: number; items: BulletImprovement[] } | null>(null)

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

  const handleImprove = async () => {
    if (!selectedId) return
    setError(null)
    setLoading(true)
    try {
      const data = await improveBullets(selectedId)
      setResult({
        total: data.total_bullets_checked,
        weak: data.weak_bullets_found,
        items: data.improvements,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate bullet improvements')
    } finally {
      setLoading(false)
    }
  }

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
            <Zap size={13} className="text-lens-cyan" />
            <span>GROUNDED AI LENS ENHANCER</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-gradient">
            Bullet Point Enhancements
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-sans">
            Bring vague, passive, or metric-free bullet points into sharp focus with strong action verbs and placeholder metrics.
            Zero hallucinated tools or fabricated statistics.
          </p>
        </motion.div>

        {/* Action Panel Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <ViewfinderFrame tag="BULLET-AUDITOR" active={Boolean(selectedId)}>
            <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-7 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
              {versions.length > 1 ? (
                <div className="space-y-2 font-mono">
                  <label className="label text-[11px] text-slate-400 block">// RESUME VERSION TO AUDIT</label>
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
                    <span>Upload a resume first to run bullet point audits.</span>
                  </div>
                  <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Upload Resume →
                  </Link>
                </div>
              ) : null}

              {selectedId && (
                <button
                  onClick={handleImprove}
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg group"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Auditing Weak Experience Lines via Gemini / Groq…</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="group-hover:scale-110 transition-transform" />
                      <span>{result ? 'Re-audit Bullet Points' : 'Scan & Focus Weak Bullets'}</span>
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

        {/* Loading State with Iris Spinner */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <ApertureSpinner size={52} />
              </div>
              <p className="text-sm font-display font-semibold text-lens-cyan">Auditing Action Verbs & Quantifiable Scope…</p>
              <p className="text-xs font-mono text-slate-500 animate-pulse">Running grounded LLM rewrites on flagged weak statements</p>
            </div>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </motion.div>
        )}

        {/* Results State */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 max-w-4xl mx-auto"
            >
              {/* Summary Stats Header Bar */}
              <div className="card p-5 bg-surface-card/95 flex flex-wrap items-center justify-between gap-4 border-surface-border font-mono relative">
                <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-lens-cyan" />
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-lens-cyan" />

                <div className="flex items-center gap-4">
                  <div className="text-xs">
                    <span className="text-slate-500">BULLETS SCANNED: </span>
                    <span className="font-bold text-white tabular-nums">{result.total}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">BLINDSPOTS FLAGGED: </span>
                    <span className="font-bold text-focus-lost tabular-nums">{result.weak}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImprove}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>Re-audit</span>
                  </button>
                </div>
              </div>

              {/* Positive Empty State if 0 weak bullets */}
              {result.weak === 0 ? (
                <ViewfinderFrame tag="ALL-SHARP">
                  <div className="card p-10 text-center space-y-4 border-focus-locked/30 bg-focus-locked-dim/20">
                    <div className="w-16 h-16 rounded-full bg-focus-locked-dim border border-focus-locked/40 flex items-center justify-center mx-auto text-focus-locked shadow-[0_0_24px_rgba(0,230,118,0.4)]">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">All Bullets in Sharp Focus! 🎉</h3>
                    <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed font-sans">
                      Every bullet point in your resume incorporates strong, proactive action verbs and quantifiable metrics.
                      Your experience statements are already well-optimized for ATS and recruiters.
                    </p>
                    <div className="pt-2">
                      <Link href="/match" className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
                        <span>Test on Job Match</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </ViewfinderFrame>
              ) : (
                /* List of Weak Bullet Improvement Cards */
                <div className="space-y-5">
                  {result.items.map((item, idx) => (
                    <BulletCard key={idx} item={item} index={idx} />
                  ))}
                </div>
              )}

              {/* Bottom Navigation Strip */}
              <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

                <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
                  // FINISHED UPDATING YOUR RESUME WITH IMPROVED BULLETS?
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                    <span>Mount New Revision</span>
                    <ArrowRight size={13} />
                  </Link>

                  <Link href="/comparison" className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5">
                    <span>Track Calibration History</span>
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
