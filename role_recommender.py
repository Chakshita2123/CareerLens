"""
Phase 5 — Job Role Recommender + Skill Gap Analysis
======================================================
Given a parsed resume (Phase 1 output), ranks every role in the curated
role bank (role_bank.py) by how well the resume matches it, then returns
the top-N recommendations with a per-role skill gap breakdown.

Architecture
------------
  analyze_skill_gap(resume_skills, role) -> dict
      Reusable standalone function: computes exact + semantic skill overlap
      between a resume and one specific role. Call independently when you
      want to inspect a manually-chosen role (not just the auto-recommended ones).

  recommend_roles(parsed_resume, top_n=5) -> list[dict]
      Scores the entire role bank and returns the top-N matches, each
      with a match_score, matched/missing skills, and a gap_summary.

Scoring approach (deliberately mirrors Phase 4's structure):
  - Skill overlap (60 % weight): Phase 3 match_skills() exact + semantic hits
    against the role's required_skills list.
    Formula: (exact * 1.0 + semantic * SEMANTIC_WEIGHT) / total_required
  - Holistic similarity (40 % weight): cosine similarity between the resume's
    full skill+experience text and the role's description concatenated with
    its required_skills, rescaled to [0, 100].

Weights are declared as named constants at the top for easy retuning.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Cache redirect — must precede all HF / sentence-transformers imports.
# ---------------------------------------------------------------------------
_CACHE_DIR = str(Path(__file__).parent / ".hf_cache")
os.environ.setdefault("HF_HOME", _CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", _CACHE_DIR)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", _CACHE_DIR)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# ---------------------------------------------------------------------------
# TUNABLE CONSTANTS  <- adjust here, nowhere else
# ---------------------------------------------------------------------------

# --- Recommender component weights (must sum to 1.0) ---
# Skill overlap is weighted higher because for role recommendation we care
# most about concrete skill coverage, not just prose similarity.
W_SKILL_OVERLAP: float = 0.60
W_HOLISTIC_SIM: float  = 0.40

assert abs(W_SKILL_OVERLAP + W_HOLISTIC_SIM - 1.0) < 1e-9, \
    "Recommender weights must sum to 1.0"

# Partial credit for semantic (non-exact) skill matches — mirrors Phase 4.
SEMANTIC_WEIGHT: float = 0.7

# Cosine rescaling bounds — same logic as Phase 4's _semantic_similarity_score.
# Raw cosine for tech role descriptions vs. resume text sits in ~[0.25, 0.80].
SIM_FLOOR: float = 0.0
SIM_CEIL:  float = 0.80

# Default number of roles returned by recommend_roles().
DEFAULT_TOP_N: int = 5

# ---------------------------------------------------------------------------
# Imports from earlier phases
# ---------------------------------------------------------------------------
try:
    from semantic_engine import match_skills, compute_similarity
    from role_bank import ROLE_BANK, Role
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from semantic_engine import match_skills, compute_similarity
    from role_bank import ROLE_BANK, Role


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_resume_text(parsed: Dict) -> str:
    """
    Assemble a single string from the resume's skill + experience content.
    Replicates the same helper from Phase 4 (intentionally not importing from
    job_match_scorer to keep this module self-contained and testable independently).
    """
    parts: List[str] = []

    skills = parsed.get("skills", [])
    if skills:
        parts.append("Skills: " + ", ".join(skills))

    for role in parsed.get("experience", []):
        tc = role.get("title_company", "")
        if tc:
            parts.append(tc)
        for b in role.get("bullets", []):
            parts.append(b)

    for proj in parsed.get("projects", []):
        name = proj.get("name", "")
        if name:
            parts.append(name)
        for b in proj.get("bullets", []):
            parts.append(b)

    return " ".join(parts)


def _role_text(role: Role) -> str:
    """
    Concatenate a role's description and required_skills into a single string
    for holistic embedding comparison.
    """
    return role["description"] + " Skills: " + ", ".join(role["required_skills"])


def _skill_overlap_score(match_result: Dict) -> float:
    """
    0-100 score from Phase 3 match_skills() output.
    Mirrors the helper in job_match_scorer.py.
    """
    exact    = len(match_result.get("exact_matches", []))
    semantic = len(match_result.get("semantic_matches", []))
    missing  = len(match_result.get("missing", []))
    total    = exact + semantic + missing
    if total == 0:
        return 0.0
    numerator = exact * 1.0 + semantic * SEMANTIC_WEIGHT
    return round(min(numerator / total, 1.0) * 100, 2)


def _holistic_similarity_score(resume_text: str, role: Role) -> float:
    """
    Cosine similarity between resume text and role description+skills, rescaled
    from [SIM_FLOOR, SIM_CEIL] to [0, 100].
    """
    if not resume_text.strip():
        return 0.0
    raw = compute_similarity(resume_text, _role_text(role))
    rescaled = (raw - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR)
    return round(min(max(rescaled, 0.0), 1.0) * 100, 2)


def _gap_summary(
    role_title: str,
    match_score: int,
    matched: List[str],
    missing: List[str],
) -> str:
    """Generate a single-sentence gap summary for a role recommendation."""
    if match_score >= 80:
        strength = "Strong fit"
    elif match_score >= 60:
        strength = "Good fit"
    elif match_score >= 40:
        strength = "Partial fit"
    else:
        strength = "Weak fit"

    if not missing:
        return f"{strength} — resume covers all key requirements for {role_title}."

    gap_list = ", ".join(missing[:4]) + ("…" if len(missing) > 4 else "")
    if len(missing) <= 2:
        return f"{strength} — missing only {gap_list}."
    return f"{strength} — gaps: {gap_list} ({len(missing)} skills total)."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_skill_gap(
    resume_skills: List[str],
    role: Role,
    *,
    match_result: Optional[Dict] = None,
) -> Dict:
    """
    Compute the skill gap between a resume and a single role.

    This is the standalone version — callable independently when the user
    manually selects a role (rather than using the auto-recommender).

    Args:
        resume_skills : List of skill strings from Phase 1's parse_resume()["skills"].
        role          : A role dict from ROLE_BANK (or any dict with the same schema).
        match_result  : (Optional) Pre-computed Phase 3 match_skills() result.
                        Pass this if you're calling inside a loop to avoid
                        duplicate embedding work.

    Returns:
        {
            "role_title":      str,
            "matched_skills":  [str, ...],   # exact keyword matches
            "related_skills":  [{"resume_skill", "jd_term", "similarity"}, ...],
            "missing_skills":  [str, ...],   # required skills with no match
            "overlap_score":   float (0-100),
        }
    """
    if match_result is None:
        match_result = match_skills(resume_skills, role["required_skills"])

    overlap = _skill_overlap_score(match_result)

    return {
        "role_title":     role["role_title"],
        "matched_skills": match_result.get("exact_matches", []),
        "related_skills": match_result.get("semantic_matches", []),
        "missing_skills": match_result.get("missing", []),
        "overlap_score":  overlap,
    }


def recommend_roles(
    parsed_resume: Dict,
    *,
    top_n: int = DEFAULT_TOP_N,
    role_bank: List[Role] = None,
) -> List[Dict]:
    """
    Score every role in the role bank and return the top-N recommendations.

    Args:
        parsed_resume : Output of Phase 1's parse_resume().
        top_n         : Number of top roles to return (default 5).
        role_bank     : Role list to score against. Defaults to ROLE_BANK from
                        role_bank.py — pass a custom list for testing.

    Returns:
        List of up to top_n dicts, each containing:
            {
              "role_title":      str,
              "match_score":     int (0-100),
              "matched_skills":  [str, ...],
              "related_skills":  [{"resume_skill", "jd_term", "similarity"}, ...],
              "missing_skills":  [str, ...],
              "gap_summary":     str,
            }
        Sorted by match_score descending.
    """
    if role_bank is None:
        role_bank = ROLE_BANK

    resume_skills = parsed_resume.get("skills", [])
    resume_text   = _build_resume_text(parsed_resume)

    scored: List[Dict] = []

    for role in role_bank:
        # Phase 3 skill-level matching against the role's required_skills list.
        match_result   = match_skills(resume_skills, role["required_skills"])
        skill_score    = _skill_overlap_score(match_result)

        # Holistic cosine similarity — captures broader profile fit beyond keywords.
        holistic_score = _holistic_similarity_score(resume_text, role)

        # Weighted combination.
        weighted = skill_score * W_SKILL_OVERLAP + holistic_score * W_HOLISTIC_SIM
        match_score = max(0, min(100, round(weighted)))

        matched = match_result.get("exact_matches", [])
        missing = match_result.get("missing", [])

        scored.append({
            "role_title":     role["role_title"],
            "match_score":    match_score,
            "matched_skills": matched,
            "related_skills": match_result.get("semantic_matches", []),
            "missing_skills": missing,
            "gap_summary":    _gap_summary(role["role_title"], match_score,
                                           matched, missing),
            # Internal breakdown — omit from public output if too noisy,
            # but useful for debugging / future FastAPI response.
            "_breakdown": {
                "skill_overlap":   skill_score,
                "holistic_sim":    holistic_score,
            },
        })

    scored.sort(key=lambda r: r["match_score"], reverse=True)
    return scored[:top_n]


# ---------------------------------------------------------------------------
# __main__ — run against the demo resume and print ranked recommendations
# Usage:  python role_recommender.py
#         python role_recommender.py <path/to/resume.docx|.pdf>
# ---------------------------------------------------------------------------

_DIV  = "=" * 72
_THIN = "-" * 72


def _print_recommendations(recommendations: List[Dict]) -> None:
    print(f"\n{_DIV}")
    print("  PHASE 5 — Top Role Recommendations")
    print(_DIV)

    for rank, rec in enumerate(recommendations, 1):
        score = rec["match_score"]
        bar_width = 28
        filled = round(bar_width * score / 100)
        bar = "\u2588" * filled + "\u2591" * (bar_width - filled)

        print(f"\n  #{rank}  {rec['role_title']}")
        print(f"       Match Score: [{bar}] {score}/100")
        print(f"       Skill Overlap {rec['_breakdown']['skill_overlap']:.1f}  |  "
              f"Holistic Sim {rec['_breakdown']['holistic_sim']:.1f}")
        print(_THIN)

        matched = rec["matched_skills"]
        print(f"  Matched Skills ({len(matched)}): "
              + (", ".join(matched) if matched else "(none)"))

        related = rec["related_skills"]
        if related:
            print(f"  Related / Semantic ({len(related)}): "
                  + ", ".join(f"{m['resume_skill']}~{m['jd_term']}" for m in related[:4])
                  + ("..." if len(related) > 4 else ""))

        missing = rec["missing_skills"]
        print(f"  Missing Skills ({len(missing)}): "
              + (", ".join(missing) if missing else "(none)"))

        print(f"  Gap Summary: {rec['gap_summary']}")

    print(f"\n{_DIV}")


# ---------------------------------------------------------------------------
# Demo: analyze_skill_gap() called on a manually-chosen role
# ---------------------------------------------------------------------------
def _demo_analyze_gap(resume_skills: List[str], role_title: str) -> None:
    role = next((r for r in ROLE_BANK if r["role_title"] == role_title), None)
    if not role:
        print(f"  [WARN] Role '{role_title}' not found in ROLE_BANK.")
        return

    gap = analyze_skill_gap(resume_skills, role)
    print(f"\n{_DIV}")
    print(f"  STANDALONE SKILL GAP — '{role_title}'")
    print(_THIN)
    print(f"  Overlap Score:  {gap['overlap_score']:.1f}/100")
    print(f"  Matched:  {', '.join(gap['matched_skills']) or '(none)'}")
    if gap["related_skills"]:
        print(f"  Related:  " + ", ".join(
            f"{m['resume_skill']}~{m['jd_term']}" for m in gap["related_skills"]
        ))
    print(f"  Missing:  {', '.join(gap['missing_skills']) or '(none)'}")
    print(_DIV)


if __name__ == "__main__":
    import pathlib

    # ── Optional: parse a real resume ────────────────────────────────────────
    parsed = None
    if len(sys.argv) > 1:
        try:
            from resume_parser.parser import parse_resume
            parsed = parse_resume(sys.argv[1])
            print(f"\n[role_recommender] Loaded: {pathlib.Path(sys.argv[1]).name}",
                  file=sys.stderr)
        except Exception as exc:
            print(f"[WARN] Could not parse resume ({exc}). Using built-in demo.",
                  file=sys.stderr)

    # Built-in demo resume — mirrors test_resume_A.docx
    if parsed is None:
        parsed = {
            "contact_info": {
                "name": "Alex Johnson", "email": "alex@example.com",
                "phone": "555-123-4567",
                "linkedin": "https://www.linkedin.com/in/alexjohnson",
            },
            "skills": [
                "Python", "FastAPI", "React", "Node.js", "PostgreSQL",
                "Docker", "AWS", "Git", "TensorFlow", "PyTorch",
                "scikit-learn", "Pandas", "NumPy", "Redis",
            ],
            "experience": [
                {
                    "title_company": "Software Engineer, Acme Corp",
                    "dates": "2022-2024",
                    "bullets": [
                        "Built REST APIs with FastAPI serving 50k+ daily requests",
                        "Reduced PostgreSQL query latency by 40% via index optimisation",
                        "Deployed containerised services using Docker and AWS ECS",
                    ],
                },
                {
                    "title_company": "Junior Developer, StartupXYZ",
                    "dates": "2021-2022",
                    "bullets": [
                        "Developed React front-end components for the dashboard",
                        "Integrated Redis caching layer, cutting API response times by 30%",
                    ],
                },
            ],
            "projects": [
                {
                    "name": "ML Pipeline - Churn Prediction",
                    "bullets": [
                        "Trained scikit-learn and TensorFlow models on 500k customer records",
                        "Automated model retraining with a Git-triggered CI pipeline",
                    ],
                }
            ],
            "education": [
                {"raw": "BSc Computer Science, State University", "dates": "2021"}
            ],
            "certifications": ["AWS Certified Developer - Associate"],
        }

    resume_skills = parsed.get("skills", [])

    print(f"\n[role_recommender] Resume skills ({len(resume_skills)}): "
          f"{', '.join(resume_skills)}", file=sys.stderr)
    print(f"[role_recommender] Scoring {len(ROLE_BANK)} roles...\n", file=sys.stderr)

    # ── 1. Top-N recommendations ─────────────────────────────────────────────
    recommendations = recommend_roles(parsed, top_n=5)
    _print_recommendations(recommendations)

    # ── 2. Standalone skill gap for a manually-chosen role ───────────────────
    # Demonstrates that analyze_skill_gap() works independently.
    _demo_analyze_gap(resume_skills, "DevOps Engineer")
