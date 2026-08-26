"""
Phase 3 — Semantic Similarity Engine
======================================
Computes semantic similarity between resume content and job description
requirements using sentence embeddings, catching conceptual matches that
exact string matching misses entirely (e.g. "React" ↔ "component-based UI
frameworks", "MongoDB" ↔ "NoSQL databases").

Architecture
------------
  embed_texts(texts)               → np.ndarray of embeddings (batch call)
  compute_similarity(text_a, text_b) → float cosine similarity in [0, 1]
  match_skills(resume_skills, jd)  → { exact_matches, semantic_matches, missing }

The SentenceTransformer model is loaded ONCE at module level — not per call.
All embed calls are batched (two total per match_skills call: one for resume
skills, one for JD terms) to avoid O(n×m) separate inference calls.

Tunable constants are declared at the top and clearly labelled.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Union

# ---------------------------------------------------------------------------
# Cache redirect — fixes PermissionError on the default HF cache path.
# Points the Hugging Face / Transformers download cache to a local folder
# inside the project so no system-wide write access is needed.
# The folder is created automatically on first run.
# ---------------------------------------------------------------------------
_CACHE_DIR = str(Path(__file__).parent / ".hf_cache")
os.environ.setdefault("HF_HOME", _CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", _CACHE_DIR)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", _CACHE_DIR)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")  # suppress OneDrive symlink warning

import numpy as np
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Tunable constants  ← adjust here without touching logic
# ---------------------------------------------------------------------------

# Minimum cosine similarity to classify a pair as a "semantic match".
# Calibrated to all-MiniLM-L6-v2's actual output range for tech brand-name
# vs. category-description pairs (0.45–0.70 for related, <0.35 for unrelated).
# Raise to 0.55+ for stricter precision; lower to 0.35 for maximum recall.
SEMANTIC_THRESHOLD: float = 0.45

# Model name — all-MiniLM-L6-v2 is compact (~80 MB), fast on CPU, and
# performs well for short technical phrase similarity tasks.
# Swap to "all-mpnet-base-v2" for higher quality at the cost of ~4× the size.
EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"

# Skill context expansions  ← add entries here to improve brand-name matching.
# Problem: bare brand names like "React" or "Redis" score poorly against
# category descriptions like "component-based UI frameworks" because the model
# sees them as isolated tokens. Enriching them with a brief category hint
# dramatically improves cosine similarity for these pairs.
# Keys are exact canonical skill names (matching SKILL_GAZETTEER casing).
SKILL_CONTEXT_EXPANSIONS: Dict[str, str] = {
    "React":       "React JavaScript UI component library",
    "Vue":          "Vue JavaScript frontend UI framework",
    "Angular":     "Angular TypeScript frontend UI framework",
    "Node.js":     "Node.js server-side JavaScript runtime",
    "Express":     "Express Node.js server-side web framework",
    "Next.js":     "Next.js React server-side rendering framework",
    "Redis":       "Redis in-memory cache key-value database",
    "MongoDB":     "MongoDB NoSQL document-oriented database",
    "PostgreSQL":  "PostgreSQL relational SQL database",
    "MySQL":       "MySQL relational SQL database",
    "SQLite":      "SQLite embedded relational SQL database",
    "DynamoDB":    "DynamoDB AWS NoSQL managed database",
    "Cassandra":   "Cassandra distributed NoSQL database",
    "Elasticsearch": "Elasticsearch distributed search and analytics engine",
    "Docker":      "Docker container virtualisation and packaging tool",
    "Kubernetes":  "Kubernetes container orchestration platform",
    "AWS":         "AWS Amazon cloud infrastructure platform",
    "GCP":         "GCP Google cloud infrastructure platform",
    "Azure":       "Azure Microsoft cloud infrastructure platform",
    "Kafka":       "Kafka distributed event streaming message queue",
    "Spark":       "Apache Spark distributed big data processing framework",
    "FastAPI":     "FastAPI Python async web API framework",
    "Django":      "Django Python full-stack web framework",
    "Flask":       "Flask Python lightweight web microframework",
    "Spring Boot": "Spring Boot Java enterprise web framework",
    "TensorFlow":  "TensorFlow deep learning neural network framework",
    "PyTorch":     "PyTorch deep learning neural network framework",
    "scikit-learn": "scikit-learn Python machine learning library",
    "Pandas":      "Pandas Python data analysis and manipulation library",
    "NumPy":       "NumPy Python numerical array computing library",
    "GraphQL":     "GraphQL API query language and runtime",
    "REST":        "REST RESTful HTTP API design",
    "CI/CD":       "CI/CD continuous integration and deployment pipeline",
    "Git":         "Git distributed version control system",
    "Linux":       "Linux Unix command-line operating system",
    "SQL":         "SQL structured relational database query language",
}

# ---------------------------------------------------------------------------
# Model — loaded once at import time
# ---------------------------------------------------------------------------

print(f"[semantic_engine] Loading embedding model '{EMBEDDING_MODEL_NAME}' …",
      file=sys.stderr)
_MODEL: SentenceTransformer = SentenceTransformer(EMBEDDING_MODEL_NAME)
print("[semantic_engine] Model ready.", file=sys.stderr)


# ---------------------------------------------------------------------------
# Core embedding & similarity functions
# ---------------------------------------------------------------------------

def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Batch-embed a list of strings.

    Returns an ndarray of shape (len(texts), embedding_dim).
    Embeddings are L2-normalised so cosine similarity == dot product.
    """
    if not texts:
        return np.empty((0, _MODEL.get_sentence_embedding_dimension()))
    embeddings = _MODEL.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,   # ← unit vectors → dot product = cosine sim
        show_progress_bar=False,
    )
    return embeddings


def compute_similarity(text_a: str, text_b: str) -> float:
    """
    Cosine similarity between two texts, returned as a float in [0.0, 1.0].
    Uses a single batch call of size 2 for efficiency.
    """
    embs = embed_texts([text_a, text_b])
    return float(np.dot(embs[0], embs[1]))


def _expand_skill(skill: str) -> str:
    """
    Look up a skill in SKILL_CONTEXT_EXPANSIONS.
    Returns the enriched description if found, the original skill otherwise.
    """
    return SKILL_CONTEXT_EXPANSIONS.get(skill, skill)

# ---------------------------------------------------------------------------
# JD skill extraction (reuses Phase 1 gazetteer approach)
# ---------------------------------------------------------------------------

# Import the gazetteer & compiled patterns from Phase 1 extractor.
# This intentionally avoids duplicating the skill list — one source of truth.
try:
    from resume_parser.extractors import SKILL_GAZETTEER, _SKILL_PATTERNS
except ImportError:
    # Fallback if run from a different working directory
    import pathlib as _pathlib
    sys.path.insert(0, str(_pathlib.Path(__file__).parent))
    from resume_parser.extractors import SKILL_GAZETTEER, _SKILL_PATTERNS


def _extract_jd_skills_from_text(jd_text: str) -> List[str]:
    """
    Pull candidate skill terms from raw JD text using the Phase 1 gazetteer.
    Returns a list of canonical skill names found in the JD.
    """
    found = []
    for skill, pattern in _SKILL_PATTERNS.items():
        if pattern.search(jd_text):
            found.append(skill)
    return found


# ---------------------------------------------------------------------------
# Skill matching — the key deliverable
# ---------------------------------------------------------------------------

def match_skills(
    resume_skills: List[str],
    jd_skills_or_text: Union[List[str], str],
) -> Dict:
    """
    Compare resume skill list against JD requirements semantically.

    Args:
        resume_skills:      Skill list from Phase 1 parse_resume()["skills"]
        jd_skills_or_text:  Either a pre-extracted list of JD skill/requirement
                            strings, OR raw JD text (gazetteer extraction applied).

    Returns:
        {
          "exact_matches":    [ str, ... ],
          "semantic_matches": [ { "resume_skill", "jd_term", "similarity" }, ... ],
          "missing":          [ str, ... ],   # JD terms with no match at/above threshold
          "jd_terms_used":    [ str, ... ],   # what the engine actually matched against
        }
    """
    # -- 1. Resolve JD terms -------------------------------------------------
    if isinstance(jd_skills_or_text, str):
        jd_terms = _extract_jd_skills_from_text(jd_skills_or_text)
        if not jd_terms:
            # No gazetteer hits — fall back to splitting on commas/semicolons/newlines
            jd_terms = [
                t.strip()
                for t in re.split(r"[,;\n]+", jd_skills_or_text)
                if t.strip()
            ]
    else:
        jd_terms = list(jd_skills_or_text)

    if not resume_skills or not jd_terms:
        return {
            "exact_matches":    [],
            "semantic_matches": [],
            "missing":          jd_terms,
            "jd_terms_used":    jd_terms,
        }

    # -- 2. Exact matches (case-insensitive set intersection) ----------------
    resume_lower = {s.lower(): s for s in resume_skills}
    jd_lower     = {t.lower(): t for t in jd_terms}

    exact_matches    = [resume_lower[k] for k in resume_lower if k in jd_lower]
    unmatched_resume = [s for s in resume_skills if s.lower() not in jd_lower]
    unmatched_jd     = [t for t in jd_terms     if t.lower() not in resume_lower]

    # -- 3. Batch embed unmatched candidates ---------------------------------
    #       Two encode calls total regardless of list sizes.
    sem_matches: List[Dict] = []
    remaining_jd = list(unmatched_jd)  # will shrink as we match

    if unmatched_resume and unmatched_jd:
        # Expand bare brand names before embedding to improve similarity scores.
        # e.g. "React" → "React JavaScript UI component library" scores far
        # higher against "component-based UI frameworks" than the bare name.
        expanded_resume = [_expand_skill(s) for s in unmatched_resume]

        resume_embs = embed_texts(expanded_resume)  # shape (R, D)
        jd_embs     = embed_texts(unmatched_jd)     # shape (J, D)

        # Similarity matrix: (R, J) — dot product of unit vectors = cosine sim
        sim_matrix = resume_embs @ jd_embs.T         # shape (R, J)

        # For each JD term, find the highest-similarity resume skill
        matched_jd_indices: set[int] = set()
        for j, jd_term in enumerate(unmatched_jd):
            best_i   = int(np.argmax(sim_matrix[:, j]))
            best_sim = float(sim_matrix[best_i, j])
            if best_sim >= SEMANTIC_THRESHOLD:
                sem_matches.append({
                    "resume_skill": unmatched_resume[best_i],
                    "jd_term":      jd_term,
                    "similarity":   round(best_sim, 4),
                })
                matched_jd_indices.add(j)

        remaining_jd = [
            t for k, t in enumerate(unmatched_jd)
            if k not in matched_jd_indices
        ]

    # -- 4. Sort semantic matches by similarity desc for readability ---------
    sem_matches.sort(key=lambda m: m["similarity"], reverse=True)

    return {
        "exact_matches":    sorted(exact_matches),
        "semantic_matches": sem_matches,
        "missing":          sorted(remaining_jd),
        "jd_terms_used":    jd_terms,
    }


# ---------------------------------------------------------------------------
# __main__ — run directly to see Phase 3 output against a built-in example
# Usage:  python semantic_engine.py
#         python semantic_engine.py <path/to/resume.docx|.pdf>
# ---------------------------------------------------------------------------

# JD requirements supplied as a list of phrases — NOT raw JD text.
# This bypasses the gazetteer entirely so the semantic engine has to do all
# the matching. Every entry here is a category description; none of them are
# exact skill names from the gazetteer.
_DEMO_JD_REQUIREMENTS = [
    "component-based UI frameworks",       # should match React
    "server-side JavaScript runtimes",     # should match Node.js
    "relational database systems",         # should match PostgreSQL
    "in-memory caching layers",            # should match Redis
    "containerisation tools",              # should match Docker
    "cloud infrastructure platforms",      # should match AWS
    "scripting and backend languages",     # should match Python
    "version control workflows",           # should match Git
    "CI/CD deployment pipelines",          # not on resume → missing
    "deep learning frameworks",            # should match TensorFlow or PyTorch
    "data manipulation libraries",         # should match Pandas or NumPy
]

# Demo resume skills — mirrors the Phase 1 test_resume_A.docx skill set.
# Replaced at runtime if a resume path is provided as argv[1].
_DEMO_RESUME_SKILLS = [
    "Python", "FastAPI", "React", "Node.js", "PostgreSQL",
    "Docker", "AWS", "Git", "TensorFlow", "PyTorch",
    "scikit-learn", "Pandas", "NumPy", "Redis",
]

_DIVIDER = "=" * 72
_THIN    = "-" * 72


def _sim_bar(sim: float, width: int = 20) -> str:
    """ASCII progress bar + pass/fail mark for a similarity score."""
    filled = round(width * sim)
    mark   = "✓" if sim >= SEMANTIC_THRESHOLD else "✗"
    return f"[{'█' * filled}{'░' * (width - filled)}] {sim:.3f} {mark}"


if __name__ == "__main__":
    import pathlib

    # ── Optional: parse a real resume if a path is given ─────────────────
    if len(sys.argv) > 1:
        resume_path = sys.argv[1]
        try:
            from resume_parser.parser import parse_resume
            parsed = parse_resume(resume_path)
            resume_skills = parsed["skills"]
            print(f"\nParsed resume: {pathlib.Path(resume_path).name}")
        except Exception as exc:
            print(f"[WARN] Could not parse resume ({exc}), using demo skill list.")
            resume_skills = _DEMO_RESUME_SKILLS
    else:
        resume_skills = _DEMO_RESUME_SKILLS

    # ── 1. Sanity-check: expanded vs bare brand-name similarity ──────────
    # Shows WHY expansion is needed: bare brand names score poorly against
    # category descriptions; the expanded form fixes this.
    SANITY_PAIRS = [
        # (label, text_a, text_b)
        # Bare brand names → category (these will score low without expansion)
        ("[bare]  React  ↔  component-based UI frameworks",
            "React",
            "component-based UI frameworks"),
        ("[bare]  Redis  ↔  in-memory caching layers",
            "Redis",
            "in-memory caching layers"),
        ("[bare]  AWS    ↔  cloud infrastructure platforms",
            "AWS",
            "cloud infrastructure platforms"),
        # Expanded form → same category (these score much higher)
        ("[exp.]  React  ↔  component-based UI frameworks",
            _expand_skill("React"),
            "component-based UI frameworks"),
        ("[exp.]  Redis  ↔  in-memory caching layers",
            _expand_skill("Redis"),
            "in-memory caching layers"),
        ("[exp.]  AWS    ↔  cloud infrastructure platforms",
            _expand_skill("AWS"),
            "cloud infrastructure platforms"),
        # Clearly unrelated — should stay low at any expansion level
        ("[bare]  Python ↔  graphic design",
            "Python",
            "graphic design"),
        ("[bare]  Docker ↔  baking recipes",
            "Docker",
            "baking recipes"),
    ]

    print(f"\n{_DIVIDER}")
    print("  SANITY CHECK — bare brand name vs. expanded form")
    print(f"  Threshold = {SEMANTIC_THRESHOLD}   (✓ = above, ✗ = below)")
    print(_THIN)
    print(f"  {'Pair':<50}  Similarity")
    print(f"  {'-'*50}  {'-'*28}")

    for label, a, b in SANITY_PAIRS:
        sim = compute_similarity(a, b)
        print(f"  {label:<50}  {_sim_bar(sim)}")

    # ── 2. Full match_skills() run — JD as a requirements list ────────────
    # Using a list bypasses the gazetteer; the semantic engine must match
    # resume skill names against descriptive category phrases.
    print(f"\n{_DIVIDER}")
    print("  SKILL MATCH — Resume Skills  ×  JD Requirements (phrase list)")
    print(_THIN)
    print(f"  Resume skills ({len(resume_skills)}): {', '.join(resume_skills)}")
    print()
    print(f"  JD requirements ({len(_DEMO_JD_REQUIREMENTS)}):")
    for req in _DEMO_JD_REQUIREMENTS:
        print(f"     • {req}")
    print()

    result = match_skills(resume_skills, _DEMO_JD_REQUIREMENTS)

    # Exact matches
    exact = result["exact_matches"]
    print(f"  ── Exact Matches ({len(exact)}) " + "─" * 40)
    if exact:
        for s in exact:
            print(f"     ✔  {s}")
    else:
        print("     (none — expected: requirements are descriptive phrases, not skill names)")
    print()

    # Semantic matches
    sem = result["semantic_matches"]
    print(f"  ── Semantic Matches ({len(sem)}) " + "─" * 38)
    if sem:
        print(f"  {'Resume Skill':<22} {'JD Requirement':<38} Similarity")
        print(f"  {'-'*22} {'-'*38} {'-'*22}")
        for m in sem:
            bar = _sim_bar(m["similarity"])
            print(f"  {m['resume_skill']:<22} {m['jd_term']:<38} {bar}")
    else:
        print("     (none)")
    print()

    # Missing
    missing = result["missing"]
    print(f"  ── Missing / No Match >= {SEMANTIC_THRESHOLD} ({len(missing)}) " + "─" * 30)
    if missing:
        for t in missing:
            print(f"     ✘  {t}")
    else:
        print("     (none — all JD requirements matched!)")

    print(_DIVIDER)
