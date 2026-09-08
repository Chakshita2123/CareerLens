"""
Phase 6 — FastAPI Application
================================
First API layer for CareerLens. Provides four endpoints:

  POST /resumes/upload
      Accepts a resume file (.pdf / .docx) + metadata, runs it through
      Phase 1 (parser) + Phase 2 (ATS scorer), persists the result to MongoDB,
      and returns the full parsed data + ATS score.

  GET /resumes/{user_id}
      Lists all saved resume versions for a user with lightweight metadata
      (ATS scores, upload dates, version labels).

  POST /resumes/{version_id}/match
      Accepts raw JD text, runs Phase 3 (semantic match) + Phase 4 (job match
      score) against the specified saved version, persists to job_match_history,
      and returns the full match result.

  GET /resumes/{user_id}/comparison
      Returns all versions with their ATS + latest match scores and per-version
      score deltas vs. the previous version — the data needed to plot score
      progression over time.

Usage
-----
  # Install dependencies first:
  #   pip install -r requirements.txt

  # Set env vars (copy .env.example → .env and fill in):
  #   MONGO_URI=mongodb://localhost:27017
  #   DATABASE_NAME=careerlens

  # Run:
  #   uvicorn main:app --reload

  # Then open http://127.0.0.1:8000/docs to test all endpoints interactively.
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

# ---------------------------------------------------------------------------
# Cache redirect — must be set before importing sentence-transformers modules.
# Phase 1–4 imports pull in the embedding model at import time; these env vars
# ensure the model is cached in .hf_cache/ inside the project, not a system path.
# ---------------------------------------------------------------------------
_CACHE_DIR = str(Path(__file__).parent / ".hf_cache")
os.environ.setdefault("HF_HOME", _CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", _CACHE_DIR)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", _CACHE_DIR)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# ---------------------------------------------------------------------------
# FastAPI + Motor imports
# ---------------------------------------------------------------------------
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# ---------------------------------------------------------------------------
# Project-level imports (Phases 1–4 + DB layer + Pydantic models)
# ---------------------------------------------------------------------------
try:
    from resume_parser.parser import parse_resume
    from resume_parser.extractor import extract_text
    from ats_scorer import score_resume
    from job_match_scorer import compute_job_match
    from bullet_improver import improve_weak_bullets
    from role_recommender import recommend_roles
    from pdf_report import build_pdf_report
    from mock_interview import (
        generate_interview_questions,
        evaluate_answer,
        generate_session_summary,
    )
    from database import (
        close_client,
        get_history_collection,
        get_versions_collection,
        get_interviews_collection,
        serialise_doc,
    )
    from models import (
        ComparisonEntry,
        ComparisonResponse,
        JobMatchResponse,
        MatchRequest,
        ResumeVersionResponse,
        ResumeVersionSummary,
        ScoreDelta,
        JobDescriptionInput,
        MultiMatchRequest,
        MultiMatchResponse,
        MultiMatchComparisonItem,
        InterviewQuestion,
        InterviewFeedback,
        InterviewAnswerRecord,
        InterviewStartRequest,
        InterviewStartResponse,
        InterviewAnswerRequest,
        InterviewAnswerResponse,
        InterviewSessionDetailResponse,
        InterviewSessionSummaryItem,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from resume_parser.parser import parse_resume
    from resume_parser.extractor import extract_text
    from ats_scorer import score_resume
    from job_match_scorer import compute_job_match
    from bullet_improver import improve_weak_bullets
    from role_recommender import recommend_roles
    from pdf_report import build_pdf_report
    from mock_interview import (
        generate_interview_questions,
        evaluate_answer,
        generate_session_summary,
    )
    from database import (
        close_client,
        get_history_collection,
        get_versions_collection,
        get_interviews_collection,
        serialise_doc,
    )
    from models import (
        ComparisonEntry,
        ComparisonResponse,
        JobMatchResponse,
        MatchRequest,
        ResumeVersionResponse,
        ResumeVersionSummary,
        ScoreDelta,
        JobDescriptionInput,
        MultiMatchRequest,
        MultiMatchResponse,
        MultiMatchComparisonItem,
        InterviewQuestion,
        InterviewFeedback,
        InterviewAnswerRecord,
        InterviewStartRequest,
        InterviewStartResponse,
        InterviewAnswerRequest,
        InterviewAnswerResponse,
        InterviewSessionDetailResponse,
        InterviewSessionSummaryItem,
    )

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CareerLens API",
    description=(
        "Phase 6 + 7: Resume version history, ATS scoring, job match tracking, "
        "and LLM-powered bullet improvement suggestions. "
        "Phases 1–5 are wired as background logic.\n\n"
        "**user_id** is a plain string for now — no auth in this phase. "
        "The schema is auth-ready: swap in a real sub/UUID when auth is added."
    ),
    version="0.8.0",
)

# CORS — allow the Next.js dev server and any future production origin.
# Adjust allow_origins for production (replace * with your actual domain).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    """Validate MongoDB connectivity on server start."""
    try:
        client = get_versions_collection().database.client
        await client.admin.command("ping")
        print("[CareerLens] MongoDB connection OK.", flush=True)
    except Exception as exc:
        print(f"[CareerLens] WARNING: MongoDB ping failed: {exc}", flush=True)
        print("  Endpoints that touch the DB will return 503 until MongoDB is reachable.",
              flush=True)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_client()


# ---------------------------------------------------------------------------
# Utility — allowed resume file extensions
# ---------------------------------------------------------------------------
_ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _validate_resume_file(filename: str) -> str:
    """Raise HTTP 415 if the file type is not supported. Returns the suffix."""
    suffix = Path(filename).suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{suffix}'. Accepted: .pdf, .docx",
        )
    return suffix


# ---------------------------------------------------------------------------
# Score delta utility
# ---------------------------------------------------------------------------

def compute_score_deltas(versions: List[dict]) -> List[Optional[ScoreDelta]]:
    """
    Given a list of version dicts sorted oldest-first, compute per-version
    score deltas versus the previous version.

    Returns a parallel list of ScoreDelta objects (None delta for first version).

    Each delta covers:
      ats_delta         : change in overall_ats_score vs. prior version
      match_score_delta : change in latest_job_match_score vs. prior version
                          (None if either version has no match history)
    """
    deltas: List[Optional[ScoreDelta]] = []

    for i, version in enumerate(versions):
        if i == 0:
            deltas.append(ScoreDelta(ats_delta=None, match_score_delta=None))
            continue

        prev = versions[i - 1]

        ats_now  = version.get("overall_ats_score")
        ats_prev = prev.get("overall_ats_score")
        ats_delta = (ats_now - ats_prev) if (ats_now is not None and ats_prev is not None) else None

        match_now  = version.get("latest_job_match_score")
        match_prev = prev.get("latest_job_match_score")
        match_delta = (
            (match_now - match_prev)
            if (match_now is not None and match_prev is not None)
            else None
        )

        deltas.append(ScoreDelta(ats_delta=ats_delta, match_score_delta=match_delta))

    return deltas


# ---------------------------------------------------------------------------
# Endpoint 1 — POST /resumes/upload
# ---------------------------------------------------------------------------

@app.post(
    "/resumes/upload",
    response_model=ResumeVersionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a resume and compute ATS score",
    tags=["Resumes"],
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file (.pdf or .docx)."),
    user_id: str = Form(..., description="User identifier string."),
    version_label: str = Form(..., description="Version label, e.g. 'v2 - added CI/CD skills'."),
):
    """
    Upload a resume file, run Phase 1 (parser) + Phase 2 (ATS scorer),
    persist the result to `resume_versions`, and return the full scored result.

    The file is written to a temporary path, parsed, then deleted.
    Uploaded files are never stored permanently on disk — only the parsed JSON
    representation is persisted in MongoDB.
    """
    # -- Validate file type ------------------------------------------------
    suffix = _validate_resume_file(file.filename or "upload")

    # -- Write to a temp file for Phase 1 parser ---------------------------
    # NamedTemporaryFile with delete=False lets the parser open it by path on Windows
    # (Windows locks the file while it's open by the same process otherwise).
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False, mode="wb"
        ) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        # -- Phase 1: parse ------------------------------------------------
        try:
            parsed_data = parse_resume(tmp_path)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Resume parsing failed: {exc}",
            )

        # -- Phase 2: ATS score --------------------------------------------
        try:
            raw_text = extract_text(tmp_path)
            ats_score = score_resume(parsed_data, raw_text)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"ATS scoring failed: {exc}",
            )

    finally:
        # Always clean up the temp file
        if tmp_path and Path(tmp_path).exists():
            try:
                Path(tmp_path).unlink()
            except OSError:
                pass  # best-effort cleanup

    # -- Persist to MongoDB ------------------------------------------------
    now = datetime.now(timezone.utc)
    doc = {
        "user_id":       user_id,
        "version_label": version_label,
        "uploaded_at":   now,
        "raw_filename":  file.filename or "upload",
        "parsed_data":   parsed_data,
        "ats_score":     ats_score,
    }

    try:
        result = await get_versions_collection().insert_one(doc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database write failed: {exc}",
        )

    doc["_id"] = str(result.inserted_id)
    doc["uploaded_at"] = now

    return ResumeVersionResponse(**serialise_doc(doc))


# ---------------------------------------------------------------------------
# Endpoint 2 — GET /resumes/{user_id}
# ---------------------------------------------------------------------------

@app.get(
    "/resumes/{user_id}",
    response_model=List[ResumeVersionSummary],
    summary="List all resume versions for a user",
    tags=["Resumes"],
)
async def list_resume_versions(user_id: str):
    """
    Returns all saved resume versions for a user, ordered by upload date
    (newest first). Each entry includes the ATS score summary and version label.
    """
    try:
        cursor = get_versions_collection().find(
            {"user_id": user_id},
            # Exclude heavy parsed_data from the list view
            {"parsed_data": 0},
        ).sort("uploaded_at", -1)
        docs = await cursor.to_list(length=None)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if not docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No resume versions found for user_id='{user_id}'.",
        )

    summaries = []
    for doc in docs:
        sd = serialise_doc(doc)
        summaries.append(
            ResumeVersionSummary(
                **{
                    **sd,
                    "overall_ats_score": sd.get("ats_score", {}).get("overall_score", 0),
                }
            )
        )

    return summaries


# ---------------------------------------------------------------------------
# Endpoint 3 — POST /resumes/{version_id}/match
# ---------------------------------------------------------------------------

@app.post(
    "/resumes/{version_id}/match",
    response_model=JobMatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Match a saved resume version against a job description",
    tags=["Job Matching"],
)
async def match_resume_to_jd(version_id: str, body: MatchRequest):
    """
    Runs Phase 3 (semantic skill matching) + Phase 4 (job match score) against
    a saved resume version and persists the result to `job_match_history`.

    The version_id must be a valid MongoDB ObjectId string from a prior upload.
    """
    # -- Validate + fetch the saved version --------------------------------
    try:
        oid = ObjectId(version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )

    # -- Phase 3 + Phase 4 -------------------------------------------------
    parsed_data = version_doc.get("parsed_data", {})
    jd_text     = body.job_description_text.strip()

    if not jd_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="job_description_text must not be empty.",
        )

    try:
        job_match_result = await asyncio.to_thread(compute_job_match, parsed_data, jd_text)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Job match computation failed: {exc}",
        )

    # -- Persist to job_match_history --------------------------------------
    now = datetime.now(timezone.utc)
    history_doc = {
        "user_id":              version_doc["user_id"],
        "resume_version_id":    oid,
        "job_description_text": jd_text,
        "job_match_result":     job_match_result,
        "evaluated_at":         now,
    }

    try:
        result = await get_history_collection().insert_one(history_doc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database write failed: {exc}",
        )

    history_doc["_id"]               = str(result.inserted_id)
    history_doc["resume_version_id"] = version_id   # string for response
    history_doc["evaluated_at"]      = now

    return JobMatchResponse(**serialise_doc(history_doc))


# ---------------------------------------------------------------------------
# Endpoint 3b — POST /resumes/{version_id}/match-multiple  (Multi-JD Comparison)
# ---------------------------------------------------------------------------

@app.post(
    "/resumes/{version_id}/match-multiple",
    response_model=MultiMatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare a saved resume version against multiple job descriptions",
    tags=["Job Matching"],
)
async def match_resume_to_multiple_jds(version_id: str, body: MultiMatchRequest):
    """
    Evaluates a saved resume version against 1 to 4 target job descriptions.
    Reuses the Phase 3/4 compute_job_match pipeline for each JD independently.
    Returns an array of comparison results with the best-fit role highlighted.
    Handles partial failures gracefully so valid JDs still return results.
    """
    # 1. Validate version ID and fetch resume document
    try:
        oid = ObjectId(version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )

    parsed_data = version_doc.get("parsed_data", {})
    if not parsed_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Parsed resume data is empty or missing.",
        )

    # 2. Iterate through each JD and compute match
    comparisons: List[MultiMatchComparisonItem] = []
    best_fit_label: Optional[str] = None
    best_fit_score: int = -1

    for idx, jd_item in enumerate(body.job_descriptions):
        label = (jd_item.label or "").strip() or f"Target Role #{idx + 1}"
        jd_text = jd_item.job_description_text.strip()

        if not jd_text or len(jd_text) < 20:
            comparisons.append(
                MultiMatchComparisonItem(
                    label=label,
                    job_match_score=0,
                    breakdown={
                        "skill_overlap_score": 0.0,
                        "semantic_similarity_score": 0.0,
                        "experience_alignment_score": 0.0,
                    },
                    matched_skills=[],
                    related_skills=[],
                    missing_skills=[],
                    summary="Job description text was too short to evaluate (minimum 20 characters).",
                    error="Job description text was too short to evaluate.",
                )
            )
            continue

        try:
            # Reuses Phase 3 + 4 semantic matching pipeline
            result = await asyncio.to_thread(compute_job_match, parsed_data, jd_text)
            score = int(result.get("job_match_score", 0))

            # Persist to job_match_history for audit trail / history
            try:
                now = datetime.now(timezone.utc)
                history_doc = {
                    "user_id":              version_doc["user_id"],
                    "resume_version_id":    oid,
                    "job_description_text": jd_text,
                    "job_match_result":     result,
                    "evaluated_at":         now,
                    "comparison_label":     label,
                }
                await get_history_collection().insert_one(history_doc)
            except Exception:
                pass  # Non-fatal persistence

            comparisons.append(
                MultiMatchComparisonItem(
                    label=label,
                    job_match_score=score,
                    breakdown=result.get("breakdown", {}),
                    matched_skills=result.get("matched_skills", []),
                    related_skills=result.get("related_skills", []),
                    missing_skills=result.get("missing_skills", []),
                    summary=result.get("summary", ""),
                    error=None,
                )
            )

            if score > best_fit_score:
                best_fit_score = score
                best_fit_label = label

        except Exception as exc:
            # Graceful partial failure handling
            comparisons.append(
                MultiMatchComparisonItem(
                    label=label,
                    job_match_score=0,
                    breakdown={
                        "skill_overlap_score": 0.0,
                        "semantic_similarity_score": 0.0,
                        "experience_alignment_score": 0.0,
                    },
                    matched_skills=[],
                    related_skills=[],
                    missing_skills=[],
                    summary=f"Analysis failed: {exc}",
                    error=str(exc),
                )
            )

    return MultiMatchResponse(
        resume_version_id=version_id,
        total_compared=len(comparisons),
        comparisons=comparisons,
        best_fit_label=best_fit_label if best_fit_score >= 0 else None,
        best_fit_score=best_fit_score if best_fit_score >= 0 else None,
    )


# ---------------------------------------------------------------------------
# Endpoint 4 — GET /resumes/{user_id}/comparison
# ---------------------------------------------------------------------------

@app.get(
    "/resumes/{user_id}/comparison",
    response_model=ComparisonResponse,
    summary="Score progression across all resume versions for a user",
    tags=["Comparison"],
)
async def compare_resume_versions(user_id: str):
    """
    Returns all resume versions for a user ordered by upload date (oldest first),
    each annotated with:
      - overall ATS score
      - most recent job match score (if any match has been run for that version)
      - score deltas vs. the previous version

    This is the data needed to render a score-over-time chart.
    """
    # -- Fetch all versions (oldest first for delta calculation) -----------
    try:
        cursor = get_versions_collection().find(
            {"user_id": user_id},
            {"parsed_data": 0},     # exclude heavy blob
        ).sort("uploaded_at", 1)    # ascending → oldest first
        version_docs = await cursor.to_list(length=None)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if not version_docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No resume versions found for user_id='{user_id}'.",
        )

    # -- Fetch latest job match score per version --------------------------
    version_ids = [doc["_id"] for doc in version_docs]

    # For each version ID, find the most recent job_match_history entry.
    # We do this with a single aggregation rather than N queries.
    try:
        pipeline = [
            {"$match":   {"resume_version_id": {"$in": version_ids}}},
            {"$sort":    {"evaluated_at": -1}},
            {"$group":   {
                "_id":          "$resume_version_id",
                "latest_score": {"$first": "$job_match_result.job_match_score"},
            }},
        ]
        agg_cursor = get_history_collection().aggregate(pipeline)
        match_score_by_version = {
            str(row["_id"]): row["latest_score"]
            async for row in agg_cursor
        }
    except Exception as exc:
        # Non-fatal — comparison still works without match scores
        match_score_by_version = {}

    # -- Build intermediate list for delta calculation ---------------------
    enriched = []
    for doc in version_docs:
        sd = serialise_doc(doc)
        enriched.append({
            **sd,
            "overall_ats_score":      sd.get("ats_score", {}).get("overall_score", 0),
            "latest_job_match_score": match_score_by_version.get(sd["_id"]),
        })

    deltas = compute_score_deltas(enriched)

    # -- Assemble ComparisonEntry list -------------------------------------
    entries = []
    for row, delta in zip(enriched, deltas):
        entries.append(
            ComparisonEntry(
                **{k: v for k, v in row.items()
                   if k not in ("ats_score",)},   # drop nested ats_score blob
                delta=delta,
            )
        )

    return ComparisonResponse(
        user_id=user_id,
        total_versions=len(entries),
        versions=entries,
    )


# ---------------------------------------------------------------------------
# Endpoint 5 — POST /resumes/{version_id}/improve-bullets  (Phase 7)
# ---------------------------------------------------------------------------

@app.post(
    "/resumes/{version_id}/improve-bullets",
    summary="Suggest rewrites for weak bullet points in a saved resume version",
    tags=["Bullet Improvement"],
)
async def improve_bullets(
    version_id: str,
):
    """
    Phase 7 endpoint: identifies weak bullet points (missing action verb or
    quantifiable metric) in a saved resume version and calls the LLM provider
    chain (Gemini -> Groq -> mock) to generate stronger rewrites.

    This endpoint is a SUGGESTION layer only — it never modifies stored scores.
    The user decides which (if any) suggestions to accept.

    Set GEMINI_API_KEY and/or GROQ_API_KEY in .env for real LLM rewrites.
    Without keys the mock provider returns actionable template suggestions.
    """
    # -- Validate + fetch version ------------------------------------------
    try:
        oid = ObjectId(version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )

    parsed_data = version_doc.get("parsed_data", {})

    # -- Run Phase 7 bullet improver (non-blocking: runs sync in same thread) -
    # Note: improve_weak_bullets makes LLM calls which are I/O-bound but
    # currently synchronous. For high-concurrency production use, wrap in
    # asyncio.to_thread() — left as a TODO for Phase 8 optimisation.
    try:
        result = improve_weak_bullets(parsed_data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bullet improvement failed: {exc}",
        )

    return {
        "resume_version_id": version_id,
        "user_id":           str(version_doc.get("user_id", "")),
        "version_label":     version_doc.get("version_label", ""),
        **result,
    }



# ---------------------------------------------------------------------------
# Endpoint 6 — GET /resumes/{version_id}/recommendations  (Phase 5 wired to API)
# ---------------------------------------------------------------------------

@app.get(
    "/resumes/{version_id}/recommendations",
    summary="Get top role recommendations for a saved resume version",
    tags=["Role Recommender"],
)
async def get_role_recommendations(
    version_id: str,
    top_n: int = Query(default=5, ge=1, le=25, description="Number of top roles to return."),
):
    """
    Runs Phase 5's recommend_roles() against a saved resume version and returns
    the top-N best-matching roles from the curated role bank, each with a
    match score, matched/missing skills, and a gap summary.
    """
    try:
        oid = ObjectId(version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one(
            {"_id": oid}, {"parsed_data": 1, "user_id": 1, "version_label": 1}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )

    parsed_data = version_doc.get("parsed_data", {})

    try:
        recommendations = await asyncio.to_thread(recommend_roles, parsed_data, top_n=top_n)
        # Strip internal _breakdown key — not needed by the frontend
        for rec in recommendations:
            rec.pop("_breakdown", None)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Role recommendation failed: {exc}",
        )

    return {
        "resume_version_id": version_id,
        "user_id":           str(version_doc.get("user_id", "")),
        "version_label":     version_doc.get("version_label", ""),
        "recommendations":   recommendations,
    }


# ---------------------------------------------------------------------------
# Endpoint 7 — POST /resumes/{version_id}/export-pdf  (PDF Report Generation)
# ---------------------------------------------------------------------------

@app.api_route(
    "/resumes/{version_id}/export-pdf",
    methods=["POST", "GET"],
    summary="Download comprehensive resume diagnostic & match analysis as a PDF report",
    tags=["Reports"],
)
async def export_resume_pdf(
    version_id: str,
    job_match_id: Optional[str] = Query(
        default=None,
        description="Optional job match history ID to include target JD match analysis in the report.",
    ),
):
    """
    Generates a publication-grade light-mode PDF report for a saved resume version.
    Includes ATS score breakdown, diagnostic feedback, top priority issues,
    and (if job_match_id is provided) full job match fit analysis and top role recommendations.
    """
    # 1. Validate version ID
    try:
        oid = ObjectId(version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{version_id}' not found.",
        )

    # 2. Optionally fetch job match result
    match_doc = None
    if job_match_id:
        try:
            m_oid = ObjectId(job_match_id)
            match_doc = await get_history_collection().find_one({"_id": m_oid})
        except Exception:
            match_doc = None

    # 3. Top role recommendations
    recommendations = None
    try:
        parsed_data = version_doc.get("parsed_data", {})
        if parsed_data:
            recommendations = await asyncio.to_thread(recommend_roles, parsed_data, top_n=3)
            for rec in recommendations:
                rec.pop("_breakdown", None)
    except Exception:
        recommendations = None

    # 4. Generate PDF bytes
    try:
        pdf_bytes = await asyncio.to_thread(
            build_pdf_report,
            version_doc=version_doc,
            match_doc=match_doc,
            recommendations=recommendations,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report: {exc}",
        )

    # 5. Formulate clean filename
    raw_name = Path(version_doc.get("raw_filename", "resume")).stem
    clean_stem = "".join(c for c in raw_name if c.isalnum() or c in ("-", "_")).strip() or "resume"
    filename = f"careerlens_report_{clean_stem}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _generate_sample_report_file(out_path: Path) -> None:
    """Generates a sample report PDF file from mock data to verify report rendering."""
    sample_version = {
        "_id": "6650a1b2c3d4e5f6a7b8c9d0",
        "user_id": "test-user-demo",
        "version_label": "v2 - Senior Full-Stack Engineer Focus",
        "uploaded_at": datetime.now(timezone.utc),
        "raw_filename": "Alex_Mercer_Resume.pdf",
        "parsed_data": {
            "contact_info": {
                "name": "Alex Mercer",
                "email": "alex.mercer@devmail.io",
                "phone": "+1 (555) 234-5678",
                "linkedin": "linkedin.com/in/alex-mercer",
                "github": "github.com/alexmercer",
            },
            "skills": [
                "React", "TypeScript", "Python", "FastAPI", "Docker",
                "PostgreSQL", "Redis", "Kubernetes", "Next.js", "GraphQL", "AWS", "Git"
            ],
            "experience": [
                {
                    "title_company": "Senior Software Engineer — CloudScale Inc.",
                    "dates": "2022 - Present",
                    "bullets": [
                        "Architected event-driven microservices with FastAPI and Kafka, reducing p99 latency by 35%.",
                        "Led migration of monolithic frontend to Next.js and TypeScript, improving Core Web Vitals score to 96.",
                    ]
                }
            ],
            "education": [{"raw": "B.S. in Computer Science — Tech University", "dates": "2018 - 2022"}],
            "projects": [],
            "certifications": ["AWS Certified Solutions Architect"]
        },
        "ats_score": {
            "overall_score": 86,
            "breakdown": [
                {"category": "Section Completeness", "score": 20, "max_score": 20, "feedback": "All primary sections detected: Contact, Experience, Education, Skills."},
                {"category": "Contact Information", "score": 10, "max_score": 10, "feedback": "Complete contact block with verified email, phone, and professional GitHub/LinkedIn URLs."},
                {"category": "Bullet Point Quality", "score": 18, "max_score": 20, "feedback": "Strong action verbs (Architected, Led) and quantifiable metrics throughout bullets."},
                {"category": "Bullet Point Usage", "score": 15, "max_score": 15, "feedback": "Well-structured bulleted experience entries; high parsing readability."},
                {"category": "Resume Length", "score": 10, "max_score": 10, "feedback": "Estimated 520 words. Well within the optimal 400-800 word window."},
                {"category": "Skill Density", "score": 8, "max_score": 10, "feedback": "Good density across technical skills without keyword redundancy."},
                {"category": "Formatting & Layout", "score": 15, "max_score": 15, "feedback": "Clean single-column structure with standard header hierarchy."}
            ],
            "top_issues": [
                "Add quantified latency or revenue impact to project descriptions",
                "Consider grouping backend vs frontend skills for faster recruiter visual scan"
            ]
        }
    }

    sample_match = {
        "job_match_result": {
            "job_match_score": 88,
            "breakdown": {
                "skill_overlap_score": 92.0,
                "semantic_similarity_score": 85.5,
                "experience_alignment_score": 86.0
            },
            "matched_skills": ["React", "TypeScript", "Python", "FastAPI", "Docker", "PostgreSQL", "Git"],
            "related_skills": [
                {"resume_skill": "PostgreSQL", "jd_term": "Relational Databases / SQL", "similarity": 0.93},
                {"resume_skill": "Docker", "jd_term": "Container Orchestration", "similarity": 0.88},
                {"resume_skill": "FastAPI", "jd_term": "High-Throughput Microservices", "similarity": 0.84}
            ],
            "missing_skills": ["Kubernetes Helm Charts", "Terraform / IaC"],
            "summary": "Strong alignment with the Senior Full-Stack role. Demonstrated proficiency across core frontend (React/TypeScript) and backend (FastAPI/PostgreSQL) requirements with solid containerization background."
        }
    }

    sample_recs = [
        {
            "role_title": "Full-Stack Developer",
            "match_score": 91,
            "matched_skills": ["React", "TypeScript", "Python", "PostgreSQL", "Docker"],
            "gap_summary": "Exceptional fit with core web and API stack. Adding CI/CD pipeline examples will close remaining gaps."
        },
        {
            "role_title": "Backend Developer",
            "match_score": 85,
            "matched_skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"],
            "gap_summary": "Strong server-side API foundation. Further highlight distributed caching and messaging patterns."
        },
        {
            "role_title": "DevOps Engineer",
            "match_score": 72,
            "matched_skills": ["Docker", "Kubernetes", "AWS", "Git"],
            "gap_summary": "Solid container baseline; recommend adding Infrastructure-as-Code and deployment automation."
        }
    ]

    pdf_bytes = build_pdf_report(sample_version, sample_match, sample_recs)
    out_path.write_bytes(pdf_bytes)


# ---------------------------------------------------------------------------
# Endpoint 8 — Interactive Mock Interview (Phase 8 Extension)
# ---------------------------------------------------------------------------

@app.post(
    "/interviews/start",
    response_model=InterviewStartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start an interactive mock interview session",
    tags=["Mock Interview"],
)
async def start_mock_interview(body: InterviewStartRequest):
    """
    Initializes a new text-based mock interview session tailored to the user's
    resume version and optional target job description. Generates a multi-turn
    question set (warm-up, behavioral STAR, technical depth) and returns Question #1.
    """
    # 1. Validate version ID
    try:
        oid = ObjectId(body.resume_version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{body.resume_version_id}' is not a valid resume version ID.",
        )

    try:
        version_doc = await get_versions_collection().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if version_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume version '{body.resume_version_id}' not found.",
        )

    # 2. Fetch optional job match JD text
    jd_text: Optional[str] = None
    m_oid: Optional[ObjectId] = None
    if body.job_match_id:
        try:
            m_oid = ObjectId(body.job_match_id)
            match_doc = await get_history_collection().find_one({"_id": m_oid})
            if match_doc:
                jd_text = match_doc.get("job_description_text")
        except Exception:
            m_oid = None

    parsed_data = version_doc.get("parsed_data", {})

    # 3. Generate questions in threadpool
    try:
        questions = await asyncio.to_thread(
            generate_interview_questions,
            parsed_resume=parsed_data,
            jd_text=jd_text,
            num_questions=body.num_questions,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate interview questions: {exc}",
        )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to formulate questions for this profile.",
        )

    # 4. Create and persist session document
    now = datetime.now(timezone.utc)
    session_doc = {
        "user_id":                version_doc["user_id"],
        "resume_version_id":       oid,
        "job_match_id":           m_oid,
        "status":                 "in_progress",
        "questions":              questions,
        "answers":                [],
        "current_question_index": 0,
        "is_complete":            False,
        "summary":                None,
        "created_at":             now,
        "updated_at":             now,
    }

    try:
        result = await get_interviews_collection().insert_one(session_doc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database write failed: {exc}",
        )

    session_id_str = str(result.inserted_id)

    return InterviewStartResponse(
        _id=session_id_str,
        user_id=str(version_doc["user_id"]),
        resume_version_id=str(body.resume_version_id),
        job_match_id=str(body.job_match_id) if body.job_match_id else None,
        total_questions=len(questions),
        current_question_index=0,
        first_question=InterviewQuestion(**questions[0]),
        created_at=now,
    )


@app.post(
    "/interviews/{session_id}/answer",
    response_model=InterviewAnswerResponse,
    summary="Submit an answer to the current interview question and receive critique",
    tags=["Mock Interview"],
)
async def submit_interview_answer(session_id: str, body: InterviewAnswerRequest):
    """
    Submits candidate's answer for the active question, invokes LLM critique
    (strengths, improvements, suggested STAR angle, score), persists to history,
    and returns feedback plus the next question (or final summary if complete).
    """
    try:
        s_oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{session_id}' is not a valid interview session ID.",
        )

    try:
        session_doc = await get_interviews_collection().find_one({"_id": s_oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if session_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found.",
        )

    if session_doc.get("is_complete", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This interview session is already complete.",
        )

    questions = session_doc.get("questions", [])
    curr_idx = session_doc.get("current_question_index", 0)

    if curr_idx >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All questions in this session have already been answered.",
        )

    active_question = questions[curr_idx]

    # Fetch resume + JD context for critique grounding
    parsed_data = {}
    jd_text = None
    try:
        v_doc = await get_versions_collection().find_one({"_id": session_doc["resume_version_id"]})
        if v_doc:
            parsed_data = v_doc.get("parsed_data", {})
        if session_doc.get("job_match_id"):
            m_doc = await get_history_collection().find_one({"_id": session_doc["job_match_id"]})
            if m_doc:
                jd_text = m_doc.get("job_description_text")
    except Exception:
        pass

    # Evaluate answer in worker threadpool
    try:
        feedback = await asyncio.to_thread(
            evaluate_answer,
            question=active_question,
            answer=body.answer.strip(),
            parsed_resume=parsed_data,
            jd_text=jd_text,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Answer evaluation failed: {exc}",
        )

    now = datetime.now(timezone.utc)
    answer_record = {
        "question_index": curr_idx,
        "question":       active_question.get("question", ""),
        "category":       active_question.get("category", ""),
        "answer_text":    body.answer.strip(),
        "feedback":       feedback,
        "answered_at":    now,
    }

    answers = session_doc.get("answers", [])
    updated_answers = answers + [answer_record]
    next_idx = curr_idx + 1
    is_complete = next_idx >= len(questions)

    session_summary = None
    if is_complete:
        feedback_list = [a["feedback"] for a in updated_answers]
        try:
            session_summary = await asyncio.to_thread(
                generate_session_summary,
                questions=questions,
                answers=updated_answers,
                feedback_list=feedback_list,
            )
        except Exception:
            session_summary = None

    update_fields = {
        "answers":                updated_answers,
        "current_question_index": next_idx,
        "is_complete":            is_complete,
        "status":                 "completed" if is_complete else "in_progress",
        "updated_at":             now,
    }
    if session_summary:
        update_fields["summary"] = session_summary

    try:
        await get_interviews_collection().update_one(
            {"_id": s_oid},
            {"$set": update_fields}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database update failed: {exc}",
        )

    next_q = InterviewQuestion(**questions[next_idx]) if not is_complete else None

    return InterviewAnswerResponse(
        session_id=session_id,
        question_index=curr_idx,
        feedback=InterviewFeedback(**feedback),
        is_complete=is_complete,
        current_question_index=next_idx,
        next_question=next_q,
        summary=session_summary,
    )


@app.get(
    "/interviews/{session_id}",
    response_model=InterviewSessionDetailResponse,
    summary="Get full details of an interview session",
    tags=["Mock Interview"],
)
async def get_interview_session(session_id: str):
    """
    Returns full state of an interview session, including all questions,
    user answers, turn-by-turn critiques, and completion summary if available.
    """
    try:
        s_oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{session_id}' is not a valid interview session ID.",
        )

    try:
        session_doc = await get_interviews_collection().find_one({"_id": s_oid})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    if session_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview session '{session_id}' not found.",
        )

    return InterviewSessionDetailResponse(**serialise_doc(session_doc))


@app.get(
    "/interviews/user/{user_id}",
    response_model=List[InterviewSessionSummaryItem],
    summary="List all mock interview sessions for a user",
    tags=["Mock Interview"],
)
async def list_user_interviews(user_id: str):
    """
    Returns a history of all interview sessions started by this user,
    ordered by date descending.
    """
    try:
        cursor = get_interviews_collection().find({"user_id": user_id}).sort("created_at", -1)
        docs = await cursor.to_list(length=50)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database read failed: {exc}",
        )

    summaries: List[InterviewSessionSummaryItem] = []
    for doc in docs:
        sd = serialise_doc(doc)
        answers = sd.get("answers", [])
        scores = [a.get("feedback", {}).get("score") for a in answers if a.get("feedback", {}).get("score") is not None]
        avg = round(sum(scores) / len(scores), 1) if scores else None
        verdict = sd.get("summary", {}).get("overall_verdict") if sd.get("summary") else None

        summaries.append(
            InterviewSessionSummaryItem(
                _id=sd["_id"],
                user_id=sd["user_id"],
                resume_version_id=str(sd.get("resume_version_id", "")),
                job_match_id=str(sd["job_match_id"]) if sd.get("job_match_id") else None,
                status=sd.get("status", "in_progress"),
                total_questions=len(sd.get("questions", [])),
                answered_questions=len(answers),
                average_score=avg,
                overall_verdict=verdict,
                created_at=sd["created_at"],
            )
        )

    return summaries


# ---------------------------------------------------------------------------
# Root — healthcheck
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "CareerLens API", "phase": "6+7+8"}
