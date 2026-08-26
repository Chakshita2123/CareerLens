"""
Step 4 — Orchestration

parse_resume(file_path) → dict  is the single public entry point.
It wires together:
  1. Text extraction   (extractor.py)
  2. Section splitting (section_splitter.py)
  3. Structured extraction (extractors.py)
"""

import json
from typing import Dict

from .extractor import extract_text
from .section_splitter import split_sections
from .extractors import (
    extract_contact_info,
    extract_skills,
    extract_education,
    extract_experience,
    extract_projects,
    extract_certifications,
)


def parse_resume(file_path: str) -> Dict:
    """
    Full pipeline: file → structured JSON dict.

    Args:
        file_path: Absolute or relative path to a .pdf or .docx resume.

    Returns:
        dict with keys:
            contact_info, skills, education, experience, projects, certifications
    """
    # 1. Extract raw text
    text = extract_text(file_path)

    # 2. Split into sections
    sections = split_sections(text)

    # 3. Per-section extraction
    all_lines = text.splitlines()

    contact_info = extract_contact_info(sections.get("header", []))
    skills = extract_skills(
        sections.get("skills", []),
        fallback_lines=all_lines,  # used if no skills section found
    )
    education = extract_education(sections.get("education", []))
    experience = extract_experience(sections.get("experience", []))
    projects = extract_projects(sections.get("projects", []))
    certifications = extract_certifications(sections.get("certifications", []))

    return {
        "contact_info": contact_info,
        "skills": skills,
        "education": education,
        "experience": experience,
        "projects": projects,
        "certifications": certifications,
    }


# ---------------------------------------------------------------------------
# CLI entry point — run as: python -m resume_parser.parser <file_path>
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m resume_parser.parser <path_to_resume.pdf|.docx>")
        sys.exit(1)

    result = parse_resume(sys.argv[1])
    print(json.dumps(result, indent=2))
