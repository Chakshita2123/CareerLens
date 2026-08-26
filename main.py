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
from fastapi.responses import JSONResponse

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
    from database import (
        close_client,
        get_history_collection,
        get_versions_collection,
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
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from resume_parser.parser import parse_resume
    from resume_parser.extractor import extract_text
    from ats_scorer import score_resume
    from job_match_scorer import compute_job_match
    from bullet_improver import improve_weak_bullets
    from role_recommender import recommend_roles
    from database import (
        close_client,
        get_history_collection,
        get_versions_collection,
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
        job_match_result = compute_job_match(parsed_data, jd_text)
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
        recommendations = recommend_roles(parsed_data, top_n=top_n)
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
# Root — healthcheck
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "CareerLens API", "phase": "6+7+8"}
