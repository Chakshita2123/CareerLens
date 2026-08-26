"""
Phase 4 — Job Match Scorer
===========================
Combines the outputs of earlier phases into one final Job Match Score (0–100)
for a specific resume-vs-JD pairing.

Inputs
------
  parsed_resume  : dict — output of Phase 1's parse_resume()
  jd_text        : str  — raw job description text (pre-processing handled here)

Outputs
-------
  {
    "job_match_score":          int (0–100),
    "breakdown": {
      "skill_overlap_score":        float (0–100),
      "semantic_similarity_score":  float (0–100),
      "experience_alignment_score": float (0–100),
    },
    "matched_skills":   [str, ...],
    "related_skills":   [{"resume_skill", "jd_term", "similarity"}, ...],
    "missing_skills":   [str, ...],
    "summary":          str,
  }

Scoring Formula
---------------
Three weighted components — weights are tunable named constants at the top.
Suggested starting point (validate against real pairs before hardening):

  W_SKILL_OVERLAP    = 0.50   ← most discriminating signal for tech roles
  W_SEMANTIC_SIM     = 0.30   ← holistic fit beyond keyword overlap
  W_EXPERIENCE_ALIGN = 0.20   ← rough seniority / experience level match

Skill Overlap sub-formula:
  raw = (exact_matches * EXACT_WEIGHT + semantic_matches * SEMANTIC_WEIGHT)
        / total_jd_requirements
  EXACT_WEIGHT = 1.0, SEMANTIC_WEIGHT = 0.7
  Rationale: exact matches are a certain hit; semantic matches carry slight
  uncertainty (embedding may occasionally conflate loosely related concepts),
  so they're discounted to 70%.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Dict, List

# ---------------------------------------------------------------------------
# Cache redirect — must run before any HF / sentence-transformers imports.
# ---------------------------------------------------------------------------
_CACHE_DIR = str(Path(__file__).parent / ".hf_cache")
os.environ.setdefault("HF_HOME", _CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", _CACHE_DIR)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", _CACHE_DIR)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# ---------------------------------------------------------------------------
# ⚙  TUNABLE CONSTANTS  ← adjust here, nowhere else
# ---------------------------------------------------------------------------

# --- Component weights (must sum to 1.0) ---
# NOTE: Starting estimates. Recalibrate once tested against real resume-JD pairs.
W_SKILL_OVERLAP: float = 0.50
W_SEMANTIC_SIM: float = 0.30
W_EXPERIENCE_ALIGN: float = 0.20

assert abs(W_SKILL_OVERLAP + W_SEMANTIC_SIM + W_EXPERIENCE_ALIGN - 1.0) < 1e-9, \
    "Component weights must sum to 1.0"

# --- Skill overlap sub-weights ---
EXACT_WEIGHT: float = 1.0    # confirmed keyword hit — full credit
SEMANTIC_WEIGHT: float = 0.7  # conceptually related — 70% credit

# --- Experience-alignment heuristics ---
SENIORITY_SIGNALS: Dict[str, int] = {
    "intern": 0,
    "internship": 0,
    "junior": 1,
    "entry": 1,
    "associate": 1,
    "mid": 2,
    "intermediate": 2,
    "senior": 3,
    "lead": 3,
    "staff": 3,
    "principal": 4,
    "director": 4,
    "vp": 4,
    "head": 4,
}

# Year-mention patterns in JD, e.g. "2+ years", "5 years of experience"
_YOE_RE = re.compile(r"(\d+)\s*\+?\s*years?", re.IGNORECASE)

# Experience count thresholds → estimated seniority level
_EXP_LEVEL_FROM_COUNT: List[tuple] = [
    (0, 0),  # 0 entries  → intern
    (1, 1),  # 1 entry    → junior/entry
    (2, 2),  # 2–3 entries → mid
    (4, 3),  # 4+ entries  → senior
]

# ---------------------------------------------------------------------------
# Imports from earlier phases
# ---------------------------------------------------------------------------
try:
    from semantic_engine import match_skills, compute_similarity
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from semantic_engine import match_skills, compute_similarity


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _skill_overlap_score(match_result: Dict) -> float:
    """
    Translate Phase 3 match_skills() output into a 0–100 skill overlap score.

    Formula:
        numerator   = len(exact) * EXACT_WEIGHT + len(semantic) * SEMANTIC_WEIGHT
        denominator = total JD requirements (exact + semantic + missing)
        raw_ratio   = numerator / denominator  (clamped to [0, 1])
        score       = raw_ratio * 100
    """
    exact = len(match_result.get("exact_matches", []))
    semantic = len(match_result.get("semantic_matches", []))
    missing = len(match_result.get("missing", []))

    total = exact + semantic + missing
    if total == 0:
        return 0.0

    numerator = exact * EXACT_WEIGHT + semantic * SEMANTIC_WEIGHT
    raw_ratio = min(numerator / total, 1.0)
    return round(raw_ratio * 100, 2)


def _build_resume_text(parsed: Dict) -> str:
    """
    Construct a single string representing the resume's skill + experience text
    for holistic embedding similarity against the JD.

    Combines: skills list, experience title/company strings, all bullets.
    This gives the holistic similarity a broader signal than just skill names.
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


def _semantic_similarity_score(parsed: Dict, jd_text: str) -> float:
    """
    Holistic cosine similarity between resume's combined text and the full JD.

    Raw cosine sits in ~[0.3, 0.9] for related pairs (not 0–1 in practice).
    We linearly rescale from [SIM_FLOOR, SIM_CEIL] to [0, 100] to avoid
    systematically low scores. Both bounds are tunable.
    """
    SIM_FLOOR: float = 0.0   # cosine value mapped to 0 pts
    SIM_CEIL: float = 0.85   # cosine value mapped to 100 pts

    resume_text = _build_resume_text(parsed)
    if not resume_text.strip() or not jd_text.strip():
        return 0.0

    raw_sim = compute_similarity(resume_text, jd_text)
    rescaled = (raw_sim - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR)
    return round(min(max(rescaled, 0.0), 1.0) * 100, 2)


def _detect_resume_seniority(parsed: Dict) -> int:
    """
    Estimate seniority level from parsed resume (returns integer tier 0–4).
    Checks title keywords first; falls back to experience-count heuristic.
    """
    exp_entries = parsed.get("experience", [])
    all_title_text = " ".join(e.get("title_company", "") for e in exp_entries).lower()

    detected = -1
    for keyword, level in SENIORITY_SIGNALS.items():
        if keyword in all_title_text:
            detected = max(detected, level)

    if detected >= 0:
        return detected

    # Fallback: count-based heuristic
    n = len(exp_entries)
    level = 0
    for threshold, lvl in _EXP_LEVEL_FROM_COUNT:
        if n >= threshold:
            level = lvl
    return level


def _detect_jd_seniority(jd_text: str) -> int:
    """
    Estimate required seniority from JD text (returns integer tier 0–4).
    Maps explicit keywords + years-of-experience mentions to tiers.
    Default when no signal found: mid-level (2).
    """
    jd_lower = jd_text.lower()
    detected = -1

    for keyword, level in SENIORITY_SIGNALS.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', jd_lower):
            detected = max(detected, level)

    for m in _YOE_RE.finditer(jd_text):
        yrs = int(m.group(1))
        yoe_level = 0 if yrs < 2 else (2 if yrs < 5 else 3)
        detected = max(detected, yoe_level)

    return detected if detected >= 0 else 2


def _experience_alignment_score(parsed: Dict, jd_text: str) -> float:
    """
    Compare resume seniority tier to JD requirement. Returns float in [0, 100].

    Scoring:
      Exact match          → 100
      Overqualified by 1   →  80  (slight discount; role may still work)
      Underqualified by 1  →  70
      Overqualified by 2+  →  50
      Underqualified by 2+ →  40
    """
    diff = _detect_resume_seniority(parsed) - _detect_jd_seniority(jd_text)

    if diff == 0:   return 100.0
    elif diff == 1:  return 80.0
    elif diff == -1: return 70.0
    elif diff >= 2:  return 50.0
    else:            return 40.0


def _generate_summary(
    score: int,
    skill_score: float,
    sem_score: float,
    exp_score: float,
    exact: List[str],
    missing: List[str],
) -> str:
    """Generate a 1–2 sentence plain-language summary of overall fit."""
    if score >= 80:
        lead = f"This resume is a strong match for the role (overall score: {score}/100)."
    elif score >= 60:
        lead = f"This resume is a reasonable fit for the role (overall score: {score}/100), with room for improvement."
    elif score >= 40:
        lead = f"This resume is a partial match for the role (overall score: {score}/100) — some key requirements are missing."
    else:
        lead = f"This resume is a weak match for this role (overall score: {score}/100) — significant gaps detected."

    parts = []
    if exact:
        names = ', '.join(exact[:3]) + ('…' if len(exact) > 3 else '')
        parts.append(f"{len(exact)} skill(s) matched exactly ({names})")
    if missing:
        names = ', '.join(missing[:3]) + ('…' if len(missing) > 3 else '')
        parts.append(f"{len(missing)} required skill(s) not found ({names})")
    if exp_score < 50:
        parts.append("the candidate's experience level appears misaligned with the role")

    detail = ("Key observations: " + "; ".join(parts) + ".") if parts \
        else "The candidate's profile aligns well across skills and experience level."

    return f"{lead} {detail}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_job_match(
    parsed_resume: Dict,
    jd_text: str,
    *,
    match_result: Dict = None,
) -> Dict:
    """
    Compute a Job Match Score for a resume-JD pairing.

    Args:
        parsed_resume  : Output of Phase 1's parse_resume().
        jd_text        : Raw job description text.
        match_result   : (Optional) Pre-computed Phase 3 match_skills() output.
                         If None, match_skills() is called internally.
                         Pass a cached result to skip re-embedding.

    Returns:
        dict with keys: job_match_score, breakdown, matched_skills,
                        related_skills, missing_skills, summary
    """
    resume_skills = parsed_resume.get("skills", [])
    if match_result is None:
        match_result = match_skills(resume_skills, jd_text)

    skill_score = _skill_overlap_score(match_result)
    sem_score   = _semantic_similarity_score(parsed_resume, jd_text)
    exp_score   = _experience_alignment_score(parsed_resume, jd_text)

    final_score = max(0, min(100, round(
        skill_score * W_SKILL_OVERLAP
        + sem_score * W_SEMANTIC_SIM
        + exp_score * W_EXPERIENCE_ALIGN
    )))

    exact   = match_result.get("exact_matches", [])
    missing = match_result.get("missing", [])

    return {
        "job_match_score": final_score,
        "breakdown": {
            "skill_overlap_score":        skill_score,
            "semantic_similarity_score":  sem_score,
            "experience_alignment_score": exp_score,
        },
        "matched_skills": exact,
        "related_skills": match_result.get("semantic_matches", []),
        "missing_skills": missing,
        "summary": _generate_summary(final_score, skill_score, sem_score,
                                     exp_score, exact, missing),
    }


# ---------------------------------------------------------------------------
# __main__ — sanity test: good-fit JD vs. clear mismatch JD
# Usage:  python job_match_scorer.py
#         python job_match_scorer.py <path/to/resume.docx|.pdf>
# ---------------------------------------------------------------------------

_GOOD_FIT_JD = """\
We are looking for a Full-Stack Software Engineer with machine-learning exposure
to join our platform team.

Required skills and experience:
- 3+ years of hands-on experience with Python for backend development
- Strong proficiency in component-based UI frameworks (React, Vue, or Angular)
- Experience building and optimising RESTful APIs with server-side JavaScript runtimes
- Relational database design and query optimisation (PostgreSQL or MySQL)
- Familiarity with containerisation tools (Docker) and orchestration (Kubernetes)
- Deployment experience on cloud infrastructure platforms — AWS, GCP, or Azure
- Machine learning model deployment using frameworks such as TensorFlow or PyTorch
- Solid understanding of version control (Git) and CI/CD pipelines
- In-memory caching strategies (Redis or Memcached) for high-throughput systems

Nice to have:
- Data manipulation with Pandas or NumPy
- Experience with message queues (Kafka) or distributed data pipelines (Spark)
"""

_MISMATCH_JD = """\
We are looking for an experienced Marketing Manager to lead our brand and
growth campaigns.

Key responsibilities:
- Develop and execute integrated marketing strategies across digital and offline channels
- Manage a team of content writers, designers, and social media specialists
- Own the brand identity and ensure consistent messaging across all platforms
- Run A/B tests on email campaigns, landing pages, and paid ads (Google Ads, Meta)
- Collaborate with sales to build lead-generation funnels and track CAC / LTV
- Produce quarterly performance reports for C-suite stakeholders
- Manage agency relationships and oversee creative production budgets

Required:
- 5+ years of marketing experience with a track record of measurable growth
- Deep knowledge of SEO, SEM, and content marketing best practices
- Proficiency with marketing analytics platforms (HubSpot, Salesforce, Mixpanel)
- Excellent written and verbal communication skills
- Strong project management and stakeholder alignment capabilities
"""

_DIV  = "=" * 72
_THIN = "-" * 72


def _print_result(label: str, result: Dict) -> None:
    score = result["job_match_score"]
    bd    = result["breakdown"]

    bar_width = 30
    filled = round(bar_width * score / 100)
    bar = "█" * filled + "░" * (bar_width - filled)

    print(f"\n{_DIV}")
    print(f"  {label}")
    print(_THIN)
    print(f"  Job Match Score:  [{bar}]  {score}/100")
    print(_THIN)
    print("  Component Breakdown:")
    print(f"    Skill Overlap        ({W_SKILL_OVERLAP*100:.0f}% weight):  "
          f"{bd['skill_overlap_score']:6.1f}/100")
    print(f"    Semantic Similarity  ({W_SEMANTIC_SIM*100:.0f}% weight):  "
          f"{bd['semantic_similarity_score']:6.1f}/100")
    print(f"    Experience Alignment ({W_EXPERIENCE_ALIGN*100:.0f}% weight):  "
          f"{bd['experience_alignment_score']:6.1f}/100")
    print()

    matched = result["matched_skills"]
    print(f"  ── Matched Skills ({len(matched)}) " + "─" * 42)
    print("     " + (", ".join(matched) if matched else "(none)"))
    print()

    related = result["related_skills"]
    print(f"  ── Related / Semantic Matches ({len(related)}) " + "─" * 32)
    if related:
        print(f"  {'Resume Skill':<22} {'JD Term':<36} Sim")
        print(f"  {'-'*22} {'-'*36} {'-'*6}")
        for m in related:
            print(f"  {m['resume_skill']:<22} {m['jd_term']:<36} {m['similarity']:.3f}")
    else:
        print("     (none)")
    print()

    missing = result["missing_skills"]
    print(f"  ── Missing Skills ({len(missing)}) " + "─" * 42)
    if missing:
        for t in missing:
            print(f"     ✘  {t}")
    else:
        print("     (none — all JD requirements matched!)")
    print()

    # Word-wrapped summary
    print("  Summary:")
    words, line, lines = result["summary"].split(), [], []
    for w in words:
        if sum(len(x) + 1 for x in line) + len(w) > 68:
            lines.append("  " + " ".join(line))
            line = [w]
        else:
            line.append(w)
    if line:
        lines.append("  " + " ".join(line))
    print("\n".join(lines))
    print(_DIV)


if __name__ == "__main__":
    import pathlib

    parsed = None
    if len(sys.argv) > 1:
        try:
            from resume_parser.parser import parse_resume
            parsed = parse_resume(sys.argv[1])
            print(f"\n[job_match_scorer] Loaded: {pathlib.Path(sys.argv[1]).name}",
                  file=sys.stderr)
        except Exception as exc:
            print(f"[WARN] Could not parse resume ({exc}). Using built-in demo.",
                  file=sys.stderr)

    # Built-in demo resume (mirrors test_resume_A.docx)
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
                    "dates": "2022–2024",
                    "bullets": [
                        "Built REST APIs with FastAPI serving 50k+ daily requests",
                        "Reduced PostgreSQL query latency by 40% via index optimisation",
                        "Deployed containerised services using Docker and AWS ECS",
                    ],
                },
                {
                    "title_company": "Junior Developer, StartupXYZ",
                    "dates": "2021–2022",
                    "bullets": [
                        "Developed React front-end components for the dashboard",
                        "Integrated Redis caching layer, cutting API response times by 30%",
                    ],
                },
            ],
            "projects": [
                {
                    "name": "ML Pipeline — Churn Prediction",
                    "bullets": [
                        "Trained scikit-learn and TensorFlow models on 500k customer records",
                        "Automated model retraining with a Git-triggered CI pipeline",
                    ],
                }
            ],
            "education": [{"raw": "BSc Computer Science, State University", "dates": "2021"}],
            "certifications": ["AWS Certified Developer – Associate"],
        }

    print("\n[job_match_scorer] Running Phase 4 — Job Match Score", file=sys.stderr)

    print("[job_match_scorer] Test 1: Good-fit JD …", file=sys.stderr)
    good_result = compute_job_match(parsed, _GOOD_FIT_JD)

    print("[job_match_scorer] Test 2: Mismatch JD …", file=sys.stderr)
    mismatch_result = compute_job_match(parsed, _MISMATCH_JD)

    _print_result("TEST 1 — Good Fit: Full-Stack / ML Engineer JD", good_result)
    _print_result("TEST 2 — Mismatch: Marketing Manager JD",         mismatch_result)

    delta = good_result["job_match_score"] - mismatch_result["job_match_score"]
    print(f"\n  Score delta (good-fit − mismatch): {delta:+d} points")
    if delta >= 20:
        verdict = "✓  PASS — scorer correctly differentiates good-fit from mismatch."
    elif delta >= 10:
        verdict = "~  WARN — direction correct but gap is small; consider tuning weights."
    else:
        verdict = "✗  FAIL — gap too small; weights need recalibration."
    print(f"  {verdict}\n")
