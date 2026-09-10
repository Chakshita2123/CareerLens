'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquareCode,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  History,
  Send,
  HelpCircle,
  Clock,
  Layers,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  Sparkle
} from 'lucide-react'
import { clsx } from 'clsx'
import { useUserId, useSelectedVersion } from '@/lib/hooks'
import {
  listVersions,
  ResumeVersion,
  startInterview,
  submitInterviewAnswer,
  getInterviewSession,
  listUserInterviews,
  InterviewStartResponse,
  InterviewQuestion,
  InterviewFeedback,
  InterviewAnswerRecord,
  InterviewSessionDetail,
  InterviewSessionSummaryItem,
} from '@/lib/api'

// ─── Optical Aperture Spinning Component ─────────────────────────────────────

function ApertureSpinner({ size = 28 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="text-lens-cyan animate-[spin_4s_linear_infinite]"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.4" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="2" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="12" x2="15" y2="16" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="22" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="12" x2="9" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" fill="#00f0ff" />
      </svg>
    </div>
  )
}

export default function InterviewPage() {
  const userId = useUserId()
  const [versionId, setVersionId] = useSelectedVersion()

  // Data states
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [pastSessions, setPastSessions] = useState<InterviewSessionSummaryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Configuration options
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [includeJd, setIncludeJd] = useState(false)
  const [jdText, setJdText] = useState('')
  const [questionCount, setQuestionCount] = useState(5)

  // Active session states
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [userAnswer, setUserAnswer] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [lastFeedback, setLastFeedback] = useState<InterviewFeedback | null>(null)
  const [pendingNextQuestion, setPendingNextQuestion] = useState<InterviewQuestion | null>(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // Full session detail & completion state
  const [isCompleted, setIsCompleted] = useState(false)
  const [sessionDetail, setSessionDetail] = useState<InterviewSessionDetail | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<number, boolean>>({})

  // UI state
  const [startingSession, setStartingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available versions
  useEffect(() => {
    if (!userId) return
    let isMounted = true
    setLoadingVersions(true)
    listVersions(userId)
      .then((res) => {
        if (!isMounted) return
        setVersions(res)
        if (res.length > 0 && !selectedVersionId) {
          const initialId = versionId || res[0]._id
          setSelectedVersionId(initialId)
          if (!versionId) setVersionId(initialId)
        }
      })
      .catch((err) => console.error('Failed to load resume versions:', err))
      .finally(() => {
        if (isMounted) setLoadingVersions(false)
      })

    return () => {
      isMounted = false
    }
  }, [userId, versionId, setVersionId])

  // Fetch past sessions history
  const loadHistory = () => {
    if (!userId) return
    setLoadingHistory(true)
    listUserInterviews(userId)
      .then((items) => setPastSessions(items))
      .catch((err) => console.error('Failed to load interview history:', err))
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    loadHistory()
  }, [userId])

  // Start new mock interview
  const handleStartInterview = async () => {
    if (!selectedVersionId) return
    setError(null)
    setStartingSession(true)
    try {
      const res: InterviewStartResponse = await startInterview(
        selectedVersionId,
        null, // Can link match ID if saved
        questionCount
      )
      setSessionId(res._id)
      setCurrentQuestion(res.first_question)
      setQuestionIndex(0)
      setTotalQuestions(res.total_questions)
      setUserAnswer('')
      setLastFeedback(null)
      setShowFeedbackModal(false)
      setIsCompleted(false)
      setSessionDetail(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initialize mock interview.')
    } finally {
      setStartingSession(false)
    }
  }

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!sessionId || !userAnswer.trim() || userAnswer.trim().length < 5) return
    setSubmittingAnswer(true)
    setError(null)
    try {
      const res = await submitInterviewAnswer(sessionId, userAnswer.trim())
      setLastFeedback(res.feedback)
      setPendingNextQuestion(res.next_question || null)
      setShowFeedbackModal(true)

      if (res.is_complete) {
        setIsCompleted(true)
        // Fetch full session details for final debrief
        const detail = await getInterviewSession(sessionId)
        setSessionDetail(detail)
        loadHistory()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Evaluation failed. Please retry.')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  // Move to next question after reviewing feedback
  const handleProceedNext = () => {
    setShowFeedbackModal(false)
    if (pendingNextQuestion) {
      setCurrentQuestion(pendingNextQuestion)
      setQuestionIndex((prev) => prev + 1)
      setUserAnswer('')
      setPendingNextQuestion(null)
      setLastFeedback(null)
    }
  }

  // Resume or view a past session
  const handleViewPastSession = async (pastId: string) => {
    setLoadingSession(true)
    setError(null)
    try {
      const detail = await getInterviewSession(pastId)
      setSessionDetail(detail)
      setSessionId(detail._id)
      setTotalQuestions(detail.questions.length)
      if (detail.is_complete) {
        setIsCompleted(true)
      } else {
        setIsCompleted(false)
        setQuestionIndex(detail.current_question_index)
        setCurrentQuestion(detail.questions[detail.current_question_index])
        setUserAnswer('')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load past session.')
    } finally {
      setLoadingSession(false)
    }
  }

  const toggleTranscript = (idx: number) => {
    setExpandedTranscripts((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  const resetSession = () => {
    setSessionId(null)
    setCurrentQuestion(null)
    setUserAnswer('')
    setLastFeedback(null)
    setIsCompleted(false)
    setSessionDetail(null)
    setShowFeedbackModal(false)
  }

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 font-sans selection:bg-lens-cyan selection:text-black">
      {/* HUD Telemetry Top Bar */}
      <div className="border-b border-surface-border/60 bg-[#090b10] px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-lens-cyan">
              <span className="w-2 h-2 rounded-full bg-lens-cyan shadow-[0_0_6px_#00f0ff] animate-pulse" />
              SIMULATOR // APERTURE-Q
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">GROUNDED RESUME + JD INTERVIEW ENGINE</span>
          </div>

          <div className="flex items-center gap-4">
            {sessionId && (
              <span className="text-slate-400">
                ACTIVE SESSION: <span className="text-slate-200">{sessionId.slice(-6).toUpperCase()}</span>
              </span>
            )}
            <span className="text-slate-500 font-mono text-[11px]">PHASE 8.0</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase bg-lens-cyan-dim text-lens-cyan border border-lens-cyan/30">
              PRACTICE & REFLECTION
            </span>
            <span className="text-xs text-slate-500 font-mono">MULTI-TURN AI INTERACTION</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white flex items-center gap-3">
            Interactive Mock Interview
            <ApertureSpinner size={24} />
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl mt-1.5 leading-relaxed">
            Rehearse high-impact technical, architectural, and behavioral interview questions generated directly from your
            resume experience and target job requirements. Receive actionable, STAR-aligned critique on every response.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── 1. SETUP VIEW (When no session active & not completed) ─────────────── */}
        {!sessionId && !isCompleted && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Card: Configuration */}
              <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-xl relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-lens-cyan/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-surface-border/70">
                  <MessageSquareCode className="text-lens-cyan" size={18} />
                  <h2 className="font-semibold text-white text-base">Session Parameters</h2>
                </div>

                {/* Resume Version Selector */}
                <div className="space-y-3 mb-6">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>1. Target Resume Version</span>
                    {loadingVersions && <span className="text-lens-cyan">Loading versions...</span>}
                  </label>

                  {versions.length === 0 ? (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-surface-border text-center text-sm text-slate-400">
                      No resume versions detected. Please upload a resume from the{' '}
                      <a href="/" className="text-lens-cyan underline">
                        Upload page
                      </a>{' '}
                      first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {versions.map((v) => {
                        const isSelected = selectedVersionId === v._id
                        return (
                          <button
                            key={v._id}
                            type="button"
                            onClick={() => setSelectedVersionId(v._id)}
                            className={clsx(
                              'p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between relative',
                              isSelected
                                ? 'bg-lens-cyan-dim/40 border-lens-cyan/60 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                                : 'bg-surface-elevated/60 border-surface-border/80 hover:border-slate-600'
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-semibold text-sm text-white truncate max-w-[170px]">
                                {v.version_label}
                              </span>
                              <span className="font-mono text-xs text-lens-cyan font-bold">
                                ATS {v.ats_score.overall_score}/100
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono truncate">{v.raw_filename}</span>
                            {isSelected && (
                              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-lens-cyan shadow-[0_0_6px_#00f0ff]" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Target JD Context Toggle */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      2. Optional Job Description Focus
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {includeJd ? 'Technical queries customized to JD' : 'Broad role questions'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIncludeJd(false)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                        !includeJd
                          ? 'bg-surface-elevated border-lens-cyan/40 text-lens-cyan shadow-sm'
                          : 'bg-black/30 border-surface-border text-slate-400 hover:text-slate-200'
                      )}
                    >
                      General Profile Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncludeJd(true)}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium border transition-all',
                        includeJd
                          ? 'bg-surface-elevated border-lens-cyan/40 text-lens-cyan shadow-sm'
                          : 'bg-black/30 border-surface-border text-slate-400 hover:text-slate-200'
                      )}
                    >
                      Target Job Description
                    </button>
                  </div>

                  {includeJd && (
                    <div className="mt-3">
                      <textarea
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        placeholder="Paste target job description text here to evaluate specific skill alignments..."
                        className="w-full h-28 bg-surface-elevated border border-surface-border rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-lens-cyan font-mono resize-none leading-relaxed placeholder:text-slate-600"
                      />
                    </div>
                  )}
                </div>

                {/* Question Count Pills */}
                <div className="space-y-3 mb-8">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    3. Number of Interview Questions
                  </label>
                  <div className="flex items-center gap-3">
                    {[3, 5, 7].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        className={clsx(
                          'flex-1 py-2.5 rounded-xl border text-xs font-mono font-medium transition-all',
                          questionCount === count
                            ? 'bg-lens-cyan text-black font-bold border-lens-cyan shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                            : 'bg-surface-elevated border-surface-border text-slate-400 hover:border-slate-600'
                        )}
                      >
                        {count} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Launch Button */}
                <button
                  type="button"
                  disabled={startingSession || !selectedVersionId}
                  onClick={handleStartInterview}
                  className={clsx(
                    'w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg',
                    startingSession || !selectedVersionId
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-lens-cyan to-lens-sapphire text-black font-bold hover:shadow-[0_0_24px_rgba(0,240,255,0.4)] active:scale-[0.99]'
                  )}
                >
                  {startingSession ? (
                    <>
                      <ApertureSpinner size={20} />
                      <span>Synthesizing Interview Protocol...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Initialize Mock Interview</span>
                    </>
                  )}
                </button>
              </div>

              {/* Protocol Blueprint Card */}
              <div className="p-5 rounded-xl bg-surface-card/60 border border-surface-border text-xs text-slate-400 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono uppercase tracking-wider text-[11px]">
                  <Layers size={14} className="text-lens-cyan" />
                  Interview Framework Structure
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-surface-border/50">
                    <span className="text-lens-cyan font-mono block text-[10px] font-bold uppercase mb-1">
                      01. Warm-Up
                    </span>
                    <p className="text-[11px] leading-snug">
                      High-level career narrative & elevator pitch assessment.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-surface-border/50">
                    <span className="text-focus-locked font-mono block text-[10px] font-bold uppercase mb-1">
                      02. Behavioral (STAR)
                    </span>
                    <p className="text-[11px] leading-snug">
                      Grounded in real bullet points and project challenges from your resume.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-surface-border/50">
                    <span className="text-lens-amber font-mono block text-[10px] font-bold uppercase mb-1">
                      03. Technical Alignment
                    </span>
                    <p className="text-[11px] leading-snug">
                      In-depth architecture, trade-offs, and skill requirement probes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar: Past Sessions */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-surface-card border border-surface-border">
                <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-surface-border/80">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <History size={15} className="text-lens-cyan" />
                    Past Sessions
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{pastSessions.length} logged</span>
                </div>

                {loadingHistory ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-mono">Loading history...</div>
                ) : pastSessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No mock interviews on record yet. Complete your first session to build performance benchmarks!
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {pastSessions.map((session) => (
                      <button
                        key={session._id}
                        type="button"
                        onClick={() => handleViewPastSession(session._id)}
                        className="w-full text-left p-3 rounded-xl bg-surface-elevated/50 border border-surface-border/80 hover:border-lens-cyan/50 hover:bg-surface-elevated transition-all flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            Session {session._id.slice(-6).toUpperCase()}
                          </span>
                          {session.average_score !== null && session.average_score !== undefined ? (
                            <span className="font-mono font-bold text-lens-cyan text-xs">
                              {session.average_score}/10
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">In Progress</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>
                            {session.answered_questions}/{session.total_questions} answered
                          </span>
                          <span>{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. ACTIVE INTERVIEW TERMINAL ────────────────────────────────────── */}
        {sessionId && !isCompleted && currentQuestion && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Progress Telemetry */}
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white">
                  QUESTION {questionIndex + 1} OF {totalQuestions}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                    currentQuestion.category === 'warm_up'
                      ? 'bg-lens-cyan-dim text-lens-cyan border-lens-cyan/30'
                      : currentQuestion.category === 'behavioral'
                      ? 'bg-focus-locked/15 text-focus-locked border-focus-locked/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  )}
                >
                  {currentQuestion.category.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-28 h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-lens-cyan transition-all duration-300"
                    style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
                <span className="text-slate-400 text-[11px]">
                  {Math.round(((questionIndex + 1) / totalQuestions) * 100)}%
                </span>
              </div>
            </div>

            {/* Question Card */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-2xl relative">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-lens-cyan-dim border border-lens-cyan/30 flex items-center justify-center shrink-0 text-lens-cyan">
                  <MessageSquareCode size={20} />
                </div>
                <div className="space-y-2 flex-1">
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                    Interviewer Query:
                  </span>
                  <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
                    {currentQuestion.question}
                  </h2>
                </div>
              </div>

              {/* Context Callout */}
              {currentQuestion.context && (
                <div className="mt-4 p-3 rounded-xl bg-surface-elevated/50 border border-surface-border/60 text-xs text-slate-400 flex items-start gap-2.5">
                  <HelpCircle size={15} className="text-lens-cyan shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-300">Context: </span>
                    {currentQuestion.context}
                  </div>
                </div>
              )}

              {/* Suggested Focus Helper */}
              {currentQuestion.suggested_focus && (
                <div className="mt-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/80 flex items-start gap-2.5">
                  <Lightbulb size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Coach Guidance: </span>
                    {currentQuestion.suggested_focus}
                  </div>
                </div>
              )}
            </div>

            {/* Answer Input Area */}
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>Your Verbal / Written Response</span>
                </label>
                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
                  <span>Words: {userAnswer.trim() ? userAnswer.trim().split(/\s+/).length : 0}</span>
                  <span>Chars: {userAnswer.length}</span>
                </div>
              </div>

              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                rows={7}
                placeholder="Type your structured answer here. Speak as if talking directly to the interviewer, outlining your technical decisions and clear measurable outcomes..."
                className="w-full bg-[#090b10] border border-surface-border rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-lens-cyan/70 font-sans leading-relaxed resize-none shadow-inner"
              />

              {/* STAR Helper Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">STAR Pillars:</span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-[11px] font-mono text-slate-400 border border-surface-border">
                  S — Situation
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-[11px] font-mono text-slate-400 border border-surface-border">
                  T — Task
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-[11px] font-mono text-slate-400 border border-surface-border">
                  A — Action
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-elevated text-[11px] font-mono text-slate-400 border border-surface-border">
                  R — Result
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={resetSession}
                  className="text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors"
                >
                  Abandon Session
                </button>

                <button
                  type="button"
                  disabled={submittingAnswer || userAnswer.trim().length < 10}
                  onClick={handleSubmitAnswer}
                  className={clsx(
                    'px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all',
                    submittingAnswer || userAnswer.trim().length < 10
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-lens-cyan text-black font-bold hover:shadow-[0_0_18px_rgba(0,240,255,0.4)]'
                  )}
                >
                  {submittingAnswer ? (
                    <>
                      <ApertureSpinner size={16} />
                      <span>Analyzing Delivery...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answer</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. TURN FEEDBACK MODAL / DRAWER ─────────────────────────────────── */}
        <AnimatePresence>
          {showFeedbackModal && lastFeedback && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-2xl bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 sm:p-7 space-y-6 overflow-hidden relative max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-surface-border/80">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="text-lens-cyan" size={20} />
                    <h3 className="text-lg font-bold text-white font-display">Interviewer Critique & Coaching</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase',
                        lastFeedback.score >= 8
                          ? 'bg-focus-locked/20 text-focus-locked border border-focus-locked/30'
                          : lastFeedback.score >= 6
                          ? 'bg-lens-cyan-dim text-lens-cyan border border-lens-cyan/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      )}
                    >
                      {lastFeedback.readiness_label} ({lastFeedback.score}/10)
                    </span>
                  </div>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-sm">
                  {/* Strengths */}
                  <div className="p-4 rounded-xl bg-focus-locked/5 border border-focus-locked/20 space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-focus-locked font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      Demonstrated Strengths
                    </span>
                    <ul className="space-y-1.5 pl-1 text-slate-200 text-xs sm:text-sm">
                      {lastFeedback.strengths.map((str, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-focus-locked shrink-0 leading-snug">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas to Polish */}
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <AlertTriangle size={15} />
                      Areas for Elevation
                    </span>
                    <ul className="space-y-1.5 pl-1 text-slate-200 text-xs sm:text-sm">
                      {lastFeedback.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 shrink-0 leading-snug">•</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Suggested Angle */}
                  <div className="p-4 rounded-xl bg-lens-cyan-dim/40 border border-lens-cyan/30 space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-lens-cyan font-bold flex items-center gap-1.5">
                      <Lightbulb size={15} />
                      Top-Tier Reframe Recommendation
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                      &ldquo;{lastFeedback.suggested_angle}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Modal Action Footer */}
                <div className="pt-4 border-t border-surface-border flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleProceedNext}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-lens-cyan to-lens-sapphire text-black font-bold text-sm flex items-center gap-2 hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all"
                  >
                    {isCompleted ? (
                      <>
                        <span>View Final Session Debrief</span>
                        <Award size={16} />
                      </>
                    ) : (
                      <>
                        <span>Proceed to Question {questionIndex + 2}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── 4. COMPLETED SESSION DEBRIEF VIEW ───────────────────────────────── */}
        {isCompleted && sessionDetail && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Executive Readiness Card */}
            <div className="p-8 rounded-2xl bg-surface-card border border-surface-border shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-lens-cyan/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-surface-border/70">
                <div>
                  <span className="text-xs font-mono text-lens-cyan font-semibold uppercase tracking-wider block mb-1">
                    PERFORMANCE AUDIT // COMPLETE
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-white">Interview Readiness Debrief</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Evaluated against {sessionDetail.questions.length} personalized questions.
                  </p>
                </div>

                {sessionDetail.summary && (
                  <div className="p-4 rounded-xl bg-surface-elevated/70 border border-surface-border text-center shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Overall Score</span>
                    <span className="text-3xl font-extrabold font-mono text-lens-cyan">
                      {sessionDetail.summary.average_score}/10
                    </span>
                  </div>
                )}
              </div>

              {/* Takeaway Narrative */}
              {sessionDetail.summary && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 rounded-xl bg-lens-cyan-dim/25 border border-lens-cyan/30 text-sm text-slate-200 leading-relaxed">
                    <span className="font-semibold text-lens-cyan block mb-1">
                      {sessionDetail.summary.overall_verdict}
                    </span>
                    {sessionDetail.summary.executive_takeaway}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Strengths Pillar */}
                    <div className="p-4 rounded-xl bg-focus-locked/5 border border-focus-locked/20 space-y-2">
                      <span className="text-xs font-mono text-focus-locked font-bold uppercase tracking-wider block">
                        Recurring Strengths
                      </span>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {sessionDetail.summary.key_strengths.map((str, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 size={13} className="text-focus-locked shrink-0 mt-0.5" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Growth Pillar */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                      <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block">
                        Targeted Growth Focus
                      </span>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {sessionDetail.summary.key_growth_areas.map((gap, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 pt-6 border-t border-surface-border/70 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={resetSession}
                  className="px-5 py-2.5 rounded-xl border border-surface-border bg-surface-elevated text-xs font-mono text-slate-300 hover:text-white hover:border-lens-cyan/50 flex items-center gap-2 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Start Another Session</span>
                </button>

                <div className="flex items-center gap-3">
                  <a
                    href="/match"
                    className="px-5 py-2.5 rounded-xl border border-surface-border text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-all flex items-center gap-1.5"
                  >
                    <Target size={14} />
                    <span>Back to Job Match</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Complete Turn-by-Turn Transcript Review */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-white font-display flex items-center gap-2">
                <FileText size={18} className="text-lens-cyan" />
                Complete Session Transcript & Critiques
              </h3>

              <div className="space-y-3">
                {sessionDetail.answers.map((item, idx) => {
                  const isExpanded = !!expandedTranscripts[idx]
                  return (
                    <div
                      key={idx}
                      className="rounded-xl bg-surface-card border border-surface-border overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTranscript(idx)}
                        className="w-full p-4 text-left flex items-center justify-between hover:bg-surface-elevated/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 pr-4">
                          <span className="font-mono text-xs font-bold text-lens-cyan">#{idx + 1}</span>
                          <span className="text-sm font-semibold text-white truncate max-w-xl">
                            {item.question}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-[11px] font-mono font-bold',
                              item.feedback.score >= 8
                                ? 'text-focus-locked bg-focus-locked/10'
                                : item.feedback.score >= 6
                                ? 'text-lens-cyan bg-lens-cyan-dim'
                                : 'text-amber-400 bg-amber-500/10'
                            )}
                          >
                            {item.feedback.score}/10
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 border-t border-surface-border/50 space-y-4 text-xs">
                          {/* Candidate Answer */}
                          <div className="p-3 rounded-lg bg-[#090b10] border border-surface-border/60 text-slate-300 leading-relaxed">
                            <span className="font-mono text-[10px] text-slate-500 block uppercase mb-1">
                              Your Answer:
                            </span>
                            {item.answer_text}
                          </div>

                          {/* Strengths & Improvements */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-focus-locked/5 border border-focus-locked/20">
                              <span className="font-mono text-[10px] text-focus-locked font-bold uppercase block mb-1">
                                Strengths:
                              </span>
                              <ul className="space-y-1 text-slate-300">
                                {item.feedback.strengths.map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase block mb-1">
                                Areas to Polish:
                              </span>
                              <ul className="space-y-1 text-slate-300">
                                {item.feedback.improvements.map((im, i) => (
                                  <li key={i}>• {im}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Suggested Reframe */}
                          <div className="p-3 rounded-lg bg-lens-cyan-dim/20 border border-lens-cyan/20 text-slate-200">
                            <span className="font-mono text-[10px] text-lens-cyan font-bold uppercase block mb-1">
                              Suggested Stronger Angle:
                            </span>
                            <p className="italic">&ldquo;{item.feedback.suggested_angle}&rdquo;</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
