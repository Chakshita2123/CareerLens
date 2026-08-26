"""
Phase 7 — Bullet-Point Improvement Suggestions (LLM-powered)
==============================================================
Suggests stronger rewrites for resume bullets flagged as weak by the Phase 2
ATS scorer (missing action verbs, no quantifiable metrics).

ISOLATION PRINCIPLE
-------------------
This module is a suggestion layer ONLY. It must never be called as part of
ATS scoring or Job Match scoring — those pipelines stay fully deterministic.
Call this only when the user explicitly requests suggestions (e.g. via the
POST /resumes/{version_id}/improve-bullets endpoint).

Provider chain (fails gracefully at each level)
------------------------------------------------
1. Gemini (google-generativeai)  — primary
2. Groq (groq)                   — fallback if Gemini fails or rate-limits
3. Mock / template               — last resort; always succeeds, no API calls

API keys are read from environment variables (set in .env):
  GEMINI_API_KEY
  GROQ_API_KEY

If a key is missing, that provider is skipped silently.

In-memory cache
---------------
Results are cached in a module-level dict keyed by (bullet_text, context) to
avoid paying for the same LLM call twice in a single server session.
This is intentionally kept simple — a Redis-backed cache would be the
production upgrade (Phase 8+), but it's overkill for now.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Load env vars (no-op if .env not present)
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional here; keys can also be set directly in the environment

GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY:   Optional[str] = os.getenv("GROQ_API_KEY")

# ---------------------------------------------------------------------------
# TUNABLE CONSTANTS
# ---------------------------------------------------------------------------

# Model names — swap here to upgrade without touching logic.
GEMINI_MODEL: str = "gemini-1.5-flash"   # fast + cheap; upgrade to gemini-1.5-pro if needed
GROQ_MODEL:   str = "llama-3.1-8b-instant"

# Maximum suggestions to request per bullet.
MAX_SUGGESTIONS: int = 2

# Maximum word count for a suggested bullet (LLM is instructed to stay under this).
MAX_BULLET_WORDS: int = 25

# ---------------------------------------------------------------------------
# Reuse Phase 2's compiled regex patterns — same source of truth.
# Importing these (not reimplementing them) ensures the "weak" classification
# here always matches what Phase 2 flagged. Read-only use — Phase 7 never
# writes to or modifies any ATS score.
# ---------------------------------------------------------------------------
try:
    from ats_scorer import _ACTION_VERB_RE, _METRIC_RE
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from ats_scorer import _ACTION_VERB_RE, _METRIC_RE


# ---------------------------------------------------------------------------
# In-memory result cache  (bullet_text, context) → result dict
# ---------------------------------------------------------------------------
_CACHE: Dict[Tuple[str, str], Dict] = {}


# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATE = """\
You are an expert resume writer helping a job seeker strengthen weak bullet points.

Original bullet: {bullet}
Context (role or project this bullet belongs to): {context}
Detected weaknesses: {issues}

Rules you MUST follow:
1. Do NOT invent new achievements, tools, technologies, or numbers that are not \
implied by the original bullet.
2. Start each suggestion with a strong past-tense action verb.
3. Keep each suggestion under {max_words} words.
4. If the original bullet has no measurable metric, insert a placeholder like \
[X]% or [N units] rather than fabricating a number — the user will fill in the real value.
5. Preserve the core underlying claim — do not change what the person actually did.

Return ONLY valid JSON — no preamble, no markdown fences, no explanation outside the JSON:
{{
  "suggestions": [
    "rewritten version 1 (start with action verb)",
    "rewritten version 2 (alternative phrasing)"
  ],
  "note": "One sentence explaining what was changed and/or what placeholder(s) the user needs to fill in."
}}
"""


def _build_prompt(bullet: str, context: str, issues: List[str]) -> str:
    issue_str = " | ".join(issues) if issues else "generic weakness"
    return _PROMPT_TEMPLATE.format(
        bullet=bullet,
        context=context or "unspecified role",
        issues=issue_str,
        max_words=MAX_BULLET_WORDS,
    )


# ---------------------------------------------------------------------------
# JSON extraction — handles LLM quirks (markdown fences, trailing text)
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Optional[Dict]:
    """
    Extract the first valid JSON object from an LLM response string.
    Handles cases where the model wraps the JSON in ```json ... ``` fences
    or adds preamble text despite being told not to.
    """
    # 1. Try direct parse first (model was well-behaved)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown fences and try again
    stripped = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # 3. Find first {...} block by brace matching
    depth, start = 0, -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    break

    return None


# ---------------------------------------------------------------------------
# Provider 1 — Gemini
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str) -> Optional[Dict]:
    """Call Gemini API. Returns parsed dict on success, None on any failure."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,     # low temp → more consistent, less hallucination
                max_output_tokens=256,
            ),
        )
        text = response.text
        return _extract_json(text)
    except Exception as exc:
        print(f"[bullet_improver] Gemini call failed: {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Provider 2 — Groq
# ---------------------------------------------------------------------------

def _call_groq(prompt: str) -> Optional[Dict]:
    """Call Groq API. Returns parsed dict on success, None on any failure."""
    if not GROQ_API_KEY:
        return None
    try:
        from groq import Groq  # type: ignore

        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional resume writer. "
                        "Always respond with valid JSON only — no markdown, no explanation outside the JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=256,
        )
        text = completion.choices[0].message.content or ""
        return _extract_json(text)
    except Exception as exc:
        print(f"[bullet_improver] Groq call failed: {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Provider 3 — Mock / Template fallback (always succeeds, no API needed)
# ---------------------------------------------------------------------------

_MOCK_VERB_PREFIXES = [
    "Spearheaded", "Streamlined", "Delivered", "Accelerated",
    "Developed", "Implemented", "Drove", "Optimised",
]

def _call_mock(bullet: str, issues: List[str]) -> Dict:
    """
    Template-based fallback. Returns generic but actionable suggestions.
    Used when both Gemini and Groq are unavailable (no keys / both failed).
    Makes no API calls and never fails.
    """
    # Pick a verb that's not already in the bullet
    bullet_lower = bullet.lower()
    verb = next(
        (v for v in _MOCK_VERB_PREFIXES if v.lower() not in bullet_lower),
        "Delivered",
    )

    has_metric = "no metric" in issues
    has_verb   = "no action verb" in issues

    if has_verb and has_metric:
        s1 = f"{verb} [describe outcome], achieving [X]% improvement in [metric]."
        s2 = f"{verb} [specific task] that resulted in [N] [units of impact]."
        note = ("Suggestions are generic templates (no API key configured). "
                "Replace the bracketed placeholders with your actual details.")
    elif has_verb:
        s1 = f"{verb} {bullet.rstrip('.')}."
        s2 = f"Led effort to {bullet.lower().rstrip('.')}."
        note = "Added a strong action verb. No API key was available for a smarter rewrite."
    else:
        s1 = f"{bullet.rstrip('.')} — achieving [X]% improvement."
        s2 = f"{bullet.rstrip('.')} across [N] [systems/teams/users]."
        note = ("Added metric placeholders. "
                "Fill in [X] and [N] with your actual numbers before submitting.")

    return {
        "suggestions": [s1, s2],
        "note": note,
        "provider": "mock",
    }


# ---------------------------------------------------------------------------
# Core public function — single bullet
# ---------------------------------------------------------------------------

def improve_bullet(
    bullet_text: str,
    context: str = "",
    issues: Optional[List[str]] = None,
) -> Dict:
    """
    Suggest stronger rewrites for a single resume bullet point.

    Args:
        bullet_text : The original bullet string.
        context     : Role/project title the bullet belongs to (improves LLM output).
        issues      : List of weakness labels, e.g. ["no action verb", "no metric"].
                      If None, both weaknesses are assumed.

    Returns:
        {
            "original":    str,
            "suggestions": [str, str],
            "note":        str,
            "provider":    "gemini" | "groq" | "mock",
        }

    NOTE: This function never raises. All provider failures fall through gracefully.
    """
    if issues is None:
        issues = ["no action verb", "no metric"]

    cache_key = (bullet_text, context)
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    prompt = _build_prompt(bullet_text, context, issues)

    # Provider chain: Gemini → Groq → mock
    result: Optional[Dict] = None
    provider_used = "mock"

    result = _call_gemini(prompt)
    if result is not None:
        provider_used = "gemini"

    if result is None:
        result = _call_groq(prompt)
        if result is not None:
            provider_used = "groq"

    if result is None:
        result = _call_mock(bullet_text, issues)
        provider_used = "mock"

    # Normalise and validate the result dict
    suggestions = result.get("suggestions", [])
    if not isinstance(suggestions, list):
        suggestions = [str(suggestions)]
    suggestions = [str(s) for s in suggestions[:MAX_SUGGESTIONS]]

    # If LLM returned fewer than expected, pad with mock
    while len(suggestions) < MAX_SUGGESTIONS:
        mock = _call_mock(bullet_text, issues)
        suggestions.extend(mock["suggestions"])
        suggestions = suggestions[:MAX_SUGGESTIONS]

    output = {
        "original":    bullet_text,
        "suggestions": suggestions,
        "note":        str(result.get("note", "")),
        "provider":    provider_used,
    }

    _CACHE[cache_key] = output
    return output


# ---------------------------------------------------------------------------
# Batch public function — runs across all weak bullets from Phase 2
# ---------------------------------------------------------------------------

def _identify_weak_bullets(parsed_data: Dict) -> List[Dict]:
    """
    Re-apply Phase 2's action-verb and metric checks to each individual bullet
    and return only those flagged as weak — with context (role/project title).

    Read-only with respect to scores: this function reads Phase 2's compiled
    patterns but produces zero side-effects on any stored score.
    """
    weak: List[Dict] = []

    for role in parsed_data.get("experience", []):
        ctx = role.get("title_company", "Experience entry")
        for bullet in role.get("bullets", []):
            issues = []
            if not _ACTION_VERB_RE.match(bullet.strip()):
                issues.append("no action verb")
            if not _METRIC_RE.search(bullet):
                issues.append("no metric")
            if issues:
                weak.append({"bullet": bullet, "context": ctx, "issues": issues})

    for proj in parsed_data.get("projects", []):
        ctx = proj.get("name", "Project entry")
        for bullet in proj.get("bullets", []):
            issues = []
            if not _ACTION_VERB_RE.match(bullet.strip()):
                issues.append("no action verb")
            if not _METRIC_RE.search(bullet):
                issues.append("no metric")
            if issues:
                weak.append({"bullet": bullet, "context": ctx, "issues": issues})

    return weak


def improve_weak_bullets(parsed_data: Dict) -> Dict:
    """
    Identify all weak bullets in a parsed resume and generate improvement
    suggestions for each in a single pass.

    Args:
        parsed_data : Output of Phase 1's parse_resume().

    Returns:
        {
            "total_bullets_checked": int,
            "weak_bullets_found":    int,
            "improvements": [
                {
                    "context":     str,   # role / project title
                    "original":    str,
                    "suggestions": [str, ...],
                    "note":        str,
                    "provider":    str,
                    "issues":      [str, ...],
                },
                ...
            ]
        }
    """
    # Count all bullets for reporting
    all_bullets = []
    for role in parsed_data.get("experience", []):
        all_bullets.extend(role.get("bullets", []))
    for proj in parsed_data.get("projects", []):
        all_bullets.extend(proj.get("bullets", []))

    weak = _identify_weak_bullets(parsed_data)
    improvements = []

    for entry in weak:
        result = improve_bullet(
            bullet_text=entry["bullet"],
            context=entry["context"],
            issues=entry["issues"],
        )
        improvements.append({
            **result,
            "context": entry["context"],
            "issues":  entry["issues"],
        })

    return {
        "total_bullets_checked": len(all_bullets),
        "weak_bullets_found":    len(weak),
        "improvements":          improvements,
    }


# ---------------------------------------------------------------------------
# __main__ — quick console test with deliberately weak bullets
# Usage: python bullet_improver.py
# ---------------------------------------------------------------------------

_TEST_BULLETS = [
    # (bullet, context, expected_weakness)
    ("Worked on team project",
     "Software Engineer Intern, Acme Corp",
     "no action verb + no metric"),

    ("Helped with the website redesign",
     "Junior Developer, StartupXYZ",
     "no action verb + no metric"),

    ("Made the API faster",
     "Backend Engineer, TechCo",
     "no action verb + no metric"),

    ("Built REST APIs with FastAPI",
     "Software Engineer, Acme Corp",
     "no metric (has verb)"),

    ("Reduced PostgreSQL query latency by 40% via index optimisation",
     "Software Engineer, Acme Corp",
     "none — should be strong (skipped)"),
]

_DIV  = "=" * 68
_THIN = "-" * 68

if __name__ == "__main__":
    print(f"\n{'='*68}")
    print("  PHASE 7 — Bullet Improver  (provider chain test)")
    print(f"  Gemini key: {'set' if GEMINI_API_KEY else 'NOT SET (will skip)'}")
    print(f"  Groq key:   {'set' if GROQ_API_KEY else 'NOT SET (will skip)'}")
    print(f"{'='*68}\n")

    for bullet, context, note in _TEST_BULLETS:
        # Determine issues manually for test
        issues: List[str] = []
        if not _ACTION_VERB_RE.match(bullet.strip()):
            issues.append("no action verb")
        if not _METRIC_RE.search(bullet):
            issues.append("no metric")

        if not issues:
            print(f"  [SKIP — strong] {bullet}")
            print(f"  ({note})\n")
            continue

        print(f"{_DIV}")
        print(f"  ORIGINAL  : {bullet}")
        print(f"  Context   : {context}")
        print(f"  Weaknesses: {', '.join(issues)}")
        print(_THIN)

        result = improve_bullet(bullet, context, issues)

        print(f"  Provider  : {result['provider']}")
        for i, s in enumerate(result["suggestions"], 1):
            print(f"  Suggestion {i}: {s}")
        if result["note"]:
            print(f"  Note      : {result['note']}")
        print()

    print(_DIV)
    print("  Done. Check suggestions above before wiring to FastAPI endpoint.")
    print(_DIV)
