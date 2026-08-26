'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, AlertCircle, Sparkles, ChevronRight,
  ChevronDown, ChevronUp, CheckCircle2, Link2, XCircle,
  ArrowRight, Briefcase, Zap, FileText, Loader2, Crosshair,
  Sliders, Compass, Layers
} from 'lucide-react'
import { useSelectedVersion, useDebounce, useUserId } from '@/lib/hooks'
import { matchResume, listVersions } from '@/lib/api'
import type { JobMatchResult, ResumeVersion } from '@/lib/api'
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

  const handleSelectSample = (sampleJd: string) => {
    setJd(sampleJd)
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
        </motion.div>

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

                <div className="flex flex-wrap gap-3">
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
    </div>
  )
}
