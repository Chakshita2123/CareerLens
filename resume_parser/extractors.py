"""
Step 3 — Per-section Structured Extractors

Each public function in this module takes the raw lines for one section
and returns a structured Python object.

Sections covered:
  - contact_info   → dict
  - skills         → list[str]
  - education      → list[dict]
  - experience     → list[dict]   ← trickiest; handles split title/date lines
  - projects       → list[dict]
  - certifications → list[str]
"""

import re
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Shared regex patterns
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-\.]?)?"          # optional country code
    r"\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}"
)
LINKEDIN_RE = re.compile(r"linkedin\.com/in/[\w\-]+", re.IGNORECASE)
DATE_RANGE_RE = re.compile(
    r"\b(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)\b",
    re.IGNORECASE,
)
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


# ---------------------------------------------------------------------------
# 3a. Contact Info
# ---------------------------------------------------------------------------

def extract_contact_info(header_lines: List[str]) -> Dict:
    """
    Extract name, email, phone, linkedin from the header block.

    Name heuristic: first non-empty line that contains no email/phone/digit-heavy
    patterns is treated as the candidate name.
    """
    text = "\n".join(header_lines)

    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    linkedin = LINKEDIN_RE.search(text)

    name = _extract_name(header_lines)

    return {
        "name": name,
        "email": email.group() if email else None,
        "phone": phone.group() if phone else None,
        "linkedin": f"https://www.{linkedin.group()}" if linkedin else None,
    }


def _extract_name(lines: List[str]) -> Optional[str]:
    """
    Return the first line that looks like a person's name:
      - Not empty
      - No @ (email), no standalone digit sequences (phone)
      - Short enough (≤ 60 chars) — avoids grabbing address lines
      - Contains only letters, spaces, hyphens, periods, apostrophes
    """
    name_re = re.compile(r"^[A-Za-z][A-Za-z\s\-'\.]{1,58}[A-Za-z\.]$")
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if EMAIL_RE.search(stripped) or PHONE_RE.search(stripped):
            continue
        if name_re.match(stripped):
            return stripped
    return None


# ---------------------------------------------------------------------------
# 3b. Skills  (gazetteer-based)
# ---------------------------------------------------------------------------

# ~50 seed skills — TODO: grow this into a full taxonomy in a later phase.
# Organised loosely by category for readability; matching is done as a flat set.
SKILL_GAZETTEER: List[str] = [
    # Programming languages
    "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#",
    "Go", "Rust", "Swift", "Kotlin", "Ruby", "PHP", "Scala", "R",
    # Web frameworks
    "React", "Angular", "Vue", "Next.js", "Node.js", "Express",
    "Django", "Flask", "FastAPI", "Spring Boot",
    # Data / ML
    "TensorFlow", "PyTorch", "scikit-learn", "Keras", "Pandas",
    "NumPy", "Matplotlib", "Seaborn", "XGBoost", "LightGBM",
    "Hugging Face", "LangChain",
    # Databases
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "SQLite", "DynamoDB", "Cassandra",
    # Cloud / DevOps
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
    "CI/CD", "Jenkins", "GitHub Actions",
    # Tools / misc
    "Git", "Linux", "REST", "GraphQL", "Kafka", "Spark",
]

# Pre-compile word-boundary patterns for each skill (case-insensitive).
# Word-boundary matching prevents "R" matching inside "REST" etc.
_SKILL_PATTERNS = {
    skill: re.compile(
        r"\b" + re.escape(skill) + r"\b", re.IGNORECASE
    )
    for skill in SKILL_GAZETTEER
}


def extract_skills(
    skills_lines: List[str],
    fallback_lines: Optional[List[str]] = None,
) -> List[str]:
    """
    Match skills from the skills section using the gazetteer.
    If skills_lines is empty, fall back to scanning fallback_lines (full resume text).

    Returns a sorted, deduplicated list of matched skill names (canonical casing).
    """
    search_text = "\n".join(skills_lines)
    if not search_text.strip() and fallback_lines:
        search_text = "\n".join(fallback_lines)

    found = []
    for skill, pattern in _SKILL_PATTERNS.items():
        if pattern.search(search_text):
            found.append(skill)

    return sorted(set(found))


# ---------------------------------------------------------------------------
# 3c. Education
# ---------------------------------------------------------------------------

def extract_education(edu_lines: List[str]) -> List[Dict]:
    """
    Parse education section into a list of entries.
    Each entry is a dict with: degree, institution, dates, raw_lines.

    Strategy:
      - Blank lines separate entries.
      - Date ranges are extracted via regex.
      - First non-blank, non-date line in each entry is treated as the degree/institution.
    """
    entries = []
    current: List[str] = []

    def _flush(block: List[str]):
        block = [l for l in block if l.strip()]
        if not block:
            return
        text = " ".join(block)
        dates = DATE_RANGE_RE.search(text)
        # Remove the date range from the text to isolate institution/degree info
        clean = DATE_RANGE_RE.sub("", text).strip()
        entries.append({
            "raw": clean,
            "dates": dates.group() if dates else _find_year(text),
        })

    for line in edu_lines:
        if line.strip() == "":
            _flush(current)
            current = []
        else:
            current.append(line)
    _flush(current)

    return entries


def _find_year(text: str) -> Optional[str]:
    m = YEAR_RE.search(text)
    return m.group() if m else None


# ---------------------------------------------------------------------------
# 3d. Experience  (most complex)
# ---------------------------------------------------------------------------

def _is_bullet(line: str) -> bool:
    """
    Heuristic: a line is a bullet / description if it:
      - Starts with a bullet character (•, -, *, –)
      - OR is a long sentence-like line (> 60 chars) ending with punctuation
    """
    stripped = line.strip()
    if not stripped:
        return False
    if re.match(r"^[•\-\*–\u2022]+", stripped):
        return True
    if len(stripped) > 60 and stripped[-1] in ".,:;":
        return True
    return False


def _is_date_only_line(line: str) -> bool:
    """Return True if the line contains mainly a date range and little else."""
    stripped = line.strip()
    # Check for date range pattern
    if DATE_RANGE_RE.search(stripped):
        # Remove the date range and see if much is left
        remainder = DATE_RANGE_RE.sub("", stripped).strip(" |–—-")
        return len(remainder) <= 10  # e.g. just a location abbreviation
    return False


def _looks_like_role_header(line: str) -> bool:
    """
    Heuristic: a line looks like a job title / company header if:
      - Not empty
      - Not a bullet
      - Short-ish (≤ 80 chars) — actual bullets are usually longer
      - Does not end with a period (bullets/sentences often do)
    """
    stripped = line.strip()
    if not stripped or _is_bullet(stripped):
        return False
    if stripped.endswith("."):
        return False
    if len(stripped) > 80:
        return False
    return True


def extract_experience(exp_lines: List[str]) -> List[Dict]:
    """
    Group lines into role entries: {title_company, dates, bullets}.

    Key challenge: job title and date may appear on SEPARATE lines:
        Software Engineer, Google          ← header line (no date)
        June 2022 – Present                ← date-only line → merge upward

    We handle this by checking if the line immediately after a header line is
    a date-only line, and if so merging the date into the current entry rather
    than starting a new entry.
    """
    roles: List[Dict] = []
    current_header: Optional[str] = None
    current_dates: Optional[str] = None
    current_bullets: List[str] = []

    def _flush():
        if current_header is not None:
            roles.append({
                "title_company": current_header,
                "dates": current_dates,
                "bullets": [b.strip().lstrip("•-*–\u2022 ") for b in current_bullets if b.strip()],
            })

    lines = [l for l in exp_lines]  # keep a mutable copy
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if _is_bullet(stripped):
            current_bullets.append(stripped)
            i += 1
            continue

        # Check if this non-bullet line is a date-only line right after a header
        if current_header is not None and _is_date_only_line(stripped):
            # Merge date into the existing entry instead of starting a new one
            m = DATE_RANGE_RE.search(stripped)
            if m:
                current_dates = m.group()
            i += 1
            continue

        # Otherwise it's a new role header line
        _flush()
        current_header = stripped
        current_bullets = []

        # Extract inline date from the header line itself (title and date on same line)
        m = DATE_RANGE_RE.search(stripped)
        if m:
            current_dates = m.group()
            # Optionally strip date from header to clean it up
            current_header = DATE_RANGE_RE.sub("", stripped).strip(" |–—-,")
        else:
            current_dates = None

        # Peek ahead: if the very next non-empty line is date-only, consume it
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines) and _is_date_only_line(lines[j].strip()):
            m2 = DATE_RANGE_RE.search(lines[j])
            if m2:
                current_dates = m2.group()
            i = j + 1
            continue

        i += 1

    _flush()
    return roles


# ---------------------------------------------------------------------------
# 3e. Projects
# ---------------------------------------------------------------------------

def extract_projects(proj_lines: List[str]) -> List[Dict]:
    """
    Same grouping logic as experience but without the date-line complexity.
    Each project entry: {name, description_bullets}.
    """
    projects: List[Dict] = []
    current_name: Optional[str] = None
    current_bullets: List[str] = []

    def _flush():
        if current_name is not None:
            projects.append({
                "name": current_name,
                "bullets": [b.strip().lstrip("•-*–\u2022 ") for b in current_bullets if b.strip()],
            })

    for line in proj_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _is_bullet(stripped):
            current_bullets.append(stripped)
        else:
            _flush()
            current_name = stripped
            current_bullets = []

    _flush()
    return projects


# ---------------------------------------------------------------------------
# 3f. Certifications
# ---------------------------------------------------------------------------

def extract_certifications(cert_lines: List[str]) -> List[str]:
    """Simple line list. Filter out empty lines and bullet characters."""
    result = []
    for line in cert_lines:
        cleaned = line.strip().lstrip("•-*–\u2022 ")
        if cleaned:
            result.append(cleaned)
    return result
