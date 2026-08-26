"""
Phase 2 — ATS Compatibility Scorer
====================================
Consumes the structured JSON produced by Phase 1's parse_resume() and computes
a transparent, rule-based ATS Compatibility Score (0–100).

Each scoring check is its own function returning:
    (points_earned: int, max_points: int, feedback: str)

Category weights (max_points) are declared as constants here so they can be
rebalanced without touching any logic.

Output shape
------------
{
  "overall_score": 0-100,
  "breakdown": [
    { "category": str, "score": int, "max_score": int, "feedback": str },
    ...
  ],
  "top_issues": [ str, ... ]   # 2-4 prioritised human-readable suggestions
}
"""

import re
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Category weight constants  ← tune these without touching logic
# ---------------------------------------------------------------------------
W_SECTION_COMPLETENESS  = 20
W_CONTACT_INFO          = 10
W_BULLET_USAGE          = 15
W_BULLET_QUALITY        = 20
W_RESUME_LENGTH         = 10
W_SKILL_DENSITY         = 10
W_FORMATTING            = 15

# Word-count thresholds (tune here)
MIN_WORDS = 200
MAX_WORDS = 1200

# Skill density thresholds
MIN_SKILLS_GOOD  = 8    # fewer than this → penalised
MIN_SKILLS_OK    = 4    # fewer than this → heavily penalised

# Formatting proxies
MAX_GARBLE_RATIO = 0.05     # fraction of "words" with no vowel → garbled
MIN_LINE_LEN_THRESHOLD = 15 # lines shorter than this → possible column artefact
SHORT_LINE_RATIO = 0.50     # if > 50% of non-empty lines are short → flagged

# ---------------------------------------------------------------------------
# Action verb seed list  (extend in later phases)
# ---------------------------------------------------------------------------
ACTION_VERBS: List[str] = [
    "built", "led", "designed", "improved", "reduced", "increased",
    "managed", "developed", "implemented", "architected", "optimised",
    "optimized", "launched", "delivered", "created", "deployed",
    "automated", "migrated", "integrated", "streamlined", "scaled",
    "analysed", "analyzed", "collaborated", "mentored", "trained",
    "coordinated", "spearheaded", "authored", "established", "drove",
    "accelerated", "revamped", "restructured", "monitored", "resolved",
]
_ACTION_VERB_RE = re.compile(
    r"\b(" + "|".join(re.escape(v) for v in ACTION_VERBS) + r")\b",
    re.IGNORECASE,
)

# Quantifiable metric signals
_METRIC_RE = re.compile(
    r"(\d+\s*%"           # percentages
    r"|\$\s*\d+"          # dollar amounts
    r"|\d+\s*[xX]\b"      # multipliers  e.g. 10x
    r"|\b\d{2,})"         # bare numbers ≥ 10 (revenue, MAU, latency ms …)
)


# ---------------------------------------------------------------------------
# Helper: flatten bullets from experience + projects
# ---------------------------------------------------------------------------

def _collect_bullets(parsed: Dict) -> List[str]:
    """Return every bullet string from experience and project entries."""
    bullets: List[str] = []
    for role in parsed.get("experience", []):
        bullets.extend(role.get("bullets", []))
    for proj in parsed.get("projects", []):
        bullets.extend(proj.get("bullets", []))
    return bullets


# ---------------------------------------------------------------------------
# Check 1 — Section Completeness
# ---------------------------------------------------------------------------

def check_section_completeness(parsed: Dict) -> Tuple[int, int, str]:
    """
    Expected sections: contact_info, skills, education, experience,
    and at least one of projects / certifications.
    Each missing mandatory section costs proportional points.
    """
    max_pts = W_SECTION_COMPLETENESS

    checks = {
        "contact info":   bool(parsed.get("contact_info")),
        "skills":         bool(parsed.get("skills")),
        "education":      bool(parsed.get("education")),
        "experience":     bool(parsed.get("experience")),
        "projects/certs": (
            bool(parsed.get("projects")) or bool(parsed.get("certifications"))
        ),
    }

    total = len(checks)
    present = sum(checks.values())
    missing = [k for k, v in checks.items() if not v]

    pts = round(max_pts * present / total)

    if not missing:
        feedback = "All key sections detected — great structure."
    else:
        feedback = f"Missing or empty: {', '.join(missing)}."

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 2 — Contact Info Completeness
# ---------------------------------------------------------------------------

def check_contact_info(parsed: Dict) -> Tuple[int, int, str]:
    """Name + email + phone are required; LinkedIn is a bonus."""
    max_pts = W_CONTACT_INFO
    ci = parsed.get("contact_info", {})

    pts = 0
    issues = []

    if ci.get("name"):
        pts += 3
    else:
        issues.append("name not detected")

    if ci.get("email"):
        pts += 3
    else:
        issues.append("email missing")

    if ci.get("phone"):
        pts += 3
    else:
        issues.append("phone missing")

    if ci.get("linkedin"):
        pts += 1  # bonus point

    pts = min(pts, max_pts)

    if not issues:
        feedback = "Name, email, phone, and LinkedIn all detected."
    else:
        linkedin_note = "" if ci.get("linkedin") else " LinkedIn is a nice-to-have."
        feedback = f"Issues: {', '.join(issues)}.{linkedin_note}"

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 3 — Bullet Point Usage
# ---------------------------------------------------------------------------

def check_bullet_usage(parsed: Dict) -> Tuple[int, int, str]:
    """
    Reward resumes where experience/project entries have bullet points rather
    than dense paragraph-style text. Checks fraction of entries that have ≥1 bullet.
    """
    max_pts = W_BULLET_USAGE

    roles = parsed.get("experience", []) + parsed.get("projects", [])
    if not roles:
        return 0, max_pts, "No experience or project entries found."

    entries_with_bullets = sum(1 for r in roles if r.get("bullets"))
    ratio = entries_with_bullets / len(roles)

    pts = round(max_pts * ratio)

    if ratio >= 1.0:
        feedback = "All entries use bullet points — excellent ATS readability."
    elif ratio >= 0.5:
        feedback = (
            f"{entries_with_bullets}/{len(roles)} entries have bullets. "
            "Convert remaining prose paragraphs to bullet points."
        )
    else:
        feedback = (
            "Most entries lack bullet points. ATS parsers and recruiters "
            "strongly prefer concise, bulleted descriptions."
        )

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 4 — Bullet Point Quality (action verbs + metrics)
# ---------------------------------------------------------------------------

def check_bullet_quality(parsed: Dict) -> Tuple[int, int, str]:
    """
    Two sub-signals, each worth half the category weight:
      A) Fraction of bullets starting with a strong action verb
      B) Fraction of bullets containing a quantifiable metric
    """
    max_pts = W_BULLET_QUALITY
    bullets = _collect_bullets(parsed)

    if not bullets:
        return 0, max_pts, "No bullet points found — cannot assess quality."

    verb_hits   = sum(1 for b in bullets if _ACTION_VERB_RE.match(b.strip()))
    metric_hits = sum(1 for b in bullets if _METRIC_RE.search(b))

    verb_ratio   = verb_hits   / len(bullets)
    metric_ratio = metric_hits / len(bullets)

    # Each sub-signal contributes half the max points
    half = max_pts / 2
    pts = round(half * verb_ratio + half * metric_ratio)

    parts = []
    if verb_ratio >= 0.7:
        parts.append(f"{verb_hits}/{len(bullets)} bullets open with action verbs ✓")
    else:
        parts.append(
            f"Only {verb_hits}/{len(bullets)} bullets start with action verbs — "
            "begin more bullets with words like 'Built', 'Led', 'Reduced'."
        )

    if metric_ratio >= 0.4:
        parts.append(f"{metric_hits}/{len(bullets)} bullets include quantified metrics ✓")
    else:
        parts.append(
            f"Only {metric_hits}/{len(bullets)} bullets contain numbers/metrics — "
            "quantify impact wherever possible (e.g. '40% reduction in latency')."
        )

    feedback = " | ".join(parts)
    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 5 — Resume Length / Word Count
# ---------------------------------------------------------------------------

def check_resume_length(raw_text: str) -> Tuple[int, int, str]:
    """
    Word count should sit between MIN_WORDS and MAX_WORDS.
    Outside those bounds → partial score.
    """
    max_pts = W_RESUME_LENGTH
    words = len(raw_text.split())

    if MIN_WORDS <= words <= MAX_WORDS:
        pts = max_pts
        feedback = f"Word count {words} is within the ideal range ({MIN_WORDS}–{MAX_WORDS})."
    elif words < MIN_WORDS:
        ratio = words / MIN_WORDS
        pts = round(max_pts * ratio)
        feedback = (
            f"Resume appears very short ({words} words). "
            f"Target at least {MIN_WORDS} words to provide enough content for ATS parsing."
        )
    else:  # too long
        # Linear penalty: 0 pts at 2×MAX_WORDS
        over = (words - MAX_WORDS) / MAX_WORDS
        pts = max(0, round(max_pts * (1 - over)))
        feedback = (
            f"Resume is long ({words} words). Most ATS systems and recruiters "
            f"prefer under {MAX_WORDS} words (~1 page). Consider condensing."
        )

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 6 — Skill Density
# ---------------------------------------------------------------------------

def check_skill_density(parsed: Dict) -> Tuple[int, int, str]:
    """
    General keyword density check — how many skills were extracted?
    No job description yet; this is purely a richness signal.
    """
    max_pts = W_SKILL_DENSITY
    skills = parsed.get("skills", [])
    n = len(skills)

    if n >= MIN_SKILLS_GOOD:
        pts = max_pts
        feedback = f"{n} skills detected — strong keyword presence."
    elif n >= MIN_SKILLS_OK:
        pts = round(max_pts * 0.6)
        feedback = (
            f"Only {n} skills detected from the gazetteer. "
            "Add more explicit technical skills to improve ATS keyword matching."
        )
    else:
        pts = round(max_pts * 0.2)
        feedback = (
            f"Very few skills detected ({n}). "
            "Include a dedicated Skills section with languages, frameworks, and tools."
        )

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Check 7 — Formatting Red Flags (text-based proxies)
# ---------------------------------------------------------------------------

def check_formatting(raw_text: str) -> Tuple[int, int, str]:
    """
    Proxy checks for formatting issues that hurt ATS parsing:
      A) Garbled text: fraction of tokens with no vowel (indicates broken PDF extraction)
      B) Excessive short lines: possible multi-column layout artefact
    """
    max_pts = W_FORMATTING
    pts = max_pts
    issues = []

    lines = [l for l in raw_text.splitlines() if l.strip()]
    tokens = raw_text.split()

    # A) Garbled text check
    if tokens:
        vowel_re = re.compile(r"[aeiouAEIOU]")
        no_vowel = sum(1 for t in tokens if len(t) > 2 and not vowel_re.search(t))
        garble_ratio = no_vowel / len(tokens)
        if garble_ratio > MAX_GARBLE_RATIO:
            penalty = min(max_pts // 2, round(max_pts * garble_ratio * 3))
            pts -= penalty
            issues.append(
                f"Possible garbled/broken text detected ({garble_ratio:.0%} of tokens "
                "contain no vowels). This often means the PDF wasn't ATS-parseable — "
                "use a text-based (not image-scanned) PDF."
            )

    # B) Short-line ratio check (multi-column artefact)
    if lines:
        short = sum(1 for l in lines if len(l.strip()) < MIN_LINE_LEN_THRESHOLD)
        short_ratio = short / len(lines)
        if short_ratio > SHORT_LINE_RATIO:
            penalty = max_pts // 3
            pts -= penalty
            issues.append(
                f"{short_ratio:.0%} of lines are very short (<{MIN_LINE_LEN_THRESHOLD} chars), "
                "which often indicates a multi-column layout. ATS parsers frequently "
                "mis-read multi-column resumes — use a single-column format."
            )

    pts = max(0, pts)

    if not issues:
        feedback = "No formatting red flags detected."
    else:
        feedback = " | ".join(issues)

    return pts, max_pts, feedback


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def score_resume(parsed: Dict, raw_text: str) -> Dict:
    """
    Run all checks and return the full scoring report.

    Args:
        parsed:   Output of Phase 1's parse_resume().
        raw_text: Raw extracted text string (from extractor.extract_text()).

    Returns:
        dict with keys: overall_score, breakdown, top_issues
    """
    checks = [
        ("Section Completeness", check_section_completeness(parsed)),
        ("Contact Info",         check_contact_info(parsed)),
        ("Bullet Point Usage",   check_bullet_usage(parsed)),
        ("Bullet Point Quality", check_bullet_quality(parsed)),
        ("Resume Length",        check_resume_length(raw_text)),
        ("Skill Density",        check_skill_density(parsed)),
        ("Formatting",           check_formatting(raw_text)),
    ]

    breakdown = []
    total_earned = 0
    total_max = 0

    for category, (earned, max_pts, feedback) in checks:
        breakdown.append({
            "category":  category,
            "score":     earned,
            "max_score": max_pts,
            "feedback":  feedback,
        })
        total_earned += earned
        total_max    += max_pts

    overall_score = round(total_earned / total_max * 100) if total_max else 0

    # Derive top issues from checks that performed worst relative to their max
    deficits = sorted(
        breakdown,
        key=lambda c: (c["score"] / c["max_score"]) if c["max_score"] else 1,
    )
    top_issues = []
    for item in deficits:
        if item["score"] < item["max_score"] and len(top_issues) < 4:
            top_issues.append(f"[{item['category']}] {item['feedback']}")

    return {
        "overall_score": overall_score,
        "breakdown":     breakdown,
        "top_issues":    top_issues,
    }
