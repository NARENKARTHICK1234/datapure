"""Export cleaned datasets (CSV, Excel, JSON), audit/validation JSON reports, and PDF Data Quality Report."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import openpyxl
from openpyxl.styles import Font, PatternFill
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .storage import strip_row_id


def export_csv_bytes(df: pd.DataFrame) -> bytes:
    clean = strip_row_id(df)
    return clean.to_csv(index=False).encode("utf-8")


def export_json_bytes(df: pd.DataFrame) -> bytes:
    clean = strip_row_id(df)
    return clean.to_json(orient="records", indent=2, date_format="iso").encode("utf-8")


def export_excel_bytes(df: pd.DataFrame, sheet_name: str = "Cleaned_Data") -> bytes:
    clean = strip_row_id(df)
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:
        clean.to_excel(writer, index=False, sheet_name=sheet_name[:31])
        ws = writer.sheets[sheet_name[:31]]
        header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
        for col_cells in ws.columns:
            max_len = max((len(str(c.value or "")) for c in list(col_cells)[:200]), default=10)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max(max_len + 4, 12), 42)
    bio.seek(0)
    return bio.read()


def _render_chart_before_after(viz_data: dict[str, Any]) -> io.BytesIO:
    rows = viz_data["charts"]["grouped_before_after"]
    labels = [r["metric"] for r in rows]
    before = [r["Before"] for r in rows]
    after = [r["After"] for r in rows]

    fig, ax = plt.subplots(figsize=(7.0, 3.0), dpi=150)
    x = range(len(labels))
    w = 0.36
    ax.bar([i - w / 2 for i in x], before, width=w, label="Before Cleaning", color="#EF4444", alpha=0.85)
    ax.bar([i + w / 2 for i in x], after, width=w, label="After Cleaning", color="#10B981", alpha=0.9)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, rotation=20, ha="right", fontsize=8)
    ax.set_title("Data Quality Issues: Before vs After Cleaning", fontsize=10, fontweight="bold", color="#0F172A")
    ax.legend(frameon=False, fontsize=8)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


def _render_chart_dimensions(viz_data: dict[str, Any]) -> io.BytesIO:
    dims = viz_data["charts"]["radar_dimensions"]
    labels = [d["dimension"] for d in dims]
    before = [d["Before"] for d in dims]
    after = [d["After"] for d in dims]

    fig, ax = plt.subplots(figsize=(7.0, 2.8), dpi=150)
    y = range(len(labels))
    h = 0.34
    ax.barh([i + h / 2 for i in y], before, height=h, label="Initial", color="#94A3B8")
    ax.barh([i - h / 2 for i in y], after, height=h, label="Current", color="#4F46E5")
    ax.set_yticks(list(y))
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlim(0, 105)
    ax.set_title("Quality Dimensions Comparison (%)", fontsize=10, fontweight="bold", color="#0F172A")
    ax.legend(frameon=False, fontsize=8)
    ax.grid(axis="x", linestyle="--", alpha=0.3)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


def build_pdf_report(
    dataset_meta: dict[str, Any],
    raw_profile: dict[str, Any],
    cur_profile: dict[str, Any],
    validation_result: dict[str, Any],
    viz_data: dict[str, Any],
    audit_logs: list[dict[str, Any]],
) -> bytes:
    """Generate a multi-section commercial-grade PDF Data Quality Report."""
    bio = io.BytesIO()
    doc = SimpleDocTemplate(
        bio,
        pagesize=letter,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("DPTitle", parent=styles["Heading1"], fontSize=20, textColor=colors.HexColor("#4F46E5"), spaceAfter=4)
    sub_style = ParagraphStyle("DPSub", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#475569"), spaceAfter=14)
    h2_style = ParagraphStyle("DPH2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#0F172A"), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("DPBody", parent=styles["Normal"], fontSize=9.5, leading=13, textColor=colors.HexColor("#1E293B"))

    elements: list[Any] = []
    kpis = viz_data["kpis"]
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Header
    elements.append(Paragraph("DataPure — Data Quality & Structural Validation Report", title_style))
    elements.append(Paragraph(
        f"Dataset: <b>{dataset_meta['name']}</b> ({dataset_meta['original_filename']}) &bull; "
        f"Version: v{dataset_meta['current_version']} &bull; Generated: {now_str}"
        + (" &bull; <i>Synthetic Demo Dataset</i>" if dataset_meta.get("is_synthetic") else ""),
        sub_style,
    ))

    # 1. Dataset Summary & Before vs After
    elements.append(Paragraph("1. Executive Summary & Before vs After Comparison", h2_style))
    summary_table_data = [
        ["Metric", "Initial (Raw)", "Current (Cleaned)", "Delta / Status"],
        ["Total Records", f"{kpis['initial_records']:,}", f"{kpis['total_records']:,}", f"{kpis['retention_pct']}% retained"],
        ["Total Columns", f"{kpis['total_columns']}", f"{kpis['total_columns']}", "Preserved"],
        ["Missing Cells", f"{kpis['initial_missing_values']:,}", f"{kpis['missing_values']:,}", f"-{kpis['initial_missing_values'] - kpis['missing_values']:,}"],
        ["Duplicate Rows", f"{kpis['initial_duplicate_records']:,}", f"{kpis['duplicate_records']:,}", f"-{kpis['initial_duplicate_records'] - kpis['duplicate_records']:,}"],
        ["Invalid Records", f"{kpis['initial_invalid_records']:,}", f"{kpis['invalid_records']:,}", f"-{kpis['initial_invalid_records'] - kpis['invalid_records']:,}"],
        ["Outliers Detected", f"{kpis['initial_outliers_detected']:,}", f"{kpis['outliers_detected']:,}", f"-{kpis['initial_outliers_detected'] - kpis['outliers_detected']:,}"],
        ["Overall Quality Score", f"{kpis['initial_quality_score']}%", f"{kpis['final_quality_score']}% ({cur_profile['quality']['classification']})", f"+{kpis['quality_gain']} pts"],
    ]
    t1 = Table(summary_table_data, colWidths=[1.9 * inch, 1.4 * inch, 1.8 * inch, 1.8 * inch])
    t1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t1)
    elements.append(Spacer(1, 10))

    # 2. Data Quality Dimension Breakdown
    elements.append(Paragraph("2. Data Quality Score & Methodology", h2_style))
    elements.append(Paragraph(
        f"<b>Formula:</b> {cur_profile['quality']['formula']}. "
        f"<i>{cur_profile['quality']['note']}</i>",
        body_style,
    ))
    elements.append(Spacer(1, 6))
    dim_rows = [["Dimension", "Initial Score", "Current Score", "Details"]]
    for d_key in ["completeness", "uniqueness", "validity", "consistency"]:
        r_d = raw_profile["quality"]["dimensions"][d_key]
        c_d = cur_profile["quality"]["dimensions"][d_key]
        dim_rows.append([d_key.title(), f"{r_d['score']}%", f"{c_d['score']}%", c_d["details"]])
    t2 = Table(dim_rows, colWidths=[1.2 * inch, 1.0 * inch, 1.0 * inch, 3.7 * inch])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 10))

    # 3. Embedded Visualizations
    elements.append(Paragraph("3. Visual Analytics Summary", h2_style))
    img1 = RLImage(_render_chart_before_after(viz_data), width=6.6 * inch, height=2.8 * inch)
    img2 = RLImage(_render_chart_dimensions(viz_data), width=6.6 * inch, height=2.6 * inch)
    elements.append(img1)
    elements.append(Spacer(1, 8))
    elements.append(img2)

    # 4. Cleaning Operations Applied
    elements.append(Paragraph("4. Cleaning Operations History", h2_style))
    if audit_logs:
        audit_rows = [["Timestamp", "Action", "Summary", "Modified / Removed"]]
        for log in audit_logs[:15]:
            audit_rows.append([
                log["created_at"][:19].replace("T", " "),
                log["action_type"],
                log["summary"][:65],
                f"{log['modified_cells_count']} cells / {log['removed_rows_count']} rows",
            ])
        t3 = Table(audit_rows, colWidths=[1.4 * inch, 1.1 * inch, 2.9 * inch, 1.5 * inch])
        t3.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#06B6D4")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t3)
    else:
        elements.append(Paragraph("No cleaning operations have been applied yet.", body_style))

    # 5. Structural Validation Results
    elements.append(Paragraph("5. Structural Validation Results", h2_style))
    v_sum = validation_result["summary"]
    elements.append(Paragraph(
        f"Rules Evaluated: <b>{v_sum['total_rules']}</b> &bull; "
        f"Passed: <b>{v_sum['passed']}</b> &bull; "
        f"Failed: <b>{v_sum['failed']}</b> &bull; "
        f"Warnings: <b>{v_sum['warnings']}</b> &bull; "
        f"Pass Rate: <b>{v_sum['pass_rate']}%</b>",
        body_style,
    ))
    elements.append(Spacer(1, 6))
    val_rows = [["Rule", "Column", "Status", "Failures", "Message"]]
    for res in validation_result["results"][:20]:
        val_rows.append([
            res["name"][:28],
            str(res.get("column_name") or "-"),
            res["status"].upper(),
            str(res["failing_count"]),
            res["message"][:52],
        ])
    t4 = Table(val_rows, colWidths=[1.7 * inch, 1.1 * inch, 0.8 * inch, 0.7 * inch, 2.6 * inch])
    t4.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t4)

    # 6. Remaining Issues & Final Recommendations
    elements.append(Paragraph("6. Remaining Issues & Final Recommendations", h2_style))
    recs = cur_profile.get("recommendations", [])
    if recs:
        for r in recs[:10]:
            elements.append(Paragraph(
                f"&bull; <b>[{r['severity'].upper()}] {r['title']}</b>: {r['description']} "
                f"(<i>Recommended: {r['recommended_action']}</i>)",
                body_style,
            ))
            elements.append(Spacer(1, 3))
    else:
        elements.append(Paragraph(
            "No outstanding structural or formatting issues were detected. The dataset is ready for analytical consumption.",
            body_style,
        ))

    doc.build(elements)
    bio.seek(0)
    return bio.read()
