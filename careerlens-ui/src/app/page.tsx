'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, CheckCircle2, ChevronDown, ChevronUp, AlertCircle,
  Sparkles, Shield, Target, Briefcase, Zap, ArrowRight, Layers, FileCheck,
  Scan, Crosshair, Eye, Compass, Sliders, Download, Loader2
} from 'lucide-react'
import { useUserId, useSelectedVersion } from '@/lib/hooks'
import { uploadResume, downloadPdfReport } from '@/lib/api'
import type { ResumeVersion, ATSBreakdownItem } from '@/lib/api'
import { ApertureGauge } from '@/components/ui/ApertureGauge'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { ScanSweep } from '@/components/ui/ScanSweep'
import { SkeletonRing, SkeletonCard } from '@/components/ui/Skeleton'
import Link from 'next/link'

function scoreColor(ratio: number) {
  if (ratio >= 0.7) return 'bg-focus-locked-dim border-focus-locked/30 text-focus-locked'
  if (ratio >= 0.45) return 'bg-focus-calibrating-dim border-focus-calibrating/30 text-focus-calibrating'
  return 'bg-focus-lost-dim border-focus-lost/30 text-focus-lost'
}

function BreakdownCard({ item }: { item: ATSBreakdownItem }) {
  const [open, setOpen] = useState(false)
  const ratio = item.score / item.max_score
  const pct = Math.round(ratio * 100)
  const color = scoreColor(ratio)

  return (
    <motion.div
      layout
      className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${color} hover:opacity-95 relative group`}
      onClick={() => setOpen(o => !o)}
    >
      {/* Corner optical ticks */}
      <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-current opacity-40 group-hover:opacity-100" />
      <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-current opacity-40 group-hover:opacity-100" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold text-sm truncate tracking-wide">{item.category}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono text-xs font-bold tabular-nums">{item.score}/{item.max_score}</span>
          <div className="w-16 h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-current transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs mt-3 leading-relaxed opacity-90 border-t border-current/20 pt-2.5 font-sans"
          >
            {item.feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const FEATURE_PILLARS = [
  {
    icon: Crosshair,
    title: 'ATS Optical Scoring',
    badge: 'Deterministic',
    desc: 'Multi-point structural analysis auditing contact completeness, heading readability, metrics, and density.',
    tag: 'FOCAL-01',
  },
  {
    icon: Layers,
    title: 'Semantic Vector Lens',
    badge: 'MiniLM Embeddings',
    desc: 'Understands conceptual relationships beyond literal strings. Connects Kubernetes to Cloud & PostgreSQL to SQL.',
    tag: 'FOCAL-02',
  },
  {
    icon: Compass,
    title: 'Curated Role Bank',
    badge: '25+ Tech Roles',
    desc: 'Benchmarks your profile against calibrated industry specs spanning Engineering, Cloud, Data, and AI.',
    tag: 'FOCAL-03',
  },
  {
    icon: Zap,
    title: 'Grounded Bullet Enhancer',
    badge: 'Gemini / Groq',
    desc: 'Brings weak lines into sharp focus with strong action verbs and metric placeholders, strictly zero hallucination.',
    tag: 'FOCAL-04',
  },
]

const WORKFLOW_STEPS = [
  { step: '01', title: 'Mount & Scan', desc: 'Drop your PDF or DOCX file. Optical parser extracts sections, skills & experience.' },
  { step: '02', title: 'Calibrate & Focus', desc: 'Get a comprehensive ATS aperture readout and identify structural blindspots.' },
  { step: '03', title: 'Align with Target JD', desc: 'Run semantic vector matching and sharpen bullets for maximum interview impact.' },
]

export default function UploadPage() {
  const userId = useUserId()
  const [, setVersionId] = useSelectedVersion()

  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResumeVersion | null>(null)
  const [label, setLabel] = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const handleDownloadPdf = async () => {
    if (!result?._id) return
    setDownloadingPdf(true)
    setPdfError(null)
    try {
      await downloadPdfReport(result._id)
    } catch (e: unknown) {
      setPdfError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return
      if (!userId) {
        setError('User session not ready — please refresh the page and try again.')
        return
      }
      setError(null)
      setLoading(true)
      try {
        const versionLabel = label.trim() || `v${Date.now().toString().slice(-4)} — ${file.name}`
        const data = await uploadResume(file, userId, versionLabel)
        setResult(data)
        setVersionId(data._id)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setLoading(false)
      }
    },
    [userId, label, setVersionId]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const ats = result?.ats_score

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)]">
      {/* Optical Ambient Flare */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[380px] bg-lens-cyan/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-96 right-1/4 w-[420px] h-[260px] bg-lens-violet/5 blur-[110px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 max-w-3xl mx-auto"
        >
          {/* HUD Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-mono font-semibold text-lens-cyan tracking-wider shadow-sm hover:border-lens-cyan/40 transition-colors">
            <Scan size={13} className="text-lens-cyan animate-pulse" />
            <span>OPTICAL ATS INTELLIGENCE & MATCHING</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-gradient leading-[1.12]">
            See Your Resume Through the Recruiter&apos;s Lens
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto font-sans">
            Instant camera-aperture ATS scoring, semantic vector job matching,
            and precision AI enhancements engineered to get your profile noticed.
          </p>

          <div className="flex items-center justify-center gap-6 pt-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield size={13} className="text-focus-locked" /> [LOCAL-SANDBOX]
            </span>
            <span className="flex items-center gap-1.5">
              <FileCheck size={13} className="text-lens-cyan" /> [PDF/DOCX PARSER]
            </span>
          </div>
        </motion.div>

        {/* Upload Container Card with Viewfinder Framing */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          <ViewfinderFrame tag={loading ? 'SCANNING' : 'VIEWFINDER-01'} active={dragging || loading} glow={dragging}>
            <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-8 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-5 relative">
              
              {/* Optional Version Label Input */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Optional version label — e.g. 'v2: added AWS & Docker'"
                  className="flex-1 bg-surface-elevated/70 border border-surface-border rounded-xl px-4 py-2.5
                             text-sm text-slate-200 placeholder:text-slate-500 outline-none
                             focus:border-lens-cyan/60 focus:bg-surface-elevated font-mono text-xs transition-all"
                />
              </div>

              {/* Interactive Dropzone with Laser Scan Beam */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !loading && document.getElementById('file-input')?.click()}
                className={`relative flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-xl
                            border-2 border-dashed transition-all duration-300 cursor-pointer group overflow-hidden
                            ${dragging
                              ? 'border-lens-cyan bg-lens-cyan-dim scale-[1.01] shadow-[0_0_24px_rgba(0,240,255,0.25)]'
                              : 'border-surface-border hover:border-lens-cyan/50 hover:bg-surface-elevated/40'
                            }`}
              >
                {/* Laser Scan Sweep Animation when loading */}
                <ScanSweep active={loading} label="PARSING RESUME SECTIONS & ATS METRICS…" />

                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />

                {/* Aperture / Upload Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 relative
                                 ${dragging
                                   ? 'bg-lens-cyan text-black scale-110 shadow-[0_0_24px_rgba(0,240,255,0.7)]'
                                   : 'bg-surface-elevated text-slate-400 group-hover:text-lens-cyan group-hover:scale-105 group-hover:bg-lens-cyan-dim border border-surface-border group-hover:border-lens-cyan/40'
                                 }`}>
                  <Upload size={28} className="transition-transform group-hover:-translate-y-0.5 duration-200" />
                  {/* Small optical reticle tick */}
                  <span className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-lens-cyan opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="text-center space-y-1.5">
                  <p className="font-display font-semibold text-slate-200 text-base">
                    Drag & drop your resume, or <span className="text-lens-cyan underline decoration-lens-cyan/40 underline-offset-4 group-hover:decoration-lens-cyan">browse files</span>
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500 pt-1">
                    <span className="px-2 py-0.5 rounded bg-surface-elevated border border-surface-border">[PDF]</span>
                    <span className="px-2 py-0.5 rounded bg-surface-elevated border border-surface-border">[DOCX]</span>
                    <span>·</span>
                    <span>MAX 10 MB</span>
                  </div>
                </div>
              </div>
            </div>
          </ViewfinderFrame>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto flex items-center gap-3 bg-focus-lost-dim border border-focus-lost/30
                       rounded-2xl px-5 py-4 text-focus-lost text-sm shadow-md font-mono"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-1.5">
              <p className="text-sm font-display font-semibold text-lens-cyan">Auditing Resume Optical Structure…</p>
              <p className="text-xs font-mono text-slate-500 animate-pulse">
                Parsing layout, calculating f-stop compatibility, and indexing keyword weights
              </p>
            </div>
            <div className="flex justify-center py-4">
              <SkeletonRing />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={2} />)}
            </div>
          </motion.div>
        )}

        {/* Upload Result / ATS Aperture Analysis Hero */}
        <AnimatePresence>
          {ats && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 max-w-4xl mx-auto"
            >
              {/* Main Score Hero Card with Viewfinder Frame */}
              <ViewfinderFrame tag="ATS-ANALYSIS" cornerSize="lg" active>
                <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-8 rounded-2xl shadow-2xl">
                  
                  {/* Aperture Iris Score Gauge */}
                  <div className="shrink-0">
                    <ApertureGauge
                      score={ats.overall_score}
                      size={190}
                      label="Overall ATS Score"
                      sublabel="Aperture Calibrated"
                    />
                  </div>

                  <div className="flex-1 space-y-4 text-center sm:text-left">
                    <div>
                      <div className="inline-flex items-center gap-2 mb-1 px-2.5 py-1 rounded-lg bg-surface-elevated border border-surface-border font-mono">
                        <FileText size={14} className="text-lens-cyan" />
                        <span className="text-xs font-semibold text-slate-300 truncate">
                          {result?.raw_filename}
                        </span>
                      </div>

                      <p className="text-slate-300 text-sm leading-relaxed mt-2 font-sans">
                        {ats.overall_score >= 70
                          ? 'Focus locked! Your formatting, structure, and keyword density are exceptionally sharp.'
                          : ats.overall_score >= 45
                          ? 'Moderate optical clarity. Solid foundation with clear tuning needed in metrics or headers.'
                          : 'Significant optical blur detected. Structural formatting gaps are hindering ATS parsers.'}
                      </p>
                    </div>

                    {ats.top_issues.length > 0 && (
                      <div className="space-y-2 text-left bg-surface-elevated/60 p-3.5 rounded-xl border border-surface-border font-mono">
                        <p className="label text-[10px] text-slate-400">OPTICAL BLINDSPOTS DETECTED</p>
                        {ats.top_issues.slice(0, 3).map((issue, i) => (
                          <div key={i} className="flex gap-2 text-xs text-slate-300">
                            <span className="text-focus-lost font-bold shrink-0">▸</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2 hover:border-lens-cyan/50 hover:text-white group"
                      >
                        {downloadingPdf ? (
                          <>
                            <Loader2 size={15} className="animate-spin text-lens-cyan" />
                            <span>Generating PDF…</span>
                          </>
                        ) : (
                          <>
                            <Download size={15} className="text-lens-cyan group-hover:scale-110 transition-transform" />
                            <span>Download PDF Report</span>
                          </>
                        )}
                      </button>

                      <Link href="/match" className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
                        <span>Match against Target JD</span>
                        <ArrowRight size={14} />
                      </Link>
                      <Link href="/roles" className="btn-secondary text-sm py-2.5 px-5">
                        Explore Calibrated Roles
                      </Link>
                    </div>

                    {pdfError && (
                      <div className="text-xs text-focus-lost font-mono bg-focus-lost-dim border border-focus-lost/30 p-2.5 rounded-lg flex items-center gap-2">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{pdfError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </ViewfinderFrame>

              {/* Category Breakdown Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg flex items-center gap-2 text-white">
                    <CheckCircle2 size={18} className="text-lens-cyan" />
                    Diagnostic Breakdown by Layer
                  </h2>
                  <span className="text-xs font-mono text-slate-500">Click any card to expand feedback</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ats.breakdown.map(item => (
                    <BreakdownCard key={item.category} item={item} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Highlights Grid — Visible when no upload result is active */}
        {!ats && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-12 pt-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-white">
                Engineered for Complete Profile Clarity
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto font-sans">
                Purpose-built intelligence pipeline combining deterministic parsing, vector embeddings, and LLM reasoning.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURE_PILLARS.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + idx * 0.08 }}
                    className="card p-5 space-y-3 flex flex-col justify-between hover:border-lens-cyan/50 hover:bg-surface-card/95 transition-all duration-300 group relative"
                  >
                    {/* Viewfinder corner ticks */}
                    <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-lens-cyan opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-lens-cyan opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-lens-cyan-dim border border-lens-cyan/30 text-lens-cyan flex items-center justify-center group-hover:scale-105 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all">
                          <Icon size={18} />
                        </div>
                        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400 bg-surface-elevated px-2 py-0.5 rounded border border-surface-border">
                          {feature.tag}
                        </span>
                      </div>

                      <h3 className="font-display font-semibold text-sm text-white group-hover:text-lens-cyan transition-colors">
                        {feature.title}
                      </h3>

                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        {feature.desc}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* How It Works Workflow Strip */}
            <div className="card p-6 sm:p-8 bg-surface-card/60 backdrop-blur-sm space-y-6 border-surface-border/80 relative">
              <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-lens-cyan/50" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-lens-cyan/50" />

              <h3 className="text-xs font-mono font-semibold text-lens-cyan uppercase tracking-widest text-center">
                // OPTICAL WORKFLOW PIPELINE
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                {WORKFLOW_STEPS.map((step) => (
                  <div key={step.step} className="space-y-2 text-center sm:text-left">
                    <div className="text-2xl font-black text-lens-cyan/30 font-mono">
                      {step.step}
                    </div>
                    <div className="font-display font-bold text-sm text-white">
                      {step.title}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
