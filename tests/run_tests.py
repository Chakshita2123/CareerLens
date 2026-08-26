"""
Run the parser on both test resumes and print structured JSON output.
Usage: python tests/run_tests.py
"""

import json
import pathlib
import sys

# Allow running from the project root
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from resume_parser.parser import parse_resume

RESUMES_DIR = pathlib.Path(__file__).parent / "sample_resumes"

TEST_FILES = [
    ("Resume A (DOCX — same-line title/date)", RESUMES_DIR / "test_resume_A.docx"),
    ("Resume B (PDF  — split-line title/date, non-standard headers)", RESUMES_DIR / "test_resume_B.pdf"),
]

DIVIDER = "=" * 72


def main():
    for label, path in TEST_FILES:
        print(f"\n{DIVIDER}")
        print(f"  {label}")
        print(f"  File: {path}")
        print(DIVIDER)

        if not path.exists():
            print(f"[ERROR] File not found: {path}")
            print("        Run `python tests/generate_test_resumes.py` first.")
            continue

        try:
            result = parse_resume(str(path))
            print(json.dumps(result, indent=2))
        except Exception as exc:
            print(f"[ERROR] {type(exc).__name__}: {exc}")
            import traceback; traceback.print_exc()

    print(f"\n{DIVIDER}")
    print("  All tests complete.")
    print(DIVIDER)


if __name__ == "__main__":
    main()
