"""Real dataset-driven analytics engine generating payloads for all 16 required visualizations."""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd

from .profiler import _to_numeric_clean, is_missing_series, profile_dataset
from .storage import ROW_ID_COL, user_columns


def build_visualizations(
    raw_df: pd.DataFrame,
    current_df: pd.DataFrame,
    semantic_roles: dict[str, str],
    settings: dict[str, Any],
    versions: list[dict[str, Any]],
    audit_logs: list[dict[str, Any]],
    numeric_col: str | None = None,
    scatter_x: str | None = None,
    scatter_y: str | None = None,
    category_col: str | None = None,
) -> dict[str, Any]:
    """Compute all 16 interactive visualization payloads strictly from real processed dataset values."""
    raw_prof = profile_dataset(raw_df, semantic_roles=semantic_roles, settings=settings)
    cur_prof = profile_dataset(current_df, semantic_roles=semantic_roles, settings=settings)

    cols = user_columns(current_df)
    r_sum = raw_prof["summary"]
    c_sum = cur_prof["summary"]

    # Identify numeric & categorical columns dynamically
    numeric_cols: list[str] = []
    categorical_cols: list[str] = []
    numeric_df = pd.DataFrame(index=current_df.index)

    for c in cur_prof["columns"]:
        name = c["name"]
        if c["stats"]["mean"] is not None or c["semantic_role"] in {"numeric", "positive_numeric", "age"}:
            s = _to_numeric_clean(current_df[name])
            if s.notna().sum() >= 2:
                numeric_cols.append(name)
                numeric_df[name] = s
        elif c["semantic_role"] in {"categorical"} or (c["unique_count"] <= 25 and c["unique_count"] >= 2):
            categorical_cols.append(name)

    selected_num = numeric_col if numeric_col in numeric_cols else (numeric_cols[0] if numeric_cols else None)
    selected_sx = scatter_x if scatter_x in numeric_cols else (numeric_cols[0] if numeric_cols else None)
    selected_sy = scatter_y if scatter_y in numeric_cols else (numeric_cols[1] if len(numeric_cols) > 1 else selected_sx)
    selected_cat = category_col if category_col in categorical_cols else (categorical_cols[0] if categorical_cols else None)

    # 1. Interactive Donut Chart - Data issue distribution (current active dataset, plus initial)
    donut_issues = cur_prof["issue_breakdown"]
    donut_initial = raw_prof["issue_breakdown"]

    # 2. Grouped Bar Chart - Before vs After cleaning
    grouped_before_after = [
        {"metric": "Missing Cells", "Before": r_sum["missing_values"], "After": c_sum["missing_values"]},
        {"metric": "Duplicates", "Before": r_sum["duplicate_rows"], "After": c_sum["duplicate_rows"]},
        {"metric": "Invalid Values", "Before": r_sum["invalid_cells"], "After": c_sum["invalid_cells"]},
        {"metric": "Format & Casing", "Before": r_sum["inconsistent_formats"], "After": c_sum["inconsistent_formats"]},
        {"metric": "Whitespace", "Before": r_sum["whitespace_issues"], "After": c_sum["whitespace_issues"]},
        {"metric": "Outliers", "Before": r_sum["outliers_detected"], "After": c_sum["outliers_detected"]},
    ]

    # 3. Horizontal Bar Chart - Missing values by column (sorted descending)
    missing_by_column = sorted(
        [
            {
                "column": c["name"],
                "missing": c["missing_count"],
                "missing_pct": c["missing_percentage"],
                "non_null": c["non_null_count"],
            }
            for c in cur_prof["columns"]
        ],
        key=lambda x: x["missing"],
        reverse=True,
    )

    # 4 & 16. Line Chart & Area Chart - Data quality improvement across versions/stages
    version_timeline: list[dict[str, Any]] = []
    for v in sorted(versions, key=lambda x: x["version_number"]):
        q_json = v.get("quality_json") or {}
        dims = q_json.get("dimensions") or {}
        version_timeline.append({
            "stage": f"v{v['version_number']}" + (" (Raw)" if v["version_number"] == 0 else ""),
            "version": v["version_number"],
            "description": v["description"],
            "overall_score": round(float(v["quality_score"]), 2),
            "completeness": round(float((dims.get("completeness") or {}).get("score", 0)), 2),
            "uniqueness": round(float((dims.get("uniqueness") or {}).get("score", 0)), 2),
            "validity": round(float((dims.get("validity") or {}).get("score", 0)), 2),
            "consistency": round(float((dims.get("consistency") or {}).get("score", 0)), 2),
            "rows": v["row_count"],
        })

    # 5. Radar Chart - Data quality dimensions (Before vs After)
    r_dims = raw_prof["quality"]["dimensions"]
    c_dims = cur_prof["quality"]["dimensions"]
    retention_pct = round((c_sum["total_rows"] / r_sum["total_rows"]) * 100.0, 2) if r_sum["total_rows"] > 0 else 100.0
    radar_dimensions = [
        {"dimension": "Completeness", "Before": r_dims["completeness"]["score"], "After": c_dims["completeness"]["score"]},
        {"dimension": "Uniqueness", "Before": r_dims["uniqueness"]["score"], "After": c_dims["uniqueness"]["score"]},
        {"dimension": "Validity", "Before": r_dims["validity"]["score"], "After": c_dims["validity"]["score"]},
        {"dimension": "Consistency", "Before": r_dims["consistency"]["score"], "After": c_dims["consistency"]["score"]},
        {"dimension": "Retention", "Before": 100.0, "After": retention_pct},
    ]

    # 6. Missing Value Heatmap (Plotly) - Bin dataset into up to 30 row blocks x all columns (% missing in each block)
    n_rows = len(current_df)
    n_bins = min(25, max(1, n_rows))
    heatmap_z: list[list[float]] = []
    heatmap_y: list[str] = []
    if n_rows > 0 and cols:
        miss_mat = pd.DataFrame({col: is_missing_series(current_df[col]).astype(float) for col in cols})
        bin_edges = np.linspace(0, n_rows, n_bins + 1, dtype=int)
        for i in range(n_bins):
            s_i, e_i = int(bin_edges[i]), int(bin_edges[i + 1])
            if e_i <= s_i:
                continue
            chunk = miss_mat.iloc[s_i:e_i]
            heatmap_z.append([round(float(chunk[col].mean() * 100.0), 1) for col in cols])
            heatmap_y.append(f"Rows {s_i + 1}–{e_i}")

    missing_heatmap = {
        "x": cols,
        "y": heatmap_y,
        "z": heatmap_z,
    }

    # 7. Box Plot (Plotly) - Numerical outlier detection across numeric columns (normalized & raw per column)
    boxplot_series: list[dict[str, Any]] = []
    for nc in numeric_cols:
        vals = numeric_df[nc].dropna()
        if len(vals) > 0:
            # Cap sample at 1500 points preserving min/max/quantiles/outliers for responsive browser rendering
            if len(vals) > 1500:
                q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
                iqr = q3 - q1
                outliers = vals[(vals < q1 - 1.5 * iqr) | (vals > q3 + 1.5 * iqr)]
                inliers = vals[(vals >= q1 - 1.5 * iqr) & (vals <= q3 + 1.5 * iqr)].sample(
                    min(1000, len(vals)), random_state=42
                )
                sampled = pd.concat([inliers, outliers.head(500)])
            else:
                sampled = vals
            boxplot_series.append({
                "column": nc,
                "values": [round(float(v), 3) for v in sampled.tolist()],
            })

    # 8. Histogram (Plotly) - Selected numerical column distribution
    histogram_data: dict[str, Any] = {"column": selected_num, "values": []}
    if selected_num and selected_num in numeric_df.columns:
        vals = numeric_df[selected_num].dropna()
        if len(vals) > 5000:
            vals = vals.sample(5000, random_state=42)
        histogram_data = {
            "column": selected_num,
            "values": [round(float(v), 3) for v in vals.tolist()],
        }

    # 9. Scatter Plot (Plotly) - Relationship between two numerical columns
    scatter_data: dict[str, Any] = {"x_col": selected_sx, "y_col": selected_sy, "points": []}
    if selected_sx and selected_sy and selected_sx in numeric_df.columns and selected_sy in numeric_df.columns:
        pair = pd.DataFrame({
            "x": numeric_df[selected_sx],
            "y": numeric_df[selected_sy],
        })
        if selected_cat and selected_cat in current_df.columns:
            pair["cat"] = current_df[selected_cat].fillna("Missing").astype(str).str.strip()
        else:
            pair["cat"] = "Record"
        pair = pair.dropna(subset=["x", "y"])
        if len(pair) > 1200:
            pair = pair.sample(1200, random_state=42)
        scatter_data = {
            "x_col": selected_sx,
            "y_col": selected_sy,
            "color_col": selected_cat,
            "x": [round(float(v), 3) for v in pair["x"].tolist()],
            "y": [round(float(v), 3) for v in pair["y"].tolist()],
            "categories": pair["cat"].tolist(),
        }

    # 10. Correlation Heatmap (Plotly) - Numerical feature correlation
    corr_matrix: dict[str, Any] = {"columns": numeric_cols, "z": []}
    if len(numeric_cols) >= 1:
        corr = numeric_df[numeric_cols].corr(method="pearson").fillna(0.0)
        corr_matrix = {
            "columns": numeric_cols,
            "z": [[round(float(val), 3) for val in row] for row in corr.values],
        }

    # 11. Stacked Bar Chart - Valid, Invalid, and Missing values per column
    stacked_column_health = []
    for c in cur_prof["columns"]:
        invalid_c = c["invalid_count"]
        miss_c = c["missing_count"]
        valid_c = max(0, c_sum["total_rows"] - miss_c - invalid_c)
        stacked_column_health.append({
            "column": c["name"],
            "Valid": valid_c,
            "Missing": miss_c,
            "Invalid": invalid_c,
        })

    # 12. Radial Gauge Chart - Overall Data Quality Score (Before & After)
    gauge = {
        "before": raw_prof["quality"]["overall_score"],
        "after": cur_prof["quality"]["overall_score"],
        "classification": cur_prof["quality"]["classification"],
        "improvement": round(cur_prof["quality"]["overall_score"] - raw_prof["quality"]["overall_score"], 2),
    }

    # 13. Treemap - Categorical data distribution
    treemap_data: list[dict[str, Any]] = []
    if selected_cat and selected_cat in current_df.columns:
        vc = (
            current_df[selected_cat]
            .fillna("Missing / Null")
            .astype(str)
            .str.strip()
            .replace("", "Missing / Null")
            .value_counts()
            .head(20)
        )
        palette = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#3B82F6", "#14B8A6"]
        for idx, (label, cnt) in enumerate(vc.items()):
            treemap_data.append({
                "name": str(label),
                "size": int(cnt),
                "fill": palette[idx % len(palette)],
            })

    # 14. Waterfall Chart (Plotly) - Record removal & retention breakdown
    empty_removed = max(0, r_sum["empty_rows"] - c_sum["empty_rows"])
    dup_removed = max(0, r_sum["duplicate_rows"] - c_sum["duplicate_rows"])
    total_removed = max(0, r_sum["total_rows"] - c_sum["total_rows"])
    other_removed = max(0, total_removed - empty_removed - dup_removed)

    waterfall = {
        "labels": ["Initial Records", "Empty Rows Removed", "Duplicates Removed", "Other/Outliers Removed", "Retained Records"],
        "measures": ["absolute", "relative", "relative", "relative", "total"],
        "values": [r_sum["total_rows"], -empty_removed, -dup_removed, -other_removed, c_sum["total_rows"]],
    }

    # 15. Funnel Chart (Plotly) - Data cleaning workflow
    non_empty_rows = max(0, r_sum["total_rows"] - r_sum["empty_rows"])
    unique_rows = max(0, non_empty_rows - r_sum["duplicate_rows"])
    valid_rows_after = max(0, c_sum["total_rows"] - c_sum["invalid_records"])
    funnel = {
        "stages": [
            "Raw Uploaded Records",
            "Non-Empty Records",
            "Unique (Deduplicated)",
            "Current Retained",
            "Fully Validated Records",
        ],
        "values": [
            r_sum["total_rows"],
            non_empty_rows,
            unique_rows,
            c_sum["total_rows"],
            valid_rows_after,
        ],
    }

    # KPI summary
    issues_resolved = max(0, r_sum["total_issues"] - c_sum["total_issues"])
    kpis = {
        "total_records": c_sum["total_rows"],
        "initial_records": r_sum["total_rows"],
        "total_columns": c_sum["total_columns"],
        "missing_values": c_sum["missing_values"],
        "initial_missing_values": r_sum["missing_values"],
        "duplicate_records": c_sum["duplicate_rows"],
        "initial_duplicate_records": r_sum["duplicate_rows"],
        "invalid_records": c_sum["invalid_records"],
        "initial_invalid_records": r_sum["invalid_records"],
        "outliers_detected": c_sum["outliers_detected"],
        "initial_outliers_detected": r_sum["outliers_detected"],
        "issues_resolved": issues_resolved,
        "records_retained": c_sum["total_rows"],
        "retention_pct": retention_pct,
        "initial_quality_score": raw_prof["quality"]["overall_score"],
        "final_quality_score": cur_prof["quality"]["overall_score"],
        "quality_gain": round(cur_prof["quality"]["overall_score"] - raw_prof["quality"]["overall_score"], 2),
    }

    return {
        "kpis": kpis,
        "available_columns": {
            "all": cols,
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "selected_numeric": selected_num,
            "selected_scatter_x": selected_sx,
            "selected_scatter_y": selected_sy,
            "selected_category": selected_cat,
        },
        "charts": {
            "donut_issues": donut_issues,
            "donut_initial_issues": donut_initial,
            "grouped_before_after": grouped_before_after,
            "missing_by_column": missing_by_column,
            "quality_timeline": version_timeline,
            "radar_dimensions": radar_dimensions,
            "missing_heatmap": missing_heatmap,
            "boxplot": boxplot_series,
            "histogram": histogram_data,
            "scatter": scatter_data,
            "correlation_heatmap": corr_matrix,
            "stacked_column_health": stacked_column_health,
            "radial_gauge": gauge,
            "treemap": treemap_data,
            "waterfall": waterfall,
            "funnel": funnel,
        },
        "quality_before": raw_prof["quality"],
        "quality_after": cur_prof["quality"],
        "recommendations": cur_prof["recommendations"],
    }
