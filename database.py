"""
Phase 6 — MongoDB connection & collection helpers
===================================================
Provides a single Motor (async) client, typed collection accessors, and a
helper that serialises BSON ObjectIds to plain strings for JSON responses.

The connection string and database name are loaded from environment variables
(set in a .env file — see .env.example). Never hardcode credentials here.
"""

from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection

# ---------------------------------------------------------------------------
# Load .env file if present (no-op if it doesn't exist)
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# Config — overridable via environment
# ---------------------------------------------------------------------------
MONGO_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME: str  = os.getenv("DATABASE_NAME", "careerlens")

# Collection names — change here if needed, not scattered across the codebase.
COLLECTION_VERSIONS:   str = "resume_versions"
COLLECTION_HISTORY:    str = "job_match_history"
COLLECTION_INTERVIEWS: str = "interview_sessions"

# ---------------------------------------------------------------------------
# Client lifecycle
# ---------------------------------------------------------------------------
_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    """Return (or lazily create) the shared Motor client."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


async def close_client() -> None:
    """Close the Motor client — call from FastAPI shutdown event."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


# ---------------------------------------------------------------------------
# Typed collection accessors
# ---------------------------------------------------------------------------

def get_versions_collection() -> AsyncIOMotorCollection:
    return get_client()[DATABASE_NAME][COLLECTION_VERSIONS]


def get_history_collection() -> AsyncIOMotorCollection:
    return get_client()[DATABASE_NAME][COLLECTION_HISTORY]


def get_interviews_collection() -> AsyncIOMotorCollection:
    return get_client()[DATABASE_NAME][COLLECTION_INTERVIEWS]


# ---------------------------------------------------------------------------
# BSON → JSON serialisation helper
# ---------------------------------------------------------------------------

def serialise_doc(doc: dict) -> dict:
    """
    Convert a MongoDB document to a JSON-safe dict:
      - ObjectId fields → str
      - datetime fields left as-is (FastAPI/Pydantic handles them)
    Recursively handles nested dicts and lists.
    """
    from bson import ObjectId

    if doc is None:
        return {}

    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, dict):
            out[k] = serialise_doc(v)
        elif isinstance(v, list):
            out[k] = [serialise_doc(i) if isinstance(i, dict) else i for i in v]
        else:
            out[k] = v
    return out
