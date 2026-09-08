"""
pdf_report.py — CareerLens PDF Report Generator
===============================================
Generates a clean, professional, publication-quality light-mode PDF report
for a resume version and optional job match analysis.

Uses ReportLab with high-contrast, printer-friendly styling, visual hierarchy,
structured tables, brand accent colors, and defensive field extraction.
"""

from __future__ import annotations

import html
import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.graphics.shapes import Drawing, Circle, Line, Rect, Group


# ---------------------------------------------------------------------------
# Brand Color Palette (Light Mode / Executive Printable)
# ---------------------------------------------------------------------------
COLOR_PRIMARY     = colors.HexColor("#0284C7")  # Sky 600 - Lens Cyan / Blue Accent
COLOR_PRIMARY_DARK= colors.HexColor("#0369A1")  # Sky 700 - Deep Brand
COLOR_PRIMARY_TINT= colors.HexColor("#F0F9FF")  # Sky 50 - Very soft tint
COLOR_SLATE_DARK  = colors.HexColor("#0F172A")  # Slate 900 - Text Heading
COLOR_SLATE_BODY  = colors.HexColor("#334155")  # Slate 700 - Body Text
COLOR_SLATE_MUTED = colors.HexColor("#64748B")  # Slate 500 - Secondary
COLOR_BORDER      = colors.HexColor("#CBD5E1")  # Slate 300 - Clean Borders
COLOR_BORDER_LIGHT= colors.HexColor("#E2E8F0")  # Slate 200 - Subtle Rows
COLOR_BG_CARD     = colors.HexColor("#F8FAFC")  # Slate 50 - Surface Card
COLOR_BG_LIGHT    = colors.HexColor("#FFFFFF")  # Pure White

# Status Colors
COLOR_SUCCESS     = colors.HexColor("#059669")  # Emerald 600 - Good / Matched
COLOR_SUCCESS_BG  = colors.HexColor("#ECFDF5")  # Emerald 50
COLOR_WARNING     = colors.HexColor("#D97706")  # Amber 600 - Calibrating / Semantics
COLOR_WARNING_BG  = colors.HexColor("#FFFBEB")  # Amber 50
COLOR_DANGER      = colors.HexColor("#DC2626")  # Red 600 - Missing / Weak
COLOR_DANGER_BG   = colors.HexColor("#FEF2F2")  # Red 50


# ---------------------------------------------------------------------------
# Helpers & Vector Aperture Drawing
# ---------------------------------------------------------------------------
def _safe(text: Any) -> str:
    """Escape HTML entities for safe inclusion in ReportLab Paragraphs."""
    if text is None:
        return ""
    return html.escape(str(text).strip())


def make_aperture_icon(size: float = 32.0) -> Drawing:
    """Draws a crisp geometric aperture / reticle icon."""
    d = Drawing(size, size)
    center = size / 2.0
    r_outer = size / 2.0 - 1.5
    r_inner = size * 0.28

    # Outer circle
    c1 = Circle(center, center, r_outer)
    c1.strokeColor = COLOR_PRIMARY
    c1.strokeWidth = 1.75
    c1.fillColor = None
    d.add(c1)

    # Inner lens ring
    c2 = Circle(center, center, r_inner)
    c2.strokeColor = COLOR_PRIMARY_DARK
    c2.strokeWidth = 1.2
    c2.fillColor = COLOR_PRIMARY_TINT
    d.add(c2)

    # Reticle ticks (cardinal lines)
    tick_len = size * 0.22
    l1 = Line(center, 0, center, tick_len)
    l1.strokeColor = COLOR_PRIMARY
    l1.strokeWidth = 1.2
    d.add(l1)

    l2 = Line(center, size - tick_len, center, size)
    l2.strokeColor = COLOR_PRIMARY
    l2.strokeWidth = 1.2
    d.add(l2)

    l3 = Line(0, center, tick_len, center)
    l3.strokeColor = COLOR_PRIMARY
    l3.strokeWidth = 1.2
    d.add(l3)

    l4 = Line(size - tick_len, center, size, center)
    l4.strokeColor = COLOR_PRIMARY
    l4.strokeWidth = 1.2
    d.add(l4)

    return d


def get_score_color(score: float, max_val: float = 100.0) -> colors.HexColor:
    ratio = (score / max_val) if max_val > 0 else 0
    if ratio >= 0.75:
        return COLOR_SUCCESS
    elif ratio >= 0.50:
        return COLOR_WARNING
    return COLOR_DANGER


# ---------------------------------------------------------------------------
# Page Layout Callbacks (Header & Footer)
# ---------------------------------------------------------------------------
def _draw_first_page(canvas_obj: Any, doc: Any) -> None:
    canvas_obj.saveState()
    # Bottom running footer
    canvas_obj.setStrokeColor(COLOR_BORDER_LIGHT)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(45, 38, 567, 38)

    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.setFillColor(COLOR_SLATE_MUTED)
    canvas_obj.drawString(45, 26, "CareerLens AI — Generated for candidate guidance and diagnostic review.")
    canvas_obj.drawRightString(567, 26, f"Page {canvas_obj._pageNumber}")
    canvas_obj.restoreState()


def _draw_later_page(canvas_obj: Any, doc: Any) -> None:
    canvas_obj.saveState()
    # Top running header
    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.setFillColor(COLOR_PRIMARY)
    canvas_obj.drawString(45, 755, "CAREERLENS")
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(COLOR_SLATE_MUTED)
    canvas_obj.drawString(108, 755, "•  Optical Resume Diagnostics & Fit Evaluation")

    canvas_obj.setStrokeColor(COLOR_BORDER_LIGHT)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(45, 747, 567, 747)

    # Bottom running footer
    canvas_obj.setStrokeColor(COLOR_BORDER_LIGHT)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(45, 38, 567, 38)

    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.setFillColor(COLOR_SLATE_MUTED)
    canvas_obj.drawString(45, 26, "CareerLens AI — Generated for candidate guidance and diagnostic review.")
    canvas_obj.drawRightString(567, 26, f"Page {canvas_obj._pageNumber}")
    canvas_obj.restoreState()


# ---------------------------------------------------------------------------
# Main PDF Builder Function
# ---------------------------------------------------------------------------
def build_pdf_report(
    version_doc: Dict[str, Any],
    match_doc: Optional[Dict[str, Any]] = None,
    recommendations: Optional[List[Dict[str, Any]]] = None,
) -> bytes:
    """
    Builds a complete, multi-section printable PDF report and returns the raw bytes.

    Args:
        version_doc: Resume version document from MongoDB (contains 'parsed_data',
                     'ats_score', 'version_label', 'raw_filename', 'uploaded_at').
        match_doc: Optional job match document from MongoDB (contains 'job_match_result').
        recommendations: Optional list of top role recommendations.

    Returns:
        bytes: Raw PDF document content.
    """
    buf = io.BytesIO()

    # Document geometry: Letter size (612 x 792 pt), 45 pt margins left/right, 48 pt top/bottom
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=48,
        bottomMargin=48,
    )

    # Styles Setup
    base_styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=COLOR_SLATE_DARK,
    )

    brand_badge_style = ParagraphStyle(
        "BrandBadge",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=COLOR_PRIMARY,
    )

    sub_style = ParagraphStyle(
        "ReportSub",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=COLOR_SLATE_MUTED,
    )

    meta_right_style = ParagraphStyle(
        "MetaRight",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=COLOR_SLATE_MUTED,
        alignment=TA_RIGHT,
    )

    h1_style = ParagraphStyle(
        "SectionHeading1",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=COLOR_SLATE_DARK,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=COLOR_SLATE_BODY,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=COLOR_SLATE_DARK,
    )

    table_body_style = ParagraphStyle(
        "TableBody",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11.5,
        textColor=COLOR_SLATE_BODY,
    )

    chip_style = ParagraphStyle(
        "ChipStyle",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=COLOR_SLATE_DARK,
    )

    story: List[Any] = []

    # -----------------------------------------------------------------------
    # 1. Header with Brand & Meta
    # -----------------------------------------------------------------------
    parsed = version_doc.get("parsed_data", {})
    contact = parsed.get("contact_info", {})
    candidate_name = contact.get("name") or "Candidate Profile"
    version_label = version_doc.get("version_label", "Standard Version")
    raw_filename = version_doc.get("raw_filename", "Resume Upload")

    gen_date = datetime.now().strftime("%B %d, %Y")

    # Brand + Titles Table
    icon_drawing = make_aperture_icon(36.0)
    brand_text_col = [
        Paragraph("CAREERLENS ANALYSIS REPORT", brand_badge_style),
        Paragraph(_safe(candidate_name), title_style),
        Paragraph(f"Optical Resume Diagnostics & Fit Evaluation  •  {gen_date}", sub_style),
    ]

    meta_text_col = [
        Paragraph(f"<b>Version:</b> {_safe(version_label)}", meta_right_style),
        Paragraph(f"<b>File:</b> {_safe(raw_filename)}", meta_right_style),
        Paragraph(f"<b>User ID:</b> {_safe(version_doc.get('user_id', 'Session User'))}", meta_right_style),
    ]

    header_table = Table(
        [[icon_drawing, brand_text_col, meta_text_col]],
        colWidths=[44, 300, 178],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    # Decorative Cyan Divider
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceAfter=12, spaceBefore=4))

    # -----------------------------------------------------------------------
    # 2. Candidate Contact & Profile Summary Strip
    # -----------------------------------------------------------------------
    email = contact.get("email") or "—"
    phone = contact.get("phone") or "—"
    linkedin = contact.get("linkedin") or "—"
    github = contact.get("github") or "—"
    skills_list = parsed.get("skills", [])
    skills_count = len(skills_list)
    exp_count = len(parsed.get("experience", []))
    edu_count = len(parsed.get("education", []))

    contact_data = [
        [
            Paragraph("<b>Email:</b> " + _safe(email), table_body_style),
            Paragraph("<b>Phone:</b> " + _safe(phone), table_body_style),
            Paragraph(f"<b>Extracted Skills:</b> {skills_count}", table_body_style),
        ],
        [
            Paragraph("<b>LinkedIn:</b> " + _safe(linkedin), table_body_style),
            Paragraph("<b>GitHub:</b> " + _safe(github), table_body_style),
            Paragraph(f"<b>Roles / Education:</b> {exp_count} exp / {edu_count} edu", table_body_style),
        ]
    ]

    contact_table = Table(contact_data, colWidths=[180, 180, 162])
    contact_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_CARD),
        ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER_LIGHT),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(contact_table)
    story.append(Spacer(1, 14))

    # -----------------------------------------------------------------------
    # 3. ATS Compatibility Score Section
    # -----------------------------------------------------------------------
    ats_score_data = version_doc.get("ats_score", {})
    overall_score = ats_score_data.get("overall_score", 0)
    score_col = get_score_color(overall_score, 100)

    if overall_score >= 80:
        badge_label = "FOCUS LOCKED — HIGH ATS COMPATIBILITY"
        badge_desc = "Your resume structure strongly aligns with standard applicant tracking systems with minimal parsing friction."
        badge_bg = COLOR_SUCCESS_BG
        badge_border = COLOR_SUCCESS
    elif overall_score >= 60:
        badge_label = "CALIBRATING — MODERATE ATS COMPATIBILITY"
        badge_desc = "Solid structural baseline. A few formatting, bullet action verbs, or keyword density adjustments are recommended."
        badge_bg = COLOR_WARNING_BG
        badge_border = COLOR_WARNING
    else:
        badge_label = "ACTION REQUIRED — LOW ATS COMPATIBILITY"
        badge_desc = "Key structural sections or content metrics are missing or garbled. Immediate revision is strongly advised."
        badge_bg = COLOR_DANGER_BG
        badge_border = COLOR_DANGER

    story.append(Paragraph("ATS Compatibility Diagnostics", h1_style))
    story.append(Spacer(1, 4))

    # Score Banner Card
    score_banner_data = [
        [
            # Left: Big Score
            Paragraph(
                f"<font size=28 color='{score_col.hexval()}'><b>{overall_score}</b></font>"
                f"<font size=14 color='{COLOR_SLATE_MUTED.hexval()}'> / 100</font><br/>"
                f"<font size=8.5 color='{COLOR_SLATE_MUTED.hexval()}'>OVERALL ATS INDEX</font>",
                ParagraphStyle("ScoreBox", parent=base_styles["Normal"], alignment=TA_CENTER)
            ),
            # Right: Explanation
            [
                Paragraph(f"<b><font color='{badge_border.hexval()}'>{badge_label}</font></b>", chip_style),
                Spacer(1, 3),
                Paragraph(_safe(badge_desc), body_style),
            ]
        ]
    ]
    score_banner_table = Table(score_banner_data, colWidths=[130, 392])
    score_banner_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), badge_bg),
        ("BOX", (0, 0), (-1, -1), 1.0, badge_border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(score_banner_table)
    story.append(Spacer(1, 10))

    # Category Breakdown Table
    breakdown_list = ats_score_data.get("breakdown", [])
    breakdown_rows = [
        [
            Paragraph("Diagnostic Category", table_header_style),
            Paragraph("Score", table_header_style),
            Paragraph("Status", table_header_style),
            Paragraph("Diagnostic Evaluation & Feedback", table_header_style),
        ]
    ]

    for item in breakdown_list:
        cat_name = item.get("category", "General")
        pts = item.get("score", 0)
        max_pts = item.get("max_score", 100)
        feedback = item.get("feedback", "No feedback recorded.")

        row_col = get_score_color(pts, max_pts)
        ratio = (pts / max_pts) if max_pts > 0 else 0
        status_str = "Optimal" if ratio >= 0.75 else ("Fair" if ratio >= 0.5 else "Weak")

        breakdown_rows.append([
            Paragraph(f"<b>{_safe(cat_name)}</b>", table_body_style),
            Paragraph(f"<b>{pts}</b> / {max_pts}", table_body_style),
            Paragraph(f"<font color='{row_col.hexval()}'><b>{status_str}</b></font>", table_body_style),
            Paragraph(_safe(feedback), table_body_style),
        ])

    breakdown_table = Table(breakdown_rows, colWidths=[125, 60, 55, 282])
    breakdown_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG_CARD),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, COLOR_PRIMARY),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 10))

    # Top ATS Issues Box (if present)
    top_issues = ats_score_data.get("top_issues", [])
    if top_issues:
        issues_content = [
            Paragraph("<b>Key ATS Calibration Points:</b>", ParagraphStyle("IssH", parent=table_header_style, textColor=COLOR_DANGER)),
            Spacer(1, 3),
        ]
        for issue in top_issues:
            issues_content.append(Paragraph(f"• {_safe(issue)}", table_body_style))
            issues_content.append(Spacer(1, 2))

        issues_table = Table([[issues_content]], colWidths=[522])
        issues_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_DANGER_BG),
            ("BOX", (0, 0), (-1, -1), 0.75, COLOR_DANGER),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(issues_table)
        story.append(Spacer(1, 14))

    # -----------------------------------------------------------------------
    # 4. Job Match Analysis Section (if match_doc provided)
    # -----------------------------------------------------------------------
    if match_doc:
        match_result = match_doc.get("job_match_result", {})
        job_score = match_result.get("job_match_score", 0)
        breakdown = match_result.get("breakdown", {})
        summary = match_result.get("summary", "")
        matched_skills = match_result.get("matched_skills", [])
        related_skills = match_result.get("related_skills", [])
        missing_skills = match_result.get("missing_skills", [])

        match_story: List[Any] = []
        match_story.append(Paragraph("Job Match Analysis — Target Role Fit", h1_style))
        match_story.append(Spacer(1, 4))

        jm_score_col = get_score_color(job_score, 100)

        # Job Match Header Stats
        jm_stat_data = [
            [
                Paragraph(
                    f"<font size=24 color='{jm_score_col.hexval()}'><b>{job_score}%</b></font><br/>"
                    f"<font size=8 color='{COLOR_SLATE_MUTED.hexval()}'>FIT SCORE</font>",
                    ParagraphStyle("JMScore", parent=base_styles["Normal"], alignment=TA_CENTER)
                ),
                Paragraph(
                    f"<b>Skill Overlap:</b> {breakdown.get('skill_overlap_score', 0):.1f}% (Weight 50%)<br/>"
                    f"<b>Semantic Fit:</b> {breakdown.get('semantic_similarity_score', 0):.1f}% (Weight 30%)<br/>"
                    f"<b>Experience Tier:</b> {breakdown.get('experience_alignment_score', 0):.1f}% (Weight 20%)",
                    table_body_style
                ),
                Paragraph(
                    f"<b>Matched:</b> <font color='{COLOR_SUCCESS.hexval()}'>{len(matched_skills)}</font><br/>"
                    f"<b>Related:</b> <font color='{COLOR_PRIMARY.hexval()}'>{len(related_skills)}</font><br/>"
                    f"<b>Missing:</b> <font color='{COLOR_DANGER.hexval()}'>{len(missing_skills)}</font>",
                    table_body_style
                ),
            ]
        ]
        jm_stat_table = Table(jm_stat_data, colWidths=[100, 260, 162])
        jm_stat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY_TINT),
            ("BOX", (0, 0), (-1, -1), 1.0, COLOR_PRIMARY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        match_story.append(jm_stat_table)
        match_story.append(Spacer(1, 8))

        # Plain-language summary
        if summary:
            summary_table = Table([[Paragraph(f"<b>Analysis Summary:</b> {_safe(summary)}", body_style)]], colWidths=[522])
            summary_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_CARD),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]))
            match_story.append(summary_table)
            match_story.append(Spacer(1, 8))

        # Skill Breakdown Columns
        matched_str = ", ".join([_safe(s) for s in matched_skills]) if matched_skills else "None directly detected"
        missing_str = ", ".join([_safe(s) for s in missing_skills]) if missing_skills else "None! Complete requirement coverage"

        skill_grid_data = [
            [
                Paragraph("<font color='#059669'><b>✓ Matched Core Skills (Exact)</b></font>", table_header_style),
                Paragraph("<font color='#DC2626'><b>⚠ Missing Requirements (Blindspots)</b></font>", table_header_style),
            ],
            [
                Paragraph(matched_str, table_body_style),
                Paragraph(missing_str, table_body_style),
            ]
        ]
        skill_grid_table = Table(skill_grid_data, colWidths=[261, 261])
        skill_grid_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), COLOR_SUCCESS_BG),
            ("BACKGROUND", (1, 0), (1, 0), COLOR_DANGER_BG),
            ("BACKGROUND", (0, 1), (-1, 1), COLOR_BG_CARD),
            ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        match_story.append(skill_grid_table)
        match_story.append(Spacer(1, 8))

        # Semantically Related Skills (if any)
        if related_skills:
            rel_rows = [
                [
                    Paragraph("Resume Term", table_header_style),
                    Paragraph("JD Requirement", table_header_style),
                    Paragraph("Similarity", table_header_style),
                ]
            ]
            for rel in related_skills[:8]:  # display up to 8 top semantic links
                r_term = rel.get("resume_skill", "")
                j_term = rel.get("jd_term", "")
                sim = rel.get("similarity", 0.0)
                sim_pct = f"{sim * 100:.0f}%" if sim <= 1.0 else f"{sim:.0f}%"

                rel_rows.append([
                    Paragraph(_safe(r_term), table_body_style),
                    Paragraph(_safe(j_term), table_body_style),
                    Paragraph(f"<b>{sim_pct}</b>", table_body_style),
                ])

            rel_table = Table(rel_rows, colWidths=[200, 222, 100])
            rel_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY_TINT),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            match_story.append(Paragraph("<b>Semantically Linked Concepts:</b>", table_header_style))
            match_story.append(Spacer(1, 3))
            match_story.append(rel_table)
            match_story.append(Spacer(1, 10))

        story.append(KeepTogether(match_story))

    # -----------------------------------------------------------------------
    # 5. Top Recommended Roles Section (if available)
    # -----------------------------------------------------------------------
    if recommendations and len(recommendations) > 0:
        rec_story: List[Any] = []
        rec_story.append(Paragraph("Top Recommended Roles (Benchmark Alignments)", h1_style))
        rec_story.append(Spacer(1, 4))

        rec_rows = [
            [
                Paragraph("Target Role", table_header_style),
                Paragraph("Match", table_header_style),
                Paragraph("Matched Skills", table_header_style),
                Paragraph("Skill Gap & Alignment Summary", table_header_style),
            ]
        ]

        for rec in recommendations[:3]:  # Top 3 roles
            role_title = rec.get("role_title", "Technical Role")
            match_score = rec.get("match_score", 0)
            m_skills = rec.get("matched_skills", [])
            gap_summary = rec.get("gap_summary", "")

            m_str = ", ".join([_safe(s) for s in m_skills[:5]])
            if len(m_skills) > 5:
                m_str += f" (+{len(m_skills)-5} more)"

            rec_col = get_score_color(match_score, 100)

            rec_rows.append([
                Paragraph(f"<b>{_safe(role_title)}</b>", table_body_style),
                Paragraph(f"<font color='{rec_col.hexval()}'><b>{match_score}%</b></font>", table_body_style),
                Paragraph(m_str or "—", table_body_style),
                Paragraph(_safe(gap_summary), table_body_style),
            ])

        rec_table = Table(rec_rows, colWidths=[130, 50, 152, 190])
        rec_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG_CARD),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        rec_story.append(rec_table)
        rec_story.append(Spacer(1, 12))

        story.append(KeepTogether(rec_story))

    # -----------------------------------------------------------------------
    # 6. Advisory Notice Footer
    # -----------------------------------------------------------------------
    disclaimer_text = (
        "<b>CareerLens Advisory Notice:</b> This report is generated by an automated intelligence "
        "pipeline for self-improvement and diagnostic guidance. Applicant tracking systems and employer "
        "screening algorithms vary across organizations; this report provides analytical guidance and does "
        "not guarantee candidate interview selection or placement outcomes."
    )
    disclaimer_table = Table([[Paragraph(disclaimer_text, sub_style)]], colWidths=[522])
    disclaimer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_CARD),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(Spacer(1, 4))
    story.append(disclaimer_table)

    # Build document with official onFirstPage and onLaterPages callbacks
    doc.build(story, onFirstPage=_draw_first_page, onLaterPages=_draw_later_page)
    return buf.getvalue()
