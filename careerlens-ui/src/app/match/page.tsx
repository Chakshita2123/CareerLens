'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertCircle, Sparkles, ChevronRight,
  ChevronDown, ChevronUp, CheckCircle2, Link2, XCircle,
  ArrowRight, Briefcase, Zap, FileText, Loader2, Crosshair,
  Sliders, Compass, Layers, Download, Columns, Plus, Trash2, Trophy, Check
} from 'lucide-react'
import { useSelectedVersion, useDebounce, useUserId } from '@/lib/hooks'
import { matchResume, listVersions, downloadPdfReport, matchMultipleResumes } from '@/lib/api'
import type { JobMatchResult, ResumeVersion, MultiMatchResponse, MultiMatchComparisonItem } from '@/lib/api'
import { ApertureGauge } from '@/components/ui/ApertureGauge'
import { ViewfinderFrame } from '@/components/ui/ViewfinderFrame'
import { SkillChip } from '@/components/ui/SkillChip'
import { SkeletonRing, SkeletonChips, SkeletonCard } from '@/components/ui/Skeleton'
import Link from 'next/link'

const SAMPLE_JDS = [
  {
    title: 'Full-Stack Developer',
    role: 'Engineering',
    jd: `We are looking for a Full-Stack Developer to build features end-to-end across our React frontend and Python/Node backend services.

Responsibilities & Core Duties:
• Own full feature delivery from database migrations through to polished UI, working closely with product managers and designers.
• Build scalable REST APIs and maintain performant backend services.
• Develop responsive, accessible web interfaces and components using React.

Key Requirements:
• Strong proficiency in React, JavaScript, TypeScript, and modern CSS.
• Solid backend experience with Python, Node.js, and RESTful API architecture.
• Experience with relational databases such as PostgreSQL and caching layers like Redis.
• Familiarity with Docker, Git version control, and CI/CD pipelines.`,
  },
  {
    title: 'Frontend Developer',
    role: 'UI / UX Engineering',
    jd: `We are hiring a Frontend Developer to build responsive, accessible user interfaces using modern JavaScript frameworks and design systems.

Responsibilities:
• Turn Figma and design mockups into production-ready, performant React components.
• Optimize client-side rendering speed, state management, and web accessibility (WCAG).
• Collaborate with backend engineers to integrate REST and GraphQL endpoints.

Key Requirements:
• 2+ years of experience with React, JavaScript (ES6+), TypeScript, HTML5, and CSS3.
• Demonstrated understanding of responsive design, CSS architecture, and browser dev tools.
• Familiarity with modern build tools, REST APIs, and Git version control.`,
  },
  {
    title: 'Backend Developer',
    role: 'Platform Engineering',
    jd: `We are seeking a Backend Developer to design, optimize, and maintain server-side APIs, business logic, and database schemas.

Responsibilities:
• Architect robust microservices and RESTful APIs serving high traffic volumes.
• Design, query, and optimize PostgreSQL and relational databases.
• Work closely with frontend and DevOps engineers to ensure reliable, scalable service delivery.

Key Requirements:
• Strong background in Python, Node.js, or Go with hands-on REST API design experience.
• In-depth knowledge of SQL, PostgreSQL query optimization, and indexing.
• Experience containerizing applications with Docker and deploying with Git-based workflows.`,
  },
  {
    title: 'ML / AI Engineer',
    role: 'Data Science & AI',
    jd: `We are looking for a Machine Learning Engineer to train, evaluate, and deploy production ML models and intelligence pipelines.

Responsibilities:
• Own the model lifecycle from feature engineering and experimentation through to serving infrastructure and monitoring.
• Build scalable data preprocessing and model evaluation workflows.
• Collaborate with product teams to integrate predictive models into production web apps.

Key Requirements:
• Strong programming skills in Python with proficiency in NumPy, Pandas, and scikit-learn.
• Hands-on experience with deep learning frameworks such as PyTorch or TensorFlow.
• Experience deploying models via Docker containerization and AWS/cloud infrastructure.
• Solid foundation in statistics, data pipelines, and MLOps practices.`,
  },
  {
    title: 'DevOps Engineer',
    role: 'Cloud & Infrastructure',
    jd: `We are seeking a DevOps Engineer to build and maintain CI/CD pipelines, infrastructure-as-code, and cloud monitoring stacks.

Responsibilities:
• Automate deployment pipelines and manage cloud infrastructure across AWS environments.
• Implement container orchestration, infrastructure provisioning, and service monitoring.
• Partner with engineering squads to improve deployment velocity, uptime, and system reliability.

Key Requirements:
• Hands-on expertise with Docker, Kubernetes, and containerized deployments.
• Strong experience with AWS cloud services, Terraform / IaC, and Linux administration.
• Proven track record building CI/CD pipelines (GitHub Actions, GitLab CI) and scripting in Python or Bash.`,
  },
]

function ScoreBar({
  label,
  value,
  weight,
  description,
}: {
  label: string
  value: number
  weight: number
  description: string
}) {
  return (
    <div className="space-y-2 bg-surface-elevated/60 p-3.5 rounded-xl border border-surface-border/80 relative">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-semibold text-slate-200">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">{weight}% weight</span>
          <span className="font-bold text-lens-cyan tabular-nums">{value.toFixed(1)}/100</span>
        </div>
      </div>

      <div className="h-2 rounded-full bg-black/50 overflow-hidden border border-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-lens-cyan via-lens-sapphire to-focus-locked shadow-[0_0_8px_rgba(0,240,255,0.4)]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <p className="text-[11px] text-slate-400 leading-tight font-sans">{description}</p>
    </div>
  )
}

export default function MatchPage() {
  const userId = useUserId()
  const [versionId, setVersionId] = useSelectedVersion()
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [jd, setJd] = useState('')
  const [showSamples, setShowSamples] = useState(false)
  const debouncedJd = useDebounce(jd, 300)
  const [loading, setLoading] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<JobMatchResult | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // Live text metrics
  const wordCount = debouncedJd.trim() ? debouncedJd.trim().split(/\s+/).length : 0
  const charCount = debouncedJd.length

  // Fetch available versions for user
  useEffect(() => {
    if (!userId) return
    let isMounted = true
    setLoadingVersions(true)
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
      .finally(() => {
        if (isMounted) setLoadingVersions(false)
      })
    return () => { isMounted = false }
  }, [userId, versionId, setVersionId])

  useEffect(() => {
    if (versionId) setSelectedId(versionId)
  }, [versionId])

  const handleMatch = async () => {
    if (!selectedId || jd.trim().length < 50) return
    setError(null)
    setLoading(true)
    try {
      const res = await matchResume(selectedId, jd)
      setMatchId(res._id)
      setResult(res.job_match_result)
      // Smooth scroll down to results
      setTimeout(() => {
        document.getElementById('match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Match failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!selectedId) return
    setDownloadingPdf(true)
    setPdfError(null)
    try {
      await downloadPdfReport(selectedId, matchId)
    } catch (e: unknown) {
      setPdfError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleSelectSample = (sampleJd: string) => {
    setJd(sampleJd)
  }

  // Multi-JD comparison state & handlers
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [multiJds, setMultiJds] = useState([
    {
      id: 'jd-1',
      label: 'Option A: Full-Stack Role',
      text: '',
    },
    {
      id: 'jd-2',
      label: 'Option B: Backend Specialist',
      text: '',
    },
  ])
  const [multiLoading, setMultiLoading] = useState(false)
  const [multiResult, setMultiResult] = useState<MultiMatchResponse | null>(null)
  const [multiError, setMultiError] = useState<string | null>(null)

  const addJdSlot = () => {
    if (multiJds.length >= 4) return
    const nextLetter = String.fromCharCode(65 + multiJds.length)
    setMultiJds(prev => [
      ...prev,
      {
        id: `jd-${Date.now()}`,
        label: `Option ${nextLetter}: Target Role`,
        text: '',
      },
    ])
  }

  const removeJdSlot = (id: string) => {
    if (multiJds.length <= 2) return
    setMultiJds(prev => prev.filter(item => item.id !== id))
  }

  const updateJdItem = (id: string, field: 'label' | 'text', val: string) => {
    setMultiJds(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item))
  }

  const loadSampleComparison = () => {
    setMultiJds([
      {
        id: 'sample-1',
        label: `${SAMPLE_JDS[0].title} (${SAMPLE_JDS[0].role})`,
        text: SAMPLE_JDS[0].jd,
      },
      {
        id: 'sample-2',
        label: `${SAMPLE_JDS[2].title} (${SAMPLE_JDS[2].role})`,
        text: SAMPLE_JDS[2].jd,
      },
      {
        id: 'sample-3',
        label: `${SAMPLE_JDS[4].title} (${SAMPLE_JDS[4].role})`,
        text: SAMPLE_JDS[4].jd,
      },
    ])
  }

  const handleMultiMatch = async () => {
    if (!selectedId) return
    const valid = multiJds.filter(j => j.text.trim().length >= 20)
    if (valid.length < 2) {
      setMultiError('Please provide at least 2 job descriptions with 20+ characters each.')
      return
    }
    setMultiError(null)
    setMultiLoading(true)
    try {
      const payload = valid.map(j => ({
        label: j.label.trim() || undefined,
        job_description_text: j.text.trim(),
      }))
      const res = await matchMultipleResumes(selectedId, payload)
      setMultiResult(res)
      setTimeout(() => {
        document.getElementById('multi-match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e: unknown) {
      setMultiError(e instanceof Error ? e.message : 'Multi-JD comparison failed')
    } finally {
      setMultiLoading(false)
    }
  }

  const match = result

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)]">
      {/* Ambient optical glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[680px] h-[350px] bg-lens-cyan/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-mono font-semibold text-lens-cyan tracking-wider shadow-sm">
            <Crosshair size={13} className="text-lens-cyan" />
            <span>SEMANTIC VECTOR FIT ENGINE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-gradient">
            Job Match Analysis
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-sans">
            Evaluate how sharply your resume aligns with any target job description using
            exact keyword checks, conceptual vector embeddings, and experience tier alignment.
          </p>

          {/* Mode Switcher Toggle */}
          <div className="pt-2 flex justify-center">
            <div className="inline-flex p-1 rounded-xl bg-surface-card border border-surface-border font-mono text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                  mode === 'single'
                    ? 'bg-lens-cyan text-black shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair size={13} />
                <span>Single Role Fit</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('multi')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                  mode === 'multi'
                    ? 'bg-lens-cyan text-black shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns size={13} />
                <span>Multi-JD Compare (2–4)</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  mode === 'multi' ? 'bg-black/20 text-black' : 'bg-lens-cyan/20 text-lens-cyan'
                }`}>
                  NEW
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {mode === 'single' ? (
          <>
        {/* Input Panel Card with Viewfinder Frame */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          <ViewfinderFrame tag="JD-INPUT" active={Boolean(jd.trim())}>
            <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-8 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-6">

              {/* Version Picker / No Resume Warning */}
              {versions.length > 1 ? (
                <div className="space-y-2 font-mono">
                  <label className="label text-[11px] text-slate-400 block">// TARGET RESUME VERSION</label>
                  <div className="relative">
                    <select
                      value={selectedId}
                      onChange={e => {
                        setSelectedId(e.target.value)
                        setVersionId(e.target.value)
                      }}
                      className="w-full bg-surface-elevated/80 border border-surface-border rounded-xl
                                 px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-lens-cyan/60
                                 appearance-none cursor-pointer transition-colors"
                    >
                      {versions.map(v => (
                        <option key={v._id} value={v._id}>
                          {v.version_label} (ATS Score: {v.ats_score?.overall_score ?? '—'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              ) : !selectedId && !loadingVersions ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-focus-calibrating-dim border border-focus-calibrating/30 text-focus-calibrating text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>No mounted resume detected in current session.</span>
                  </div>
                  <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Upload Resume →
                  </Link>
                </div>
              ) : null}

              {/* Sample JD Trigger & Picker Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowSamples(s => !s)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-lens-cyan
                               hover:text-white transition-colors py-1 group"
                  >
                    <Sparkles size={13} className="text-lens-cyan group-hover:rotate-12 transition-transform duration-200" />
                    <span>Don&apos;t have a JD? Try a calibrated sample</span>
                    {showSamples ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                  </button>

                  {jd.trim() && (
                    <span className="text-xs text-slate-500 font-mono">
                      {wordCount} words · {charCount} chars
                      {wordCount < 40 && (
                        <span className="text-focus-lost ml-1.5">(min ~50 words)</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Sample Chips Tray */}
                <AnimatePresence>
                  {showSamples && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="bg-surface-elevated/70 border border-surface-border rounded-2xl p-4 space-y-2.5 relative">
                        <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-lens-cyan" />
                        <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-lens-cyan" />

                        <div className="font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Populate from Calibrated Tech Taxonomy:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SAMPLE_JDS.map((sample) => (
                            <button
                              key={sample.title}
                              type="button"
                              onClick={() => handleSelectSample(sample.jd)}
                              className="px-3.5 py-2 rounded-xl text-xs font-mono bg-surface-card border border-surface-border
                                         hover:border-lens-cyan/60 hover:text-white text-slate-300 transition-all duration-150
                                         hover:bg-lens-cyan-dim hover:shadow-[0_0_14px_rgba(0,240,255,0.2)] active:scale-95 text-left"
                            >
                              <span className="font-bold block text-slate-200">{sample.title}</span>
                              <span className="text-[10px] text-slate-500">{sample.role}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* JD Textarea */}
              <div className="space-y-2">
                <textarea
                  value={jd}
                  onChange={e => setJd(e.target.value)}
                  rows={10}
                  placeholder="Paste the full job description text here, or click 'Try a calibrated sample' above to test…"
                  className="w-full bg-surface-elevated/70 border border-surface-border rounded-2xl
                             px-4 py-3.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none
                             focus:border-lens-cyan/60 focus:bg-surface-elevated transition-all resize-none leading-relaxed font-sans"
                />
              </div>

              {/* Action Button */}
              <button
                onClick={handleMatch}
                disabled={!selectedId || jd.trim().length < 50 || loading}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg group"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-black" />
                    <span>Focusing MiniLM Vector Embeddings…</span>
                  </>
                ) : (
                  <>
                    <Crosshair size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Analyze Optical Job Fit</span>
                  </>
                )}
              </button>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2.5 bg-focus-lost-dim border border-focus-lost/30 rounded-xl p-3.5 text-focus-lost text-xs font-mono"
                >
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </div>
          </ViewfinderFrame>
        </motion.div>

        {/* Loading Skeletons */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-1.5">
              <p className="text-sm font-display font-semibold text-lens-cyan">Aligning Conceptual Vectors & Gazetteers…</p>
              <p className="text-xs font-mono text-slate-500 animate-pulse">Running cosine similarity between resume & job description</p>
            </div>
            <div className="flex justify-center py-4">
              <SkeletonRing />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}
            </div>
          </motion.div>
        )}

        {/* Results State */}
        <AnimatePresence>
          {match && !loading && (
            <motion.div
              id="match-results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8 max-w-5xl mx-auto pt-4"
            >
              {/* Main Score Hero Card with Viewfinder Frame */}
              <ViewfinderFrame tag="FIT-CALIBRATION" cornerSize="lg" active>
                <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 rounded-2xl shadow-2xl">
                  <div className="shrink-0 flex flex-col items-center">
                    <ApertureGauge
                      score={match.job_match_score}
                      size={190}
                      label="Job Match Score"
                      sublabel="Vector Calibrated"
                    />
                  </div>

                  <div className="flex-1 w-full space-y-5">
                    {/* Summary Callout Block */}
                    <div className="bg-surface-elevated/70 border-l-4 border-lens-cyan p-4 rounded-xl border border-surface-border text-sm leading-relaxed text-slate-200 font-sans">
                      <p className="font-medium">{match.summary}</p>
                    </div>

                    {/* Component Score Breakdown Bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <ScoreBar
                        label="Skill Overlap"
                        value={match.breakdown.skill_overlap_score}
                        weight={50}
                        description="Exact + discounted semantic skill hits vs JD requirements"
                      />
                      <ScoreBar
                        label="Semantic Fit"
                        value={match.breakdown.semantic_similarity_score}
                        weight={30}
                        description="Holistic MiniLM cosine similarity of full profile vs JD"
                      />
                      <ScoreBar
                        label="Experience Tier"
                        value={match.breakdown.experience_alignment_score}
                        weight={20}
                        description="Seniority & years of experience alignment"
                      />
                    </div>

                    {/* PDF Export Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-border">
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <FileText size={12} className="text-lens-cyan" />
                        <span>// OFFICIAL DIAGNOSTIC REPORT</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="btn-primary text-xs py-2 px-4 flex items-center gap-2 group shadow-md"
                      >
                        {downloadingPdf ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-black" />
                            <span>Generating ReportLab PDF…</span>
                          </>
                        ) : (
                          <>
                            <Download size={13} className="text-black group-hover:scale-110 transition-transform" />
                            <span>Download PDF Report</span>
                          </>
                        )}
                      </button>
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

              {/* Three-Column Skill Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Matched Skills */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="card p-5 space-y-4 border-focus-locked/30 bg-surface-card/95 relative"
                >
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-focus-locked" />
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-focus-locked" />

                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-focus-locked-dim flex items-center justify-center text-focus-locked">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">Focus Locked</h3>
                        <p className="font-mono text-[10px] text-slate-400">Exact requirements hit</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-focus-locked bg-focus-locked-dim px-2.5 py-1 rounded-full border border-focus-locked/30">
                      {match.matched_skills.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {match.matched_skills.length > 0 ? (
                      match.matched_skills.map((skill) => (
                        <SkillChip key={skill} skill={skill} variant="matched" />
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic py-2 font-mono">No exact skill hits detected</span>
                    )}
                  </div>
                </motion.div>

                {/* 2. Related / Semantic Skills */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 }}
                  className="card p-5 space-y-4 border-lens-cyan/30 bg-surface-card/95 relative"
                >
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-lens-cyan" />
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-lens-cyan" />

                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-lens-cyan-dim flex items-center justify-center text-lens-cyan">
                        <Link2 size={16} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">Semantic Hits</h3>
                        <p className="font-mono text-[10px] text-slate-400">Hover for vector link</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-lens-cyan bg-lens-cyan-dim px-2.5 py-1 rounded-full border border-lens-cyan/30">
                      {match.related_skills.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {match.related_skills.length > 0 ? (
                      match.related_skills.map((item, idx) => (
                        <SkillChip
                          key={idx}
                          skill={item.resume_skill}
                          variant="related"
                          matchInfo={item}
                        />
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic py-2 font-mono">No semantic matches found</span>
                    )}
                  </div>
                </motion.div>

                {/* 3. Missing Skills */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                  className="card p-5 space-y-4 border-focus-lost/30 bg-surface-card/95 relative"
                >
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-focus-lost" />
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-focus-lost" />

                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-focus-lost-dim flex items-center justify-center text-focus-lost">
                        <XCircle size={16} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">Optical Blindspots</h3>
                        <p className="font-mono text-[10px] text-slate-400">Required by JD, absent on resume</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-focus-lost bg-focus-lost-dim px-2.5 py-1 rounded-full border border-focus-lost/30">
                      {match.missing_skills.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {match.missing_skills.length > 0 ? (
                      match.missing_skills.map((skill) => (
                        <SkillChip key={skill} skill={skill} variant="missing" />
                      ))
                    ) : (
                      <span className="text-xs text-focus-locked font-mono py-2">✓ All JD requirements matched!</span>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Action Footer Navigation Bar */}
              <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

                <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
                  // WANT TO ELIMINATE BLINDSPOTS AND ENHANCE WEAK BULLETS?
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 hover:border-lens-cyan/50 hover:text-white group"
                  >
                    {downloadingPdf ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-lens-cyan" />
                        <span>Generating PDF…</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} className="text-lens-cyan group-hover:scale-110 transition-transform" />
                        <span>Export PDF Dossier</span>
                      </>
                    )}
                  </button>

                  <Link href="/improve" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                    <Zap size={13} />
                    <span>Enhance Weak Bullets</span>
                    <ArrowRight size={13} />
                  </Link>

                  <Link href="/roles" className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5">
                    <Briefcase size={13} />
                    <span>Explore Benchmark Roles</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
           MULTI-JD COMPARISON MODE
           ════════════════════════════════════════════════════════════════════════ */
        <div className="space-y-10">
          {/* Multi-JD Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-4xl mx-auto"
          >
            <ViewfinderFrame tag="MULTI-JD-MATRIX" active={multiJds.some(j => j.text.trim().length > 0)}>
              <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border p-6 sm:p-8 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-6">
                
                {/* Version Picker */}
                {versions.length > 1 ? (
                  <div className="space-y-2 font-mono">
                    <label className="label text-[11px] text-slate-400 block">// TARGET RESUME VERSION</label>
                    <div className="relative">
                      <select
                        value={selectedId}
                        onChange={e => {
                          setSelectedId(e.target.value)
                          setVersionId(e.target.value)
                        }}
                        className="w-full bg-surface-elevated/80 border border-surface-border rounded-xl
                                   px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-lens-cyan/60
                                   appearance-none cursor-pointer transition-colors"
                      >
                        {versions.map(v => (
                          <option key={v._id} value={v._id}>
                            {v.version_label} (ATS Score: {v.ats_score?.overall_score ?? '—'})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                ) : !selectedId && !loadingVersions ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-focus-calibrating-dim border border-focus-calibrating/30 text-focus-calibrating text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>No mounted resume detected in current session.</span>
                    </div>
                    <Link href="/" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                      Upload Resume →
                    </Link>
                  </div>
                ) : null}

                {/* Subheader and Quick Sample Comparison Loader */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-surface-border/60">
                  <div className="font-mono text-xs text-slate-400">
                    // CONFIGURE 2 TO 4 TARGET JOB DESCRIPTIONS
                  </div>
                  <button
                    type="button"
                    onClick={loadSampleComparison}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-lens-cyan hover:text-white transition-colors py-1 group"
                  >
                    <Sparkles size={13} className="text-lens-cyan group-hover:rotate-12 transition-transform duration-200" />
                    <span>Load 3 Calibrated Comparison Roles</span>
                  </button>
                </div>

                {/* Grid of JD Inputs (2 to 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {multiJds.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-surface-elevated/70 border border-surface-border rounded-xl p-4 space-y-3 relative group focus-within:border-lens-cyan/50 transition-colors"
                    >
                      {/* Top Bar with Badge, Label Input & Delete button */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-lens-cyan/10 border border-lens-cyan/30 text-lens-cyan uppercase tracking-wider shrink-0">
                          Role {String.fromCharCode(65 + idx)}
                        </span>
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateJdItem(item.id, 'label', e.target.value)}
                          placeholder={`Role ${String.fromCharCode(65 + idx)} Title / Company`}
                          className="flex-1 bg-surface-card border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-slate-500 outline-none focus:border-lens-cyan/60 font-sans font-medium"
                        />
                        {multiJds.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeJdSlot(item.id)}
                            title="Remove role from comparison"
                            className="p-1 rounded text-slate-500 hover:text-focus-lost hover:bg-focus-lost-dim transition-colors shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* Textarea */}
                      <textarea
                        value={item.text}
                        onChange={e => updateJdItem(item.id, 'text', e.target.value)}
                        rows={7}
                        placeholder={`Paste Job Description for Role ${String.fromCharCode(65 + idx)} (minimum 20 characters)…`}
                        className="w-full bg-surface-card/80 border border-surface-border rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-lens-cyan/60 focus:bg-surface-card resize-none font-sans leading-relaxed"
                      />

                      {/* Card Footer with Word Count & Quick Taxonomy Loader */}
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-500">
                        <span>{item.text.trim() ? item.text.trim().split(/\s+/).length : 0} words</span>
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              const s = SAMPLE_JDS.find(x => x.title === e.target.value)
                              if (s) {
                                updateJdItem(item.id, 'label', `${s.title} (${s.role})`)
                                updateJdItem(item.id, 'text', s.jd)
                              }
                              e.target.value = ''
                            }
                          }}
                          defaultValue=""
                          className="bg-surface-card border border-surface-border text-[10px] text-slate-400 rounded px-2 py-0.5 outline-none hover:text-slate-200 cursor-pointer"
                        >
                          <option value="" disabled>Load from taxonomy…</option>
                          {SAMPLE_JDS.map(s => (
                            <option key={s.title} value={s.title}>{s.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Role Slot button (Capped at 4) */}
                {multiJds.length < 4 && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={addJdSlot}
                      className="inline-flex items-center gap-2 text-xs font-mono text-lens-cyan hover:text-white px-4 py-2 rounded-xl border border-dashed border-lens-cyan/40 hover:border-lens-cyan hover:bg-lens-cyan-dim transition-all"
                    >
                      <Plus size={14} />
                      <span>Add Another Target Role (Slot {multiJds.length + 1} of 4)</span>
                    </button>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={handleMultiMatch}
                  disabled={!selectedId || multiJds.filter(j => j.text.trim().length >= 20).length < 2 || multiLoading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg group"
                >
                  {multiLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Calibrating Vector Fit Across {multiJds.length} Target Roles…</span>
                    </>
                  ) : (
                    <>
                      <Columns size={16} className="group-hover:scale-110 transition-transform" />
                      <span>Compare All {multiJds.length} Roles Side-by-Side</span>
                    </>
                  )}
                </button>

                {multiError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2.5 bg-focus-lost-dim border border-focus-lost/30 rounded-xl p-3.5 text-focus-lost text-xs font-mono"
                  >
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{multiError}</span>
                  </motion.div>
                )}
              </div>
            </ViewfinderFrame>
          </motion.div>

          {/* Multi-JD Loading State */}
          {multiLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
              <div className="text-center space-y-1.5">
                <p className="text-sm font-display font-semibold text-lens-cyan">Evaluating Multi-Role Vector Alignments…</p>
                <p className="text-xs font-mono text-slate-500 animate-pulse">Running semantic cosine similarity across all target specs simultaneously</p>
              </div>
              <div className="flex justify-center py-4">
                <SkeletonRing />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}
              </div>
            </motion.div>
          )}

          {/* Multi-JD Results View */}
          <AnimatePresence>
            {multiResult && !multiLoading && (
              <motion.div
                id="multi-match-results"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 max-w-5xl mx-auto pt-4"
              >
                {/* Best Fit Banner */}
                {multiResult.best_fit_label && (
                  <ViewfinderFrame tag="BEST-FOCUS" cornerSize="lg" active glow>
                    <div className="bg-surface-card/95 backdrop-blur-xl border border-focus-locked/50 p-6 sm:p-7 rounded-2xl shadow-[0_0_35px_rgba(16,185,129,0.18)] flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-focus-locked-dim border border-focus-locked/40 text-focus-locked flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                          <Trophy size={28} />
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold text-focus-locked tracking-wider uppercase">
                            <span>★ OPTICAL FOCUS LOCKED • STRONGEST FIT IDENTIFIED</span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                            {multiResult.best_fit_label}
                          </h2>
                          <p className="text-xs text-slate-400 font-mono">
                            Benchmarked {multiResult.total_compared} target roles against your current resume profile.
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-center sm:text-right bg-surface-elevated/70 px-5 py-3 rounded-xl border border-surface-border">
                        <div className="font-display font-black text-3xl sm:text-4xl text-focus-locked">
                          {multiResult.best_fit_score}%
                        </div>
                        <div className="font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                          Peak Alignment Score
                        </div>
                      </div>
                    </div>
                  </ViewfinderFrame>
                )}

                {/* Side-by-Side Comparison Cards Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-2 ${
                  multiResult.comparisons.length === 3 ? 'lg:grid-cols-3' : multiResult.comparisons.length >= 4 ? 'lg:grid-cols-2 xl:grid-cols-4' : ''
                } gap-5`}>
                  {multiResult.comparisons.map((item, idx) => {
                    const isBestFit = item.label === multiResult.best_fit_label
                    return (
                      <div key={idx} className="relative">
                        <ViewfinderFrame
                          tag={isBestFit ? "BEST-MATCH" : `ROLE-${String.fromCharCode(65 + idx)}`}
                          cornerSize={isBestFit ? "md" : "sm"}
                          active={isBestFit}
                          glow={isBestFit}
                        >
                          <div className={`p-5 space-y-4 rounded-2xl h-full flex flex-col justify-between border ${
                            isBestFit
                              ? 'bg-surface-card/95 border-focus-locked/50 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                              : 'bg-surface-card/90 border-surface-border'
                          }`}>
                            {/* Card Top */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2 pb-2 border-b border-surface-border">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  isBestFit
                                    ? 'bg-focus-locked-dim border border-focus-locked/40 text-focus-locked'
                                    : 'bg-surface-elevated text-slate-400'
                                }`}>
                                  {isBestFit ? '★ TOP FIT' : `Option ${String.fromCharCode(65 + idx)}`}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  Rank #{idx + 1}
                                </span>
                              </div>

                              <h3 className="font-display font-bold text-base text-white line-clamp-2" title={item.label}>
                                {item.label}
                              </h3>

                              {/* Aperture Gauge */}
                              <div className="flex justify-center py-2">
                                <ApertureGauge
                                  score={item.job_match_score}
                                  size={110}
                                  label="Match Score"
                                />
                              </div>

                              {/* Mini Breakdown Bars */}
                              <div className="space-y-1.5 pt-1 font-mono text-[11px]">
                                <div className="flex justify-between text-slate-400">
                                  <span>Skill Overlap (50%)</span>
                                  <span className="font-bold text-slate-200">{Math.round(item.breakdown.skill_overlap_score ?? 0)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                                  <div className="h-full bg-lens-cyan rounded-full" style={{ width: `${Math.min(100, item.breakdown.skill_overlap_score ?? 0)}%` }} />
                                </div>

                                <div className="flex justify-between text-slate-400 pt-1">
                                  <span>Semantic Fit (30%)</span>
                                  <span className="font-bold text-slate-200">{Math.round(item.breakdown.semantic_similarity_score ?? 0)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                                  <div className="h-full bg-focus-calibrating rounded-full" style={{ width: `${Math.min(100, item.breakdown.semantic_similarity_score ?? 0)}%` }} />
                                </div>

                                <div className="flex justify-between text-slate-400 pt-1">
                                  <span>Experience Tier (20%)</span>
                                  <span className="font-bold text-slate-200">{Math.round(item.breakdown.experience_alignment_score ?? 0)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, item.breakdown.experience_alignment_score ?? 0)}%` }} />
                                </div>
                              </div>

                              {/* Summary */}
                              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-surface-elevated/60 p-2.5 rounded-xl border border-surface-border">
                                {item.summary}
                              </p>

                              {/* Matched Skills */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-mono text-focus-locked">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    <span>Matched Skills ({item.matched_skills.length})</span>
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                  {item.matched_skills.slice(0, 5).map(s => (
                                    <SkillChip key={s} skill={s} variant="matched" />
                                  ))}
                                  {item.matched_skills.length > 5 && (
                                    <span className="text-[10px] font-mono text-slate-400 self-center">
                                      +{item.matched_skills.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Missing Skills */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-mono text-focus-lost">
                                  <span className="flex items-center gap-1">
                                    <XCircle size={12} />
                                    <span>Missing Blindspots ({item.missing_skills.length})</span>
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                  {item.missing_skills.slice(0, 4).map(s => (
                                    <SkillChip key={s} skill={s} variant="missing" />
                                  ))}
                                  {item.missing_skills.length > 4 && (
                                    <span className="text-[10px] font-mono text-slate-400 self-center">
                                      +{item.missing_skills.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </ViewfinderFrame>
                      </div>
                    )
                  })}
                </div>

                {/* Cross-Role Diagnostic Matrix Table */}
                <div className="card p-6 bg-surface-card/95 border-surface-border space-y-4 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                    <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                      <Columns size={16} className="text-lens-cyan" />
                      <span>Cross-Role Diagnostic Matrix</span>
                    </h3>
                    <span className="text-xs font-mono text-slate-500">Side-by-side metric comparison</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left">
                      <thead>
                        <tr className="border-b border-surface-border text-slate-400">
                          <th className="py-2.5 px-3">Role Specification</th>
                          <th className="py-2.5 px-3">Overall Fit</th>
                          <th className="py-2.5 px-3">Skill Overlap (50%)</th>
                          <th className="py-2.5 px-3">Semantic (30%)</th>
                          <th className="py-2.5 px-3">Experience (20%)</th>
                          <th className="py-2.5 px-3">Matched</th>
                          <th className="py-2.5 px-3">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/50">
                        {multiResult.comparisons.map((c, i) => {
                          const isBest = c.label === multiResult.best_fit_label
                          return (
                            <tr key={i} className={isBest ? 'bg-focus-locked-dim/20 font-bold' : 'hover:bg-surface-elevated/40'}>
                              <td className="py-3 px-3 text-white">
                                <div className="flex items-center gap-2">
                                  {isBest && <Trophy size={13} className="text-focus-locked shrink-0" />}
                                  <span>{c.label}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded font-bold ${
                                  c.job_match_score >= 80 ? 'text-focus-locked bg-focus-locked-dim' :
                                  c.job_match_score >= 60 ? 'text-focus-calibrating bg-focus-calibrating-dim' :
                                  'text-focus-lost bg-focus-lost-dim'
                                }`}>
                                  {c.job_match_score}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-200">{Math.round(c.breakdown.skill_overlap_score ?? 0)}%</td>
                              <td className="py-3 px-3 text-slate-200">{Math.round(c.breakdown.semantic_similarity_score ?? 0)}%</td>
                              <td className="py-3 px-3 text-slate-200">{Math.round(c.breakdown.experience_alignment_score ?? 0)}%</td>
                              <td className="py-3 px-3 text-focus-locked">{c.matched_skills.length} skills</td>
                              <td className="py-3 px-3 text-focus-lost">{c.missing_skills.length} skills</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Navigation Strip */}
                <div className="card p-5 bg-surface-elevated/60 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
                  <span className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l border-lens-cyan" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r border-lens-cyan" />

                  <div className="text-xs text-slate-400 font-mono text-center sm:text-left">
                    // WANT TO CLOSE SKILL GAPS FOR YOUR TARGET ROLES?
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link href="/improve" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                      <Zap size={13} />
                      <span>Enhance Weak Bullets</span>
                      <ArrowRight size={13} />
                    </Link>

                    <Link href="/roles" className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5">
                      <Briefcase size={13} />
                      <span>Explore Benchmark Roles</span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      </div>
    </div>
  )
}
