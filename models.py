"""
Phase 6 — Pydantic request / response models
==============================================
All data shapes entering and leaving the API are defined here.
FastAPI validates request bodies against these automatically and
serialises response dicts into JSON using them.

ObjectId fields are stored as Python str (the DB layer converts to/from BSON).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Resume Version
# ---------------------------------------------------------------------------

class ResumeVersionBase(BaseModel):
    """Fields common to create and read."""
    user_id: str = Field(..., description="Caller-supplied user identifier (no auth yet).")
    version_label: str = Field(..., description="Human label, e.g. 'v2 - added CI/CD skills'.")


class ResumeVersionCreate(ResumeVersionBase):
    """Validated body for POST /resumes/upload (file comes as form-data separately)."""
    pass


class ResumeVersionResponse(ResumeVersionBase):
    """What the API returns after a successful upload."""
    id: str = Field(..., alias="_id", description="MongoDB ObjectId as string.")
    uploaded_at: datetime
    raw_filename: str
    ats_score: Dict[str, Any]
    parsed_data: Dict[str, Any]

    model_config = {"populate_by_name": True}


class ResumeVersionSummary(BaseModel):
    """Lightweight version info used in list and comparison endpoints."""
    id: str = Field(..., alias="_id")
    user_id: str
    version_label: str
    uploaded_at: datetime
    raw_filename: str
    overall_ats_score: int = Field(..., description="Extracted from ats_score['overall_score'].")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Job Match History
# ---------------------------------------------------------------------------

class MatchRequest(BaseModel):
    """Body for POST /resumes/{version_id}/match."""
    job_description_text: str = Field(
        ...,
        min_length=50,
        description="Full raw text of the job description to match against.",
    )


class JobMatchResponse(BaseModel):
    """What the API returns after running Phase 4 against a saved version."""
    id: str = Field(..., alias="_id")
    resume_version_id: str
    user_id: str
    evaluated_at: datetime
    job_match_result: Dict[str, Any]

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Comparison / Score Delta
# ---------------------------------------------------------------------------

class ScoreDelta(BaseModel):
    """Score change between one version and the previous one."""
    ats_delta: Optional[int] = Field(
        None,
        description="ATS score change vs. previous version. None for the first version.",
    )
    match_score_delta: Optional[int] = Field(
        None,
        description="Job match score change vs. previous version. None if no match run yet.",
    )


class ComparisonEntry(BaseModel):
    """One row in the comparison view."""
    id: str = Field(..., alias="_id")
    version_label: str
    uploaded_at: datetime
    raw_filename: str
    overall_ats_score: int
    latest_job_match_score: Optional[int] = Field(
        None,
        description="Most recent match score for this version, or None if never matched.",
    )
    delta: ScoreDelta = Field(
        default_factory=ScoreDelta,
        description="Score deltas vs. the previous version.",
    )

    model_config = {"populate_by_name": True}


class ComparisonResponse(BaseModel):
    """Response for GET /resumes/{user_id}/comparison."""
    user_id: str
    total_versions: int
    versions: List[ComparisonEntry]


# ---------------------------------------------------------------------------
# Multi-JD Matching (Side-by-Side Comparison)
# ---------------------------------------------------------------------------

class JobDescriptionInput(BaseModel):
    """One job description item in a multi-JD comparison request."""
    label: Optional[str] = Field(default=None, description="Optional label e.g. 'Company A - Frontend Role'.")
    job_description_text: str = Field(..., min_length=20, description="Full raw text of the job description.")


class MultiMatchRequest(BaseModel):
    """Body for POST /resumes/{version_id}/match-multiple."""
    job_descriptions: List[JobDescriptionInput] = Field(
        ...,
        min_length=1,
        max_length=4,
        description="List of 1 to 4 job descriptions to compare against."
    )


class MultiMatchComparisonItem(BaseModel):
    """Result for one JD in the multi-JD comparison."""
    label: str
    job_match_score: int
    breakdown: Dict[str, Any]
    matched_skills: List[str]
    related_skills: List[Dict[str, Any]]
    missing_skills: List[str]
    summary: str
    error: Optional[str] = None


class MultiMatchResponse(BaseModel):
    """Response for POST /resumes/{version_id}/match-multiple."""
    resume_version_id: str
    total_compared: int
    comparisons: List[MultiMatchComparisonItem]
    best_fit_label: Optional[str] = None
    best_fit_score: Optional[int] = None


# ---------------------------------------------------------------------------
# Interactive Mock Interview
# ---------------------------------------------------------------------------

class InterviewQuestion(BaseModel):
    """A single interview question in a session."""
    index: int
    category: str = Field(..., description="'warm_up' | 'behavioral' | 'technical'")
    question: str
    context: str = Field(..., description="Explanation of why this question was selected from resume/JD.")
    suggested_focus: str = Field(..., description="Guidance on what to highlight in response.")


class InterviewFeedback(BaseModel):
    """Constructive critique on a single submitted answer."""
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    suggested_angle: str = Field(..., description="Concrete reframing or STAR angle for improvement.")
    score: int = Field(..., ge=1, le=10, description="Rating from 1 to 10.")
    readiness_label: str = Field(..., description="'Strong Answer' | 'Good Foundation' | 'Needs Polish'")
    provider: Optional[str] = None


class InterviewAnswerRecord(BaseModel):
    """Stored question answer and feedback entry."""
    question_index: int
    question: str
    category: str
    answer_text: str
    feedback: InterviewFeedback
    answered_at: datetime


class InterviewStartRequest(BaseModel):
    """Request body to initiate a mock interview."""
    resume_version_id: str
    job_match_id: Optional[str] = Field(default=None, description="Optional job match ID to tailor technical questions.")
    num_questions: int = Field(default=5, ge=3, le=8, description="Number of questions in session.")


class InterviewStartResponse(BaseModel):
    """Response returned upon starting a session."""
    session_id: str = Field(..., alias="_id")
    user_id: str
    resume_version_id: str
    job_match_id: Optional[str] = None
    total_questions: int
    current_question_index: int
    first_question: InterviewQuestion
    created_at: datetime

    model_config = {"populate_by_name": True}


class InterviewAnswerRequest(BaseModel):
    """Request body to submit an answer to the active question."""
    answer: str = Field(..., min_length=5, description="Candidate's typed answer text.")


class InterviewAnswerResponse(BaseModel):
    """Response returned after evaluating a submitted answer."""
    session_id: str
    question_index: int
    feedback: InterviewFeedback
    is_complete: bool
    current_question_index: int
    next_question: Optional[InterviewQuestion] = None
    summary: Optional[Dict[str, Any]] = None


class InterviewSessionDetailResponse(BaseModel):
    """Full detail of an interview session."""
    id: str = Field(..., alias="_id")
    user_id: str
    resume_version_id: str
    job_match_id: Optional[str] = None
    status: str = Field(..., description="'in_progress' | 'completed'")
    questions: List[InterviewQuestion]
    answers: List[InterviewAnswerRecord]
    current_question_index: int
    is_complete: bool
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


class InterviewSessionSummaryItem(BaseModel):
    """Lightweight summary item for listing past interview sessions."""
    id: str = Field(..., alias="_id")
    user_id: str
    resume_version_id: str
    job_match_id: Optional[str] = None
    status: str
    total_questions: int
    answered_questions: int
    average_score: Optional[float] = None
    overall_verdict: Optional[str] = None
    created_at: datetime

    model_config = {"populate_by_name": True}


