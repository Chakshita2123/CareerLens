"""
Phase 3 — Semantic Similarity test runner

Tests:
  1. Raw similarity sanity-check table (related vs. unrelated term pairs)
  2. Full match_skills() run against Resume A's skill list and a sample JD
     designed to use different-but-related phrasing for known skills.

Usage: python tests/run_semantic_tests.py
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

# ── model loads here (once) ──────────────────────────────────────────────────
from semantic_engine import compute_similarity, match_skills, SEMANTIC_THRESHOLD
from resume_parser.parser import parse_resume

RESUMES_DIR = pathlib.Path(__file__).parent / "sample_resumes"
DIVIDER  = "=" * 72
THIN     = "-" * 72

# ---------------------------------------------------------------------------
# Sample JD — Full-Stack Engineer role.
# Deliberately uses different phrasing for skills Resume A already has:
#   "React"       → "component-based UI frameworks"
#   "Node.js"     → "server-side JavaScript runtime"
#   "PostgreSQL"  → "relational database systems"
#   "Docker"      → "containerisation tools"
#   "AWS"         → "cloud infrastructure platforms"
#   "Python"      → "scripting and backend languages"  (also gazetteer hit)
#   "Redis"       → "in-memory caching layers"
# ---------------------------------------------------------------------------
SAMPLE_JD_TEXT = """
We are looking for a Full-Stack Software Engineer to join our product team.

The ideal candidate has hands-on experience with component-based UI frameworks
(e.g., React, Vue, or Angular) and strong proficiency in server-side JavaScript
runtimes for building scalable APIs.

You should be comfortable designing and optimising relational database systems
and working with in-memory caching layers to improve application performance.

Familiarity with containerisation tools and CI/CD pipelines is expected.
Experience deploying and operating services on cloud infrastructure platforms
(AWS, GCP, or Azure) is a strong plus.

Proficiency in scripting and backend languages such as Python is required.
Experience with version control via Git and REST API design is assumed.
"""

# Sanity-check pairs: (label, text_a, text_b)
SANITY_PAIRS = [
    # Related but different wording → should score HIGH
    ("Python  ↔  scripting languages",          "Python",   "scripting languages"),
    ("React   ↔  component-based UI frameworks","React",    "component-based UI frameworks"),
    ("MongoDB ↔  NoSQL databases",              "MongoDB",  "NoSQL databases"),
    ("Docker  ↔  containerisation",             "Docker",   "containerisation tools"),
    ("AWS     ↔  cloud infrastructure",         "AWS",      "cloud infrastructure platforms"),
    ("Redis   ↔  in-memory caching",            "Redis",    "in-memory caching layers"),
    # Unrelated → should score LOW
    ("Python  ↔  graphic design",               "Python",   "graphic design"),
    ("SQL     ↔  classical music",              "SQL",      "classical music"),
    ("Docker  ↔  baking recipes",               "Docker",   "baking recipes"),
]


def sim_bar(sim: float, width: int = 20) -> str:
    filled = round(width * sim)
    color  = "✓" if sim >= SEMANTIC_THRESHOLD else "✗"
    return f"[{'█' * filled}{'░' * (width - filled)}] {sim:.3f} {color}"


def main():
    # ── 1. Sanity-check: raw similarity scores ────────────────────────────
    print(f"\n{DIVIDER}")
    print("  SANITY CHECK — Raw cosine similarity scores")
    print(f"  Threshold = {SEMANTIC_THRESHOLD}   (✓ = above, ✗ = below)")
    print(THIN)
    print(f"  {'Pair':<45}  Similarity")
    print(f"  {'-'*45}  {'-'*28}")

    for label, a, b in SANITY_PAIRS:
        sim = compute_similarity(a, b)
        print(f"  {label:<45}  {sim_bar(sim)}")

    # ── 2. Full match_skills() against Resume A ───────────────────────────
    docx_path = RESUMES_DIR / "test_resume_A.docx"
    print(f"\n{DIVIDER}")
    print("  SKILL MATCH — Resume A  ×  Sample Full-Stack JD")
    print(THIN)

    if not docx_path.exists():
        print("[SKIP] test_resume_A.docx not found — run generate_test_resumes.py first")
        return

    parsed   = parse_resume(str(docx_path))
    resume_skills = parsed["skills"]
    print(f"  Resume skills ({len(resume_skills)}): {', '.join(resume_skills)}")
    print()

    result = match_skills(resume_skills, SAMPLE_JD_TEXT)

    jd_terms = result["jd_terms_used"]
    print(f"  JD terms extracted ({len(jd_terms)}): {', '.join(jd_terms)}")
    print()

    # Exact matches
    print(f"  ── Exact Matches ({len(result['exact_matches'])}) ──────────────────────────────────")
    if result["exact_matches"]:
        for s in result["exact_matches"]:
            print(f"     ✔  {s}")
    else:
        print("     (none)")
    print()

    # Semantic matches
    print(f"  ── Semantic Matches ({len(result['semantic_matches'])}) ─────────────────────────────")
    if result["semantic_matches"]:
        print(f"  {'Resume Skill':<22} {'JD Term':<38} Similarity")
        print(f"  {'-'*22} {'-'*38} {'-'*20}")
        for m in result["semantic_matches"]:
            bar = sim_bar(m["similarity"])
            print(f"  {m['resume_skill']:<22} {m['jd_term']:<38} {bar}")
    else:
        print("     (none)")
    print()

    # Missing
    print(f"  ── Missing (JD terms with no match ≥ {SEMANTIC_THRESHOLD}) ({len(result['missing'])}) ──────")
    if result["missing"]:
        for t in result["missing"]:
            print(f"     ✘  {t}")
    else:
        print("     (none — all JD terms matched!)")

    print(DIVIDER)


if __name__ == "__main__":
    main()
