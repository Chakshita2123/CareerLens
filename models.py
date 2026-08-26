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
