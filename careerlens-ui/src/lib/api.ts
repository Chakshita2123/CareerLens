/**
 * lib/api.ts — Centralized, typed API client for the CareerLens FastAPI backend.
 *
 * All fetch calls go through this file. Never scatter raw fetch() across components.
 * The Next.js rewrite rule in next.config.ts proxies /api/* → http://localhost:8000/*
 * so we never have a CORS issue in development.
 */

const BASE = '/api'

// ─── Response types (mirrors FastAPI response shapes) ────────────────────────

export interface ContactInfo {
  name: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
}

export interface ATSBreakdownItem {
  category: string
  score: number
  max_score: number
  feedback: string
}

export interface ATSScore {
  overall_score: number
  breakdown: ATSBreakdownItem[]
  top_issues: string[]
}

export interface ResumeVersion {
  _id: string
  user_id: string
  version_label: string
  uploaded_at: string
  raw_filename: string
  ats_score: ATSScore
  parsed_data: ParsedResume
}

export interface ParsedResume {
  contact_info: ContactInfo
  skills: string[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  education: EducationEntry[]
  certifications: string[]
}

export interface ExperienceEntry {
  title_company: string
  dates: string | null
  bullets: string[]
}

export interface ProjectEntry {
  name: string
  bullets: string[]
}

export interface EducationEntry {
  raw: string
  dates: string | null
}

export interface SemanticMatch {
  resume_skill: string
  jd_term: string
  similarity: number
}

export interface JobMatchResult {
  job_match_score: number
  breakdown: {
    skill_overlap_score: number
    semantic_similarity_score: number
    experience_alignment_score: number
  }
  matched_skills: string[]
  related_skills: SemanticMatch[]
  missing_skills: string[]
  summary: string
}

export interface JobMatchResponse {
  _id: string
  resume_version_id: string
  user_id: string
  evaluated_at: string
  job_match_result: JobMatchResult
}

export interface JobDescriptionInput {
  label?: string
  job_description_text: string
}

export interface MultiMatchComparisonItem {
  label: string
  job_match_score: number
  breakdown: {
    skill_overlap_score: number
    semantic_similarity_score: number
    experience_alignment_score: number
  }
  matched_skills: string[]
  related_skills: SemanticMatch[]
  missing_skills: string[]
  summary: string
  error?: string | null
}

export interface MultiMatchResponse {
  resume_version_id: string
  total_compared: number
  comparisons: MultiMatchComparisonItem[]
  best_fit_label: string | null
  best_fit_score: number | null
}

export interface RoleRecommendation {
  role_title: string
  match_score: number
  matched_skills: string[]
  related_skills: SemanticMatch[]
  missing_skills: string[]
  gap_summary: string
}

export interface RecommendationsResponse {
  resume_version_id: string
  user_id: string
  version_label: string
  recommendations: RoleRecommendation[]
}

export interface BulletImprovement {
  original: string
  suggestions: string[]
  note: string
  provider: 'gemini' | 'groq' | 'mock'
  context: string
  issues: string[]
}

export interface ImproveBulletsResponse {
  resume_version_id: string
  user_id: string
  version_label: string
  total_bullets_checked: number
  weak_bullets_found: number
  improvements: BulletImprovement[]
}

export interface ScoreDelta {
  ats_delta: number | null
  match_score_delta: number | null
}

export interface ComparisonEntry {
  _id: string
  version_label: string
  uploaded_at: string
  raw_filename: string
  overall_ats_score: number
  latest_job_match_score: number | null
  delta: ScoreDelta
}

export interface ComparisonResponse {
  user_id: string
  total_versions: number
  versions: ComparisonEntry[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Endpoint wrappers ────────────────────────────────────────────────────────

/** Upload a resume file. Returns the full parsed version with ATS score. */
export async function uploadResume(
  file: File,
  userId: string,
  versionLabel: string
): Promise<ResumeVersion> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('user_id', userId)
  fd.append('version_label', versionLabel)

  const res = await fetch(`${BASE}/resumes/upload`, { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** List all resume versions for a user (no parsed_data, lightweight). */
export async function listVersions(userId: string): Promise<ResumeVersion[]> {
  return apiFetch<ResumeVersion[]>(`/resumes/${encodeURIComponent(userId)}`)
}

/** Match a saved resume version against a job description. */
export async function matchResume(
  versionId: string,
  jdText: string
): Promise<JobMatchResponse> {
  return apiFetch<JobMatchResponse>(`/resumes/${versionId}/match`, {
    method: 'POST',
    body: JSON.stringify({ job_description_text: jdText }),
  })
}

/** Match a saved resume version against multiple job descriptions simultaneously. */
export async function matchMultipleResumes(
  versionId: string,
  jobDescriptions: JobDescriptionInput[]
): Promise<MultiMatchResponse> {
  return apiFetch<MultiMatchResponse>(`/resumes/${versionId}/match-multiple`, {
    method: 'POST',
    body: JSON.stringify({ job_descriptions: jobDescriptions }),
  })
}

/** Get top role recommendations for a saved resume version. */
export async function getRecommendations(
  versionId: string,
  topN = 5
): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>(
    `/resumes/${versionId}/recommendations?top_n=${topN}`
  )
}

/** Improve weak bullets for a saved resume version. */
export async function improveBullets(
  versionId: string
): Promise<ImproveBulletsResponse> {
  return apiFetch<ImproveBulletsResponse>(`/resumes/${versionId}/improve-bullets`, {
    method: 'POST',
  })
}

/** Get version comparison data for a user. */
export async function getComparison(userId: string): Promise<ComparisonResponse> {
  return apiFetch<ComparisonResponse>(
    `/resumes/${encodeURIComponent(userId)}/comparison`
  )
}

/**
 * Export resume diagnostic analysis as a PDF report.
 * Requests the PDF from POST /resumes/{version_id}/export-pdf and triggers a browser download.
 */
export async function downloadPdfReport(
  versionId: string,
  jobMatchId?: string | null
): Promise<void> {
  const query = jobMatchId ? `?job_match_id=${encodeURIComponent(jobMatchId)}` : ''
  const res = await fetch(`${BASE}/resumes/${versionId}/export-pdf${query}`, {
    method: 'POST',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body?.detail ?? `Failed to export PDF (HTTP ${res.status})`)
  }

  // Extract filename from Content-Disposition header if available
  const disposition = res.headers.get('Content-Disposition')
  let filename = `careerlens_report_${versionId.slice(-6)}.pdf`
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/)
    if (match && match[1]) {
      filename = match[1]
    }
  }

  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}

// ─── Interactive Mock Interview API ──────────────────────────────────────────

export interface InterviewQuestion {
  index: number
  category: 'warm_up' | 'behavioral' | 'technical' | string
  question: string
  context: string
  suggested_focus: string
}

export interface InterviewFeedback {
  strengths: string[]
  improvements: string[]
  suggested_angle: string
  score: number
  readiness_label: 'Strong Answer' | 'Good Foundation' | 'Needs Polish' | string
  provider?: string
}

export interface InterviewAnswerRecord {
  question_index: number
  question: string
  category: string
  answer_text: string
  feedback: InterviewFeedback
  answered_at: string
}

export interface InterviewStartResponse {
  _id: string
  user_id: string
  resume_version_id: string
  job_match_id?: string | null
  total_questions: number
  current_question_index: number
  first_question: InterviewQuestion
  created_at: string
}

export interface InterviewAnswerResponse {
  session_id: string
  question_index: number
  feedback: InterviewFeedback
  is_complete: boolean
  current_question_index: number
  next_question?: InterviewQuestion | null
  summary?: {
    average_score: number
    overall_verdict: string
    total_questions_answered: number
    key_strengths: string[]
    key_growth_areas: string[]
    executive_takeaway: string
    generated_at: string
  } | null
}

export interface InterviewSessionDetail {
  _id: string
  user_id: string
  resume_version_id: string
  job_match_id?: string | null
  status: 'in_progress' | 'completed'
  questions: InterviewQuestion[]
  answers: InterviewAnswerRecord[]
  current_question_index: number
  is_complete: boolean
  summary?: {
    average_score: number
    overall_verdict: string
    total_questions_answered: number
    key_strengths: string[]
    key_growth_areas: string[]
    executive_takeaway: string
    generated_at: string
  } | null
  created_at: string
  updated_at: string
}

export interface InterviewSessionSummaryItem {
  _id: string
  user_id: string
  resume_version_id: string
  job_match_id?: string | null
  status: string
  total_questions: number
  answered_questions: number
  average_score?: number | null
  overall_verdict?: string | null
  created_at: string
}

/** Initialize a new mock interview session. */
export async function startInterview(
  versionId: string,
  jobMatchId?: string | null,
  numQuestions: number = 5
): Promise<InterviewStartResponse> {
  return apiFetch<InterviewStartResponse>('/interviews/start', {
    method: 'POST',
    body: JSON.stringify({
      resume_version_id: versionId,
      job_match_id: jobMatchId || null,
      num_questions: numQuestions,
    }),
  })
}

/** Submit an answer to the current question. */
export async function submitInterviewAnswer(
  sessionId: string,
  answer: string
): Promise<InterviewAnswerResponse> {
  return apiFetch<InterviewAnswerResponse>(`/interviews/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
}

/** Fetch full interview session transcript and evaluation. */
export async function getInterviewSession(
  sessionId: string
): Promise<InterviewSessionDetail> {
  return apiFetch<InterviewSessionDetail>(`/interviews/${sessionId}`)
}

/** List all prior interview sessions for user. */
export async function listUserInterviews(
  userId: string
): Promise<InterviewSessionSummaryItem[]> {
  return apiFetch<InterviewSessionSummaryItem[]>(
    `/interviews/user/${encodeURIComponent(userId)}`
  )
}


