"""Before vs After dataset comparison using stable _dp_row_id tracking."""

from __future__ import annotations

from typing import Any
import pandas as pd

from .profiler import profile_dataset
from .storage import ROW_ID_COL, serialize_cell, user_columns


def compare_versions(
    raw_df: pd.DataFrame,
    current_df: pd.DataFrame,
    semantic_roles: dict[str, str],
    settings: dict[str, Any],
    page: int = 1,
    page_size: int = 25,
    filter_status: str = "all",
    search: str = "",
) -> dict[str, Any]:
    """Compare raw (v0) and current cleaned DataFrame with cell-level diff highlighting."""
    raw_prof = profile_dataset(raw_df, semantic_roles=semantic_roles, settings=settings)
    cur_prof = profile_dataset(current_df, semantic_roles=semantic_roles, settings=settings)

    cols = user_columns(raw_df)
    r_idx = raw_df.set_index(ROW_ID_COL) if ROW_ID_COL in raw_df.columns else raw_df
    c_idx = current_df.set_index(ROW_ID_COL) if ROW_ID_COL in current_df.columns else current_df

    raw_ids = list(r_idx.index)
    cur_id_set = set(c_idx.index.tolist())

    # Identify removed vs modified vs unchanged row IDs
    common_ids = r_idx.index.intersection(c_idx.index)
    removed_ids = [int(x) for x in raw_ids if x not in cur_id_set]

    modified_map: dict[int, list[str]] = {}
    total_modified_cells = 0
    if len(common_ids) > 0:
        r_sub = r_idx.loc[common_ids, cols].fillna("__DP_NA__").astype(str)
        c_sub = c_idx.loc[common_ids, cols].fillna("__DP_NA__").astype(str)
        diff_mat = r_sub != c_sub
        total_modified_cells = int(diff_mat.values.sum())
        row_has_diff = diff_mat.any(axis=1)
        for rid in diff_mat.index[row_has_diff]:
            changed_cols = [cols[j] for j, flag in enumerate(diff_mat.loc[rid].values) if flag]
            modified_map[int(rid)] = changed_cols

    # Build filtered row ID list
    filtered_rids: list[tuple[int, str]] = []
    q = search.strip().lower()

    for rid in raw_ids:
        rid_int = int(rid)
        if rid not in cur_id_set:
            st = "removed"
        elif rid_int in modified_map:
            st = "modified"
        else:
            st = "unchanged"

        if filter_status != "all" and st != filter_status:
            continue

        if q:
            row_vals = " ".join(str(r_idx.loc[rid, col]) for col in cols)
            if rid in cur_id_set:
                row_vals += " " + " ".join(str(c_idx.loc[rid, col]) for col in cols)
            if q not in row_vals.lower():
                continue

        filtered_rids.append((rid_int, st))

    total_filtered = len(filtered_rids)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    page_items = filtered_rids[start:end]

    rows_payload: list[dict[str, Any]] = []
    for rid_int, st in page_items:
        raw_row = {col: serialize_cell(r_idx.loc[rid_int, col]) for col in cols}
        clean_row = (
            {col: serialize_cell(c_idx.loc[rid_int, col]) for col in cols}
            if st != "removed"
            else None
        )
        rows_payload.append({
            "row_id": rid_int,
            "status": st,
            "modified_columns": modified_map.get(rid_int, []),
            "raw": raw_row,
            "cleaned": clean_row,
        })

    r_sum = raw_prof["summary"]
    c_sum = cur_prof["summary"]

    def pct_reduction(before: int, after: int) -> float:
        if before <= 0:
            return 0.0
        return round(max(0.0, ((before - after) / before) * 100.0), 2)

    retention_pct = round((c_sum["total_rows"] / r_sum["total_rows"]) * 100.0, 2) if r_sum["total_rows"] > 0 else 0.0

    return {
        "columns": cols,
        "metrics": {
            "rows_before": r_sum["total_rows"],
            "rows_after": c_sum["total_rows"],
            "rows_removed": len(removed_ids),
            "modified_rows": len(modified_map),
            "modified_cells": total_modified_cells,
            "retention_percentage": retention_pct,
            "missing_before": r_sum["missing_values"],
            "missing_after": c_sum["missing_values"],
            "missing_reduction_pct": pct_reduction(r_sum["missing_values"], c_sum["missing_values"]),
            "duplicates_before": r_sum["duplicate_rows"],
            "duplicates_after": c_sum["duplicate_rows"],
            "duplicate_reduction_pct": pct_reduction(r_sum["duplicate_rows"], c_sum["duplicate_rows"]),
            "invalid_before": r_sum["invalid_cells"],
            "invalid_after": c_sum["invalid_cells"],
            "invalid_reduction_pct": pct_reduction(r_sum["invalid_cells"], c_sum["invalid_cells"]),
            "outliers_before": r_sum["outliers_detected"],
            "outliers_after": c_sum["outliers_detected"],
            "quality_before": raw_prof["quality"]["overall_score"],
            "quality_after": cur_prof["quality"]["overall_score"],
            "quality_gain": round(cur_prof["quality"]["overall_score"] - raw_prof["quality"]["overall_score"], 2),
        },
        "quality_before": raw_prof["quality"],
        "quality_after": cur_prof["quality"],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total_filtered,
            "total_pages": max(1, (total_filtered + page_size - 1) // page_size),
        },
        "rows": rows_payload,
    }
