"""Pandas & NumPy data cleaning engine with preview diffing, safety checks, and auto-recommendations."""

from __future__ import annotations

import re
from typing import Any
import numpy as np
import pandas as pd

from ..models import CleaningOperation
from .profiler import (
    EMAIL_REGEX,
    _is_valid_email,
    _is_valid_phone,
    _to_numeric_clean,
    is_missing_series,
    profile_dataset,
)
from .storage import ROW_ID_COL, serialize_cell, user_columns

DESTRUCTIVE_OPS = {"remove_duplicates", "remove_empty_rows"}


def _clean_single_phone(val: Any, flag_invalid_as_null: bool = True) -> Any:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    s = str(val).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    if re.search(r"[A-Za-z]", s):
        return None if flag_invalid_as_null else s
    digits = re.sub(r"\D", "", s)
    if len(digits) == 10:
        return f"+1-{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+1-{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    if 7 <= len(digits) <= 15:
        return f"+{digits}"
    return None if flag_invalid_as_null else s


def _clean_single_email(val: Any, flag_invalid_as_null: bool = True) -> Any:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    s = str(val).strip().lower()
    if not s or s in {"nan", "none", "null"}:
        return None
    if EMAIL_REGEX.match(s):
        return s
    return None if flag_invalid_as_null else s


def is_operation_destructive(op: CleaningOperation) -> tuple[bool, str | None]:
    if op.op_type == "remove_duplicates":
        return True, "Removes duplicate rows permanently from the active dataset version."
    if op.op_type == "remove_empty_rows":
        return True, "Removes completely empty rows from the active dataset version."
    if op.op_type == "handle_outliers" and op.params.get("action") == "remove":
        return True, "Deletes rows containing statistical outliers."
    return False, None


def apply_operations(
    df: pd.DataFrame,
    operations: list[CleaningOperation],
    semantic_roles: dict[str, str],
    settings: dict[str, Any],
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """
    Apply cleaning operations sequentially on a copy of df while preserving _dp_row_id.
    Returns (cleaned_df, operation_logs).
    """
    out = df.copy()
    cols = user_columns(out)
    op_logs: list[dict[str, Any]] = []

    iqr_mult = float(settings.get("iqr_multiplier", 1.5))
    z_thresh = float(settings.get("zscore_threshold", 3.0))

    for op in operations:
        target_cols = [c for c in op.columns if c in cols] if op.columns else cols
        rows_before = len(out)

        if op.op_type == "remove_empty_rows":
            miss_mat = pd.DataFrame({c: is_missing_series(out[c]) for c in cols}, index=out.index)
            keep_mask = ~miss_mat.all(axis=1)
            removed = int((~keep_mask).sum())
            out = out.loc[keep_mask].reset_index(drop=True)
            op_logs.append({"op_type": op.op_type, "columns": cols, "rows_removed": removed, "summary": f"Removed {removed} empty rows"})

        elif op.op_type == "remove_duplicates":
            subset = [c for c in op.columns if c in cols] if op.columns else cols
            keep = op.params.get("keep", "first")
            if keep not in {"first", "last"}:
                keep = "first"
            norm = out[subset].fillna("__DP_NULL__").astype(str)
            dup_mask = norm.duplicated(keep=keep)
            removed = int(dup_mask.sum())
            out = out.loc[~dup_mask].reset_index(drop=True)
            op_logs.append({"op_type": op.op_type, "columns": subset, "rows_removed": removed, "summary": f"Removed {removed} duplicate rows (keep={keep})"})

        elif op.op_type == "trim_whitespace":
            changed = 0
            for c in target_cols:
                miss = is_missing_series(out[c])
                s = out.loc[~miss, c].astype(str)
                cleaned = s.str.strip().str.replace(r"\s{2,}", " ", regex=True)
                changed += int((s != cleaned).sum())
                out.loc[~miss, c] = cleaned
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Trimmed whitespace in {changed} cells"})

        elif op.op_type == "standardize_case":
            style = str(op.params.get("case_style", "title")).lower()
            changed = 0
            for c in target_cols:
                miss = is_missing_series(out[c])
                s = out.loc[~miss, c].astype(str).str.strip()
                if style == "lower":
                    cleaned = s.str.lower()
                elif style == "upper":
                    cleaned = s.str.upper()
                else:
                    cleaned = s.str.title()
                changed += int((out.loc[~miss, c].astype(str) != cleaned).sum())
                out.loc[~miss, c] = cleaned
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Standardized casing ({style}) across {changed} cells"})

        elif op.op_type == "convert_dtype":
            target_type = str(op.params.get("target_type", "numeric")).lower()
            changed = 0
            for c in target_cols:
                if target_type in {"numeric", "float", "int"}:
                    before = out[c].copy()
                    num = _to_numeric_clean(out[c])
                    if target_type == "int":
                        # Keep as nullable Int64 if possible, otherwise float
                        num = num.round(0)
                    out[c] = num
                    changed += int((before.astype(str) != out[c].astype(str)).sum())
                elif target_type == "string":
                    miss = is_missing_series(out[c])
                    out.loc[~miss, c] = out.loc[~miss, c].astype(str).str.strip()
                elif target_type == "datetime":
                    parsed = pd.to_datetime(out[c], format="mixed", errors="coerce")
                    out[c] = parsed.dt.strftime("%Y-%m-%d").where(parsed.notna(), None)
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Converted {len(target_cols)} column(s) to {target_type}"})

        elif op.op_type == "standardize_dates":
            fmt = str(op.params.get("format", settings.get("date_format", "%Y-%m-%d")))
            flag_invalid = bool(op.params.get("flag_invalid_as_null", True))
            changed = 0
            for c in target_cols:
                miss = is_missing_series(out[c])
                s = out.loc[~miss, c].astype(str).str.strip()
                parsed = pd.to_datetime(s, format="mixed", errors="coerce")
                formatted = parsed.dt.strftime(fmt)
                if flag_invalid:
                    new_vals = formatted.where(parsed.notna(), None)
                else:
                    new_vals = formatted.where(parsed.notna(), s)
                changed += int((s.fillna("") != new_vals.fillna("")).sum())
                out.loc[~miss, c] = new_vals
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Standardized dates ({fmt}) in {changed} cells"})

        elif op.op_type == "normalize_emails":
            flag_invalid = bool(op.params.get("flag_invalid_as_null", True))
            changed = 0
            for c in target_cols:
                before = out[c].copy()
                out[c] = out[c].apply(lambda v: _clean_single_email(v, flag_invalid))
                changed += int((before.fillna("__NA__").astype(str) != out[c].fillna("__NA__").astype(str)).sum())
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Normalized emails across {changed} cells"})

        elif op.op_type == "normalize_phones":
            flag_invalid = bool(op.params.get("flag_invalid_as_null", True))
            changed = 0
            for c in target_cols:
                before = out[c].copy()
                out[c] = out[c].apply(lambda v: _clean_single_phone(v, flag_invalid))
                changed += int((before.fillna("__NA__").astype(str) != out[c].fillna("__NA__").astype(str)).sum())
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Normalized phone numbers across {changed} cells"})

        elif op.op_type == "replace_invalid":
            action = str(op.params.get("action", "nullify")).lower()
            replacement = op.params.get("replacement", None)
            min_val = op.params.get("min_val", None)
            max_val = op.params.get("max_val", None)
            changed = 0
            for c in target_cols:
                role = semantic_roles.get(c, "text")
                miss = is_missing_series(out[c])
                if role in {"age", "positive_numeric", "numeric"} or min_val is not None or max_val is not None:
                    num = _to_numeric_clean(out[c])
                    bad = (~miss) & num.isna()
                    if role == "age":
                        lo = float(min_val) if min_val is not None else 1.0
                        hi = float(max_val) if max_val is not None else 120.0
                        bad = bad | ((~miss) & ((num < lo) | (num > hi)))
                    elif role == "positive_numeric":
                        lo = float(min_val) if min_val is not None else 0.0
                        bad = bad | ((~miss) & (num < lo))
                        if max_val is not None:
                            bad = bad | ((~miss) & (num > float(max_val)))
                    else:
                        if min_val is not None:
                            bad = bad | ((~miss) & (num < float(min_val)))
                        if max_val is not None:
                            bad = bad | ((~miss) & (num > float(max_val)))
                    cnt = int(bad.sum())
                    if cnt > 0:
                        out.loc[bad, c] = None if action == "nullify" else replacement
                        changed += cnt
                elif role == "email":
                    bad = (~miss) & (~out[c].apply(_is_valid_email))
                    cnt = int(bad.sum())
                    if cnt > 0:
                        out.loc[bad, c] = None if action == "nullify" else replacement
                        changed += cnt
                elif role == "phone":
                    bad = (~miss) & (~out[c].apply(_is_valid_phone))
                    cnt = int(bad.sum())
                    if cnt > 0:
                        out.loc[bad, c] = None if action == "nullify" else replacement
                        changed += cnt
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Corrected/nullified {changed} invalid values"})

        elif op.op_type == "impute_missing":
            strategy = str(op.params.get("strategy", "median")).lower()
            custom_val = op.params.get("custom_value", None)
            changed = 0
            for c in target_cols:
                miss = is_missing_series(out[c])
                miss_cnt = int(miss.sum())
                if miss_cnt == 0:
                    continue
                fill_val: Any = None
                if strategy == "custom" and custom_val is not None:
                    fill_val = custom_val
                elif strategy in {"mean", "median"}:
                    num = _to_numeric_clean(out.loc[~miss, c]).dropna()
                    if len(num) > 0:
                        val = float(num.mean() if strategy == "mean" else num.median())
                        fill_val = int(round(val)) if semantic_roles.get(c) == "age" else round(val, 2)
                elif strategy == "mode":
                    non_m = out.loc[~miss, c].dropna()
                    if len(non_m) > 0:
                        fill_val = non_m.mode().iloc[0]

                if fill_val is not None:
                    out.loc[miss, c] = fill_val
                    changed += miss_cnt
            op_logs.append({"op_type": op.op_type, "columns": target_cols, "cells_modified": changed, "summary": f"Imputed {changed} missing cells using {strategy}"})

        elif op.op_type == "handle_outliers":
            method = str(op.params.get("method", settings.get("outlier_method", "iqr"))).lower()
            action = str(op.params.get("action", "cap")).lower()
            changed = 0
            removed = 0
            keep_all = pd.Series(True, index=out.index)
            for c in target_cols:
                num = _to_numeric_clean(out[c])
                valid = num.dropna()
                if len(valid) < 4:
                    continue
                if method == "zscore":
                    mean_v = float(valid.mean())
                    std_v = float(valid.std(ddof=1))
                    if std_v == 0:
                        continue
                    lo = mean_v - z_thresh * std_v
                    hi = mean_v + z_thresh * std_v
                else:
                    q1 = float(valid.quantile(0.25))
                    q3 = float(valid.quantile(0.75))
                    iqr = q3 - q1
                    if iqr == 0:
                        continue
                    lo = q1 - iqr_mult * iqr
                    hi = q3 + iqr_mult * iqr

                out_mask = num.notna() & ((num < lo) | (num > hi))
                cnt = int(out_mask.sum())
                if cnt == 0:
                    continue
                if action == "remove":
                    keep_all = keep_all & (~out_mask)
                else:
                    # Cap (Winsorize)
                    capped = num.clip(lower=lo, upper=hi).round(2)
                    out.loc[out_mask, c] = capped.loc[out_mask]
                    changed += cnt
            if action == "remove":
                removed = int((~keep_all).sum())
                out = out.loc[keep_all].reset_index(drop=True)
            op_logs.append({
                "op_type": op.op_type,
                "columns": target_cols,
                "cells_modified": changed,
                "rows_removed": removed,
                "summary": f"Handled outliers ({method}/{action}): modified {changed} cells, removed {removed} rows",
            })

    return out, op_logs


def build_auto_cleaning_plan(
    df: pd.DataFrame,
    semantic_roles: dict[str, str],
    settings: dict[str, Any],
) -> list[CleaningOperation]:
    """Generate a recommended, ordered list of CleaningOperation objects from detected issues."""
    prof = profile_dataset(df, semantic_roles=semantic_roles, settings=settings)
    ops: list[CleaningOperation] = []
    cols = user_columns(df)

    if prof["summary"]["empty_rows"] > 0:
        ops.append(CleaningOperation(op_type="remove_empty_rows", columns=[], params={}))

    if prof["summary"]["duplicate_rows"] > 0:
        ops.append(CleaningOperation(op_type="remove_duplicates", columns=[], params={"keep": "first"}))

    ws_cols = [c["name"] for c in prof["columns"] if c["whitespace_issues"] > 0]
    if ws_cols:
        ops.append(CleaningOperation(op_type="trim_whitespace", columns=ws_cols, params={}))

    mixed_cols = [c["name"] for c in prof["columns"] if c["mixed_type_count"] > 0]
    if mixed_cols:
        ops.append(CleaningOperation(op_type="convert_dtype", columns=mixed_cols, params={"target_type": "numeric"}))

    date_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] == "date"]
    if date_cols:
        ops.append(CleaningOperation(op_type="standardize_dates", columns=date_cols, params={"format": settings.get("date_format", "%Y-%m-%d"), "flag_invalid_as_null": True}))

    email_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] == "email"]
    if email_cols:
        ops.append(CleaningOperation(op_type="normalize_emails", columns=email_cols, params={"flag_invalid_as_null": True}))

    phone_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] == "phone"]
    if phone_cols:
        ops.append(CleaningOperation(op_type="normalize_phones", columns=phone_cols, params={"flag_invalid_as_null": True}))

    case_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] in {"categorical", "text"} and any("casing" in i for i in c["issues"])]
    if case_cols:
        ops.append(CleaningOperation(op_type="standardize_case", columns=case_cols, params={"case_style": "title"}))

    domain_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] in {"age", "positive_numeric"} and c["invalid_count"] > 0]
    if domain_cols:
        ops.append(CleaningOperation(op_type="replace_invalid", columns=domain_cols, params={"action": "nullify"}))

    # Re-check numeric & categorical imputation
    num_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] in {"numeric", "positive_numeric", "age"}]
    if num_cols:
        ops.append(CleaningOperation(op_type="impute_missing", columns=num_cols, params={"strategy": settings.get("default_numeric_imputation", "median")}))

    cat_cols = [c["name"] for c in prof["columns"] if c["semantic_role"] == "categorical"]
    if cat_cols:
        ops.append(CleaningOperation(op_type="impute_missing", columns=cat_cols, params={"strategy": settings.get("default_categorical_imputation", "mode")}))

    out_cols = [c["name"] for c in prof["columns"] if c["outliers_count"] > 0]
    if out_cols:
        ops.append(CleaningOperation(op_type="handle_outliers", columns=out_cols, params={"method": settings.get("outlier_method", "iqr"), "action": "cap"}))

    return ops


def preview_cleaning(
    df: pd.DataFrame,
    operations: list[CleaningOperation],
    semantic_roles: dict[str, str],
    settings: dict[str, Any],
) -> dict[str, Any]:
    """Simulate cleaning operations and return detailed cell/row diff preview without persisting."""
    before_prof = profile_dataset(df, semantic_roles=semantic_roles, settings=settings)
    cleaned_df, op_logs = apply_operations(df, operations, semantic_roles, settings)
    after_prof = profile_dataset(cleaned_df, semantic_roles=semantic_roles, settings=settings)

    cols = user_columns(df)
    before_indexed = df.set_index(ROW_ID_COL) if ROW_ID_COL in df.columns else df
    after_indexed = cleaned_df.set_index(ROW_ID_COL) if ROW_ID_COL in cleaned_df.columns else cleaned_df

    common_ids = before_indexed.index.intersection(after_indexed.index)
    removed_ids = before_indexed.index.difference(after_indexed.index)

    modified_cells_count = 0
    sample_changes: list[dict[str, Any]] = []

    if len(common_ids) > 0:
        b_sub = before_indexed.loc[common_ids, cols].fillna("__DP_NA__").astype(str)
        a_sub = after_indexed.loc[common_ids, cols].fillna("__DP_NA__").astype(str)
        diff_mask = b_sub != a_sub
        modified_cells_count = int(diff_mask.values.sum())

        # Collect up to 40 sample cell changes
        diff_coords = np.argwhere(diff_mask.values)
        for r_idx, c_idx in diff_coords[:40]:
            rid = common_ids[r_idx]
            col_name = cols[c_idx]
            sample_changes.append({
                "row_id": int(rid),
                "column": col_name,
                "before": serialize_cell(before_indexed.loc[rid, col_name]),
                "after": serialize_cell(after_indexed.loc[rid, col_name]),
            })

    destructive_reasons: list[str] = []
    for op in operations:
        is_dest, reason = is_operation_destructive(op)
        if is_dest and reason and reason not in destructive_reasons:
            destructive_reasons.append(reason)

    return {
        "rows_before": len(df),
        "rows_after": len(cleaned_df),
        "rows_removed": len(removed_ids),
        "modified_cells_count": modified_cells_count,
        "requires_confirmation": len(destructive_reasons) > 0 or len(removed_ids) > 0,
        "destructive_reasons": destructive_reasons,
        "operation_logs": op_logs,
        "sample_changes": sample_changes,
        "quality_before": before_prof["quality"],
        "quality_after": after_prof["quality"],
        "summary_before": before_prof["summary"],
        "summary_after": after_prof["summary"],
    }
