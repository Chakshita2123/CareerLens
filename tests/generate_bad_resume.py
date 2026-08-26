"""
Generate a deliberately weak resume (test_resume_BAD.pdf) for ATS score contrast.

Weaknesses built in:
  - No Skills section
  - No Certifications section
  - No Projects section
  - Missing phone number in contact block
  - Experience uses dense paragraph prose, zero bullets
  - Zero action verbs / zero metrics
  - Very short overall word count (~130 words)
  - Lots of very short fragmented lines (multi-column artefact simulation)

Run: python tests/generate_bad_resume.py
"""

import pathlib

TESTS_DIR  = pathlib.Path(__file__).parent
RESUMES_DIR = TESTS_DIR / "sample_resumes"
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

# Intentionally sparse, prose-heavy, no bullets, no metrics, short.
BAD_RESUME_LINES = """\
Sam
sam@nowhere.com

Work

Was at Tech Corp.
Did some things there.
Helped the team.
It was good.

Then worked at Another Co.
Participated in meetings.
Involved in projects.

School

Went to college.
Got a degree.
"""


def build_bad_pdf(text: str, out_path: pathlib.Path):
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.units import inch

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=LETTER,
        leftMargin=inch, rightMargin=inch,
        topMargin=inch,  bottomMargin=inch,
    )
    styles = getSampleStyleSheet()
    story = []
    for line in text.splitlines():
        if line.strip() == "":
            story.append(Spacer(1, 0.08 * inch))
        else:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(safe, styles["Normal"]))
    doc.build(story)
    print(f"[OK] Created {out_path}")


if __name__ == "__main__":
    pdf_path = RESUMES_DIR / "test_resume_BAD.pdf"
    print("Generating weak test resume …")
    build_bad_pdf(BAD_RESUME_LINES, pdf_path)
    print("Done.")
