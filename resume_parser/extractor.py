"""
Step 1 — Text Extraction
Handles PDF (via pdfplumber) and DOCX (via python-docx).
All functions return a plain string of the full resume text.
"""

import pathlib


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file page by page using pdfplumber."""
    import pdfplumber

    lines = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.append(text)
    return "\n".join(lines)


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file paragraph by paragraph using python-docx."""
    from docx import Document

    doc = Document(file_path)
    return "\n".join(para.text for para in doc.paragraphs)


def extract_text(file_path: str) -> str:
    """
    Unified entry point. Dispatches to the correct extractor based on file extension.

    Supported: .pdf, .docx
    Raises ValueError for unsupported formats.
    """
    ext = pathlib.Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file format: '{ext}'. Expected .pdf or .docx")
