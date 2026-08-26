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
