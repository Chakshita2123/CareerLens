"""
ATS Scoring test runner — parse each resume with Phase 1 and score with Phase 2.
Prints a full breakdown table + top issues for each resume.

Usage: python tests/run_ats_tests.py
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from resume_parser.extractor import extract_text
from resume_parser.parser    import parse_resume
from ats_scorer              import score_resume

RESUMES_DIR = pathlib.Path(__file__).parent / "sample_resumes"

TEST_FILES = [
    ("Resume A — DOCX (strong, same-line title/date)",           RESUMES_DIR / "test_resume_A.docx"),
    ("Resume B — PDF  (strong, split-line title/date)",          RESUMES_DIR / "test_resume_B.pdf"),
    ("Resume BAD — PDF (deliberately weak — contrast check)",    RESUMES_DIR / "test_resume_BAD.pdf"),
]

DIVIDER  = "=" * 72
THIN     = "-" * 72


def render_bar(score: int, max_score: int, width: int = 20) -> str:
    filled = round(width * score / max_score) if max_score else 0
    return "[" + "█" * filled + "░" * (width - filled) + "]"


def print_report(label: str, report: dict):
    print(f"\n{DIVIDER}")
    print(f"  {label}")
    print(f"  ATS Score: {report['overall_score']}/100")
    print(THIN)

    print(f"  {'Category':<26} {'Score':>6}  {'Bar':<22} Feedback")
    print(f"  {'-'*26} {'-'*6}  {'-'*22} {'-'*20}")
    for item in report["breakdown"]:
        bar  = render_bar(item["score"], item["max_score"])
        pts  = f"{item['score']}/{item['max_score']}"
        # Truncate feedback for table display
        fb   = item["feedback"][:55] + ("…" if len(item["feedback"]) > 55 else "")
        print(f"  {item['category']:<26} {pts:>6}  {bar}  {fb}")

    print(THIN)
    print("  Top Issues / Suggestions:")
    for i, issue in enumerate(report["top_issues"], 1):
        # Word-wrap at ~68 chars
        words   = issue.split()
        line    = f"  {i}. "
        prefix  = "     "
        for w in words:
            if len(line) + len(w) + 1 > 72:
                print(line)
                line = prefix + w + " "
            else:
                line += w + " "
        print(line.rstrip())

    print(DIVIDER)


def main():
    any_missing = False

    for label, path in TEST_FILES:
        if not path.exists():
            print(f"\n[SKIP] {path.name} not found — run the generator scripts first.")
            any_missing = True
            continue

        try:
            raw_text = extract_text(str(path))
            parsed   = parse_resume(str(path))
            report   = score_resume(parsed, raw_text)
            print_report(label, report)
        except Exception as exc:
            print(f"\n[ERROR] {label}: {type(exc).__name__}: {exc}")
            import traceback; traceback.print_exc()

    if any_missing:
        print("\n  ── To generate missing resumes: ──")
        print("     python tests/generate_test_resumes.py")
        print("     python tests/generate_bad_resume.py")


if __name__ == "__main__":
    main()
