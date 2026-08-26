"""
Step 2 — Section Splitter
Scans lines looking for recognized section headers and groups lines under
each canonical section bucket. Text before the first header goes into 'header'
(used for contact info extraction).

Alias Map — maps common resume header variants to a canonical section name.
Extend this dict as new variants are observed in the wild.
"""

import re
from typing import Dict, List

# ---------------------------------------------------------------------------
# Alias Map
# Keys are lower-cased, stripped variants.  Values are canonical section names.
# ---------------------------------------------------------------------------
SECTION_ALIASES: Dict[str, str] = {
    # Contact / summary
    "summary": "summary",
    "professional summary": "summary",
    "objective": "summary",
    "career objective": "summary",
    # Skills
    "skills": "skills",
    "technical skills": "skills",
    "core competencies": "skills",
    "competencies": "skills",
    "technologies": "skills",
    "tools & technologies": "skills",
    "tools and technologies": "skills",
    # Experience
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment history": "experience",
    "work history": "experience",
    "career history": "experience",
    "relevant experience": "experience",
    # Education
    "education": "education",
    "educational background": "education",
    "academic background": "education",
    "qualifications": "education",
    # Projects
    "projects": "projects",
    "personal projects": "projects",
    "academic projects": "projects",
    "side projects": "projects",
    "notable projects": "projects",
    # Certifications
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses & certifications": "certifications",
    "licenses and certifications": "certifications",
    "professional certifications": "certifications",
    # Publications / awards (parsed as misc for now)
    "awards": "awards",
    "honors": "awards",
    "achievements": "awards",
    "publications": "publications",
    "languages": "languages",
    "interests": "interests",
    "hobbies": "interests",
}

# Pre-build a sorted list of alias keys ordered by length (longest first)
# so that multi-word phrases are checked before their shorter substrings.
_SORTED_ALIASES = sorted(SECTION_ALIASES.keys(), key=len, reverse=True)


def _normalize_header(line: str) -> str:
    """Strip bullet characters, punctuation noise, and lowercase for alias lookup."""
    line = line.strip()
    # Remove leading bullet characters
    line = re.sub(r"^[•\-\*\u2022\u25cf]+\s*", "", line)
    # Remove trailing colon, period, or dashes
    line = re.sub(r"[\:\.\-]+$", "", line)
    return line.lower().strip()


def _is_section_header(line: str) -> str | None:
    """
    Return the canonical section name if *line* is a recognized header, else None.
    Heuristics:
      - Short line (≤ 50 chars)
      - Normalised text matches an alias
      - Optionally ALL-CAPS or Title Case (both accepted)
    """
    stripped = line.strip()
    if not stripped or len(stripped) > 60:
        return None

    normalized = _normalize_header(stripped)

    # Direct alias lookup
    if normalized in SECTION_ALIASES:
        return SECTION_ALIASES[normalized]

    # Also check ALL-CAPS variants (e.g. "EDUCATION", "WORK EXPERIENCE")
    for alias in _SORTED_ALIASES:
        if normalized == alias or normalized == alias.upper():
            return SECTION_ALIASES[alias]

    return None


def split_sections(text: str) -> Dict[str, List[str]]:
    """
    Scan the resume text line-by-line and group lines into buckets by section.

    Returns:
        dict mapping canonical section name → list of raw text lines.
        Lines before the first recognised header go into the 'header' bucket.
    """
    sections: Dict[str, List[str]] = {"header": []}
    current_section = "header"

    for line in text.splitlines():
        canonical = _is_section_header(line)
        if canonical is not None:
            current_section = canonical
            if current_section not in sections:
                sections[current_section] = []
        else:
            sections[current_section].append(line)

    return sections
