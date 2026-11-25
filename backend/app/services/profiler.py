"""Data profiling, issue detection, smart recommendations, and 4-dimension quality scoring engine."""

from __future__ import annotations

import re
from typing import Any
import numpy as np
import pandas as pd

from .storage import ROW_ID_COL, serialize_cell, user_columns

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

DATE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("YYYY-MM-DD", re.compile(r"^\d{4}-\d{2}-\d{2}$")),
    ("MM/DD/YYYY", re.compile(r"^\d{2}/\d{2}/\d{4}$")),
    ("DD-MMM-YYYY", re.compile(r"^\d{2}-[A-Za-z]{3}-\d{4}$")),
    ("YYYY/MM/DD", re.compile(r"^\d{4}/\d{2}/\d{2}$")),
    ("DD/MM/YYYY", re.compile(r"^\d{2}/\d{2}/\d{4}$")),
    ("ISO_DATETIME", re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")),
]


def is_missing_series(series: pd.Series) -> pd.Series:
    """Return boolean mask where values are NaN, None, or empty/whitespace-only strings."""
    na_mask = series.isna()
    str_mask = series.astype(str).str.strip().isin(["", "nan", "None", "null", "NULL", "NaN", "nat", "NaT"])
    # Careful: only treat literal empty/null strings as missing when originally not NaN
    return na_mask | (series.notna() & str_mask)


def _to_numeric_clean(series: pd.Series) -> pd.Series:
    """Attempt numeric conversion stripping currency symbols and commas."""
    cleaned = series.astype(str).str.strip().str.replace(r"^[$\u20ac\u00a3\u20b9]\s*", "", regex=True).str.replace(",", "", regex=False)
    return pd.to_numeric(cleaned, errors="coerce")


def _looks_like_date_str(val: str) -> bool:
    s = val.strip()
    if not s or len(s) < 6 or len(s) > 32:
        return False
    if s.replace(".", "", 1).replace("-", "", 1).isdigit():
        return False
    try:
        pd.to_datetime(s, format="mixed")
        return True
    except Exception:
        return False


def _detect_date_format_label(val: str) -> str:
    s = val.strip()
    for label, pat in DATE_PATTERNS:
        if pat.match(s):
            return label
    return "OTHER"


def _is_valid_phone(val: Any) -> bool:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return True
    s = str(val).strip()
    if not s:
        return True
    if re.search(r"[A-Za-z]", s):
        return False
    digits = re.sub(r"\D", "", s)
    return 7 <= len(digits) <= 15


def _is_valid_email(val: Any) -> bool:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return True
    s = str(val).strip()
    if not s:
        return True
    return bool(EMAIL_REGEX.match(s))


def infer_semantic_roles(df: pd.DataFrame) -> dict[str, str]:
    """
    Infer semantic column roles once from the initial dataset so quality scoring
    uses identical deterministic rules before and after cleaning.
    """
    cols = user_columns(df)
    roles: dict[str, str] = {}
    for col in cols:
        low = col.lower().strip()
        series = df[col]
        non_missing = series[~is_missing_series(series)]
        sample = non_missing.head(300)

        if "email" in low or "e-mail" in low:
            roles[col] = "email"
            continue
        if "phone" in low or "mobile" in low or "tel" in low or "contact" in low:
            roles[col] = "phone"
            continue
        if "date" in low or "dob" in low or "created" in low or "timestamp" in low:
            roles[col] = "date"
            continue
        if low in {"age", "customer_age", "user_age"} or low.endswith(" age"):
            roles[col] = "age"
            continue
        if any(k in low for k in ["amount", "price", "cost", "revenue", "salary", "total", "balance"]):
            roles[col] = "positive_numeric"
            continue
        if low.endswith("id") or low == "id" or "customer_id" in low or "customer id" in low:
            roles[col] = "identifier"
            continue

        if len(sample) > 0:
            # Check email ratio
            email_hits = sum(1 for v in sample if EMAIL_REGEX.match(str(v).strip()))
            if email_hits / len(sample) >= 0.4:
                roles[col] = "email"
                continue

            # Check numeric ratio
            num = _to_numeric_clean(sample)
            if num.notna().mean() >= 0.65:
                roles[col] = "numeric"
                continue

            # Check date ratio
            date_hits = sum(1 for v in sample if _looks_like_date_str(str(v)))
            if date_hits / len(sample) >= 0.5:
                roles[col] = "date"
                continue

            uniq_ratio = sample.astype(str).str.strip().str.lower().nunique() / max(len(sample), 1)
            if uniq_ratio <= 0.35 or sample.nunique() <= 25:
                roles[col] = "categorical"
            else:
                roles[col] = "text"
        else:
            roles[col] = "unknown"

    return roles


def _classify_score(score: float, settings: dict[str, Any]) -> str:
    if score >= float(settings.get("quality_excellent_min", 90.0)):
        return "Excellent"
    if score >= float(settings.get("quality_good_min", 75.0)):
        return "Good"
    if score >= float(settings.get("quality_fair_min", 50.0)):
        return "Fair"
    return "Poor"


def profile_dataset(
    df: pd.DataFrame,
    semantic_roles: dict[str, str] | None = None,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run comprehensive profiling, issue detection, quality scoring, and smart recommendations."""
    settings = settings or {}
    iqr_mult = float(settings.get("iqr_multiplier", 1.5))
    z_thresh = float(settings.get("zscore_threshold", 3.0))
    outlier_method = str(settings.get("outlier_method", "iqr")).lower()

    cols = user_columns(df)
    total_rows = int(len(df))
    total_cols = int(len(cols))

    if semantic_roles is None or not semantic_roles:
        semantic_roles = infer_semantic_roles(df)

    if total_rows == 0 or total_cols == 0:
        empty_score = {
            "overall_score": 0.0,
            "classification": "Poor",
            "formula": "Overall Score = (Completeness + Uniqueness + Validity + Consistency) / 4",
            "adjusted": True,
            "adjustment_note": "Dataset has 0 rows or 0 columns; dimensions cannot be evaluated.",
            "dimensions": {
                "completeness": {"score": 0.0, "calculable": False, "formula": "(1 - missing_cells / total_cells) * 100", "details": "Empty dataset"},
                "uniqueness": {"score": 0.0, "calculable": False, "formula": "(1 - duplicate_rows / total_rows) * 100", "details": "Empty dataset"},
                "validity": {"score": 0.0, "calculable": False, "formula": "(1 - invalid_cells / checked_cells) * 100", "details": "Empty dataset"},
                "consistency": {"score": 0.0, "calculable": False, "formula": "(1 - inconsistent_cells / applicable_cells) * 100", "details": "Empty dataset"},
            },
        }
        return {
            "summary": {
                "total_rows": total_rows,
                "total_columns": total_cols,
                "missing_values": 0,
                "missing_percentage": 0.0,
                "duplicate_rows": 0,
                "empty_rows": 0,
                "invalid_records": 0,
                "invalid_cells": 0,
                "outliers_detected": 0,
                "whitespace_issues": 0,
                "inconsistent_formats": 0,
                "mixed_type_cells": 0,
                "total_issues": 0,
            },
            "quality": empty_score,
            "columns": [],
            "issue_breakdown": [],
            "recommendations": [],
            "semantic_roles": semantic_roles,
        }

    work = df[cols]

    # Row-level missing / empty / duplicate
    missing_matrix = pd.DataFrame({c: is_missing_series(work[c]) for c in cols}, index=work.index)
    total_missing_cells = int(missing_matrix.values.sum())
    empty_rows_mask = missing_matrix.all(axis=1)
    empty_rows_count = int(empty_rows_mask.sum())

    # Exact duplicate rows across user columns (excluding empty rows from double-counting or counting all duplicates)
    norm_for_dup = work.fillna("__DP_NULL__").astype(str)
    dup_mask = norm_for_dup.duplicated(keep="first")
    duplicate_rows_count = int(dup_mask.sum())

    # Track per-row invalidity and per-issue counts
    invalid_row_mask = pd.Series(False, index=work.index)
    total_invalid_cells = 0
    total_validity_checked_cells = 0

    total_inconsistent_cells = 0
    total_consistency_applicable_cells = 0

    total_outliers = 0
    total_whitespace = 0
    total_inconsistent_formats = 0
    total_mixed_types = 0
    invalid_emails_count = 0
    invalid_phones_count = 0
    invalid_dates_count = 0
    invalid_numeric_domain_count = 0

    column_profiles: list[dict[str, Any]] = []
    recommendations: list[dict[str, Any]] = []

    for col in cols:
        series = work[col]
        role = semantic_roles.get(col, "text")
        miss_mask = missing_matrix[col]
        miss_count = int(miss_mask.sum())
        non_miss = series[~miss_mask]
        non_miss_count = int(len(non_miss))
        miss_pct = round((miss_count / total_rows) * 100.0, 2) if total_rows else 0.0

        str_vals = non_miss.astype(str)
        unique_count = int(str_vals.str.strip().nunique()) if non_miss_count > 0 else 0

        # Whitespace detection
        ws_mask = pd.Series(False, index=work.index)
        if non_miss_count > 0:
            ws_non_miss = str_vals.apply(lambda s: s != s.strip() or ("  " in s))
            ws_mask.loc[non_miss.index] = ws_non_miss
        ws_count = int(ws_mask.sum())
        total_whitespace += ws_count

        col_issues: list[str] = []
        if miss_count > 0:
            col_issues.append(f"{miss_count} missing")
        if ws_count > 0:
            col_issues.append(f"{ws_count} whitespace")

        # Numeric analysis
        is_num_role = role in {"numeric", "positive_numeric", "age"}
        num_series = _to_numeric_clean(non_miss) if non_miss_count > 0 else pd.Series(dtype=float)
        numeric_valid_ratio = float(num_series.notna().mean()) if non_miss_count > 0 else 0.0
        has_numeric_stats = is_num_role or (role not in {"email", "phone", "date", "identifier"} and numeric_valid_ratio >= 0.75)

        mixed_type_count = 0
        if has_numeric_stats and non_miss_count > 0:
            # Strings that fail numeric parsing
            failed_num = num_series.isna()
            mixed_type_count = int(failed_num.sum())
            # Also detect currency-formatted strings like "$45.00" in numeric columns
            currency_formatted = str_vals.str.strip().str.match(r"^[$\u20ac\u00a3\u20b9]")
            mixed_type_count += int((currency_formatted & num_series.notna()).sum())
            if mixed_type_count > 0:
                total_mixed_types += mixed_type_count
                col_issues.append(f"{mixed_type_count} mixed/non-numeric format")

        stats: dict[str, Any] = {
            "mean": None,
            "median": None,
            "min": None,
            "max": None,
            "std": None,
            "q1": None,
            "q3": None,
            "iqr_outliers": 0,
            "zscore_outliers": 0,
        }

        col_outliers = 0
        valid_nums = num_series.dropna()
        if has_numeric_stats and len(valid_nums) > 0:
            q1 = float(valid_nums.quantile(0.25))
            q3 = float(valid_nums.quantile(0.75))
            iqr = q3 - q1
            std_val = float(valid_nums.std(ddof=1)) if len(valid_nums) > 1 else 0.0
            mean_val = float(valid_nums.mean())

            iqr_out = int(((valid_nums < (q1 - iqr_mult * iqr)) | (valid_nums > (q3 + iqr_mult * iqr))).sum()) if iqr > 0 else 0
            z_out = int((((valid_nums - mean_val).abs() / std_val) > z_thresh).sum()) if std_val > 0 else 0

            stats = {
                "mean": round(mean_val, 3),
                "median": round(float(valid_nums.median()), 3),
                "min": round(float(valid_nums.min()), 3),
                "max": round(float(valid_nums.max()), 3),
                "std": round(std_val, 3),
                "q1": round(q1, 3),
                "q3": round(q3, 3),
                "iqr_outliers": iqr_out,
                "zscore_outliers": z_out,
            }
            col_outliers = z_out if outlier_method == "zscore" else iqr_out
            total_outliers += col_outliers
            if col_outliers > 0:
                col_issues.append(f"{col_outliers} outliers")

        # Validity checks per semantic role
        col_invalid_count = 0
        if non_miss_count > 0:
            if role == "email":
                total_validity_checked_cells += non_miss_count
                bad_mask = ~str_vals.apply(_is_valid_email)
                col_invalid_count = int(bad_mask.sum())
                invalid_emails_count += col_invalid_count
                invalid_row_mask.loc[bad_mask[bad_mask].index] = True
                # Case consistency in emails
                total_consistency_applicable_cells += non_miss_count
                incons = ws_non_miss | (str_vals.str.strip() != str_vals.str.strip().str.lower())
                c_incons = int(incons.sum())
                total_inconsistent_cells += c_incons
                total_inconsistent_formats += int((str_vals.str.strip() != str_vals.str.strip().str.lower()).sum())

            elif role == "phone":
                total_validity_checked_cells += non_miss_count
                bad_mask = ~str_vals.apply(_is_valid_phone)
                col_invalid_count = int(bad_mask.sum())
                invalid_phones_count += col_invalid_count
                invalid_row_mask.loc[bad_mask[bad_mask].index] = True
                # Consistency: phone formatting variants vs +1-XXX-XXX-XXXX or standardized E.164/dashed
                valid_phones = str_vals[~bad_mask].str.strip()
                if len(valid_phones) > 0:
                    total_consistency_applicable_cells += len(valid_phones)
                    std_pat = re.compile(r"^\+\d{1,3}-\d{3}-\d{3}-\d{4}$")
                    fmt_bad = ~valid_phones.str.match(std_pat)
                    # Check if mixed formats exist
                    if valid_phones.str.match(std_pat).any() and fmt_bad.any():
                        cnt = int(fmt_bad.sum())
                        total_inconsistent_cells += cnt
                        total_inconsistent_formats += cnt

            elif role == "date":
                total_validity_checked_cells += non_miss_count
                parsed = pd.to_datetime(str_vals.str.strip(), format="mixed", errors="coerce")
                bad_mask = parsed.isna()
                col_invalid_count = int(bad_mask.sum())
                invalid_dates_count += col_invalid_count
                invalid_row_mask.loc[bad_mask[bad_mask].index] = True

                valid_dates = str_vals[~bad_mask].str.strip()
                if len(valid_dates) > 0:
                    total_consistency_applicable_cells += len(valid_dates)
                    labels = valid_dates.apply(_detect_date_format_label)
                    dominant = labels.mode().iloc[0] if len(labels) > 0 else "YYYY-MM-DD"
                    target_fmt = "YYYY-MM-DD" if "YYYY-MM-DD" in labels.values else dominant
                    fmt_mismatch = int((labels != target_fmt).sum())
                    total_inconsistent_cells += fmt_mismatch
                    total_inconsistent_formats += fmt_mismatch
                    if fmt_mismatch > 0:
                        col_issues.append(f"{fmt_mismatch} inconsistent date formats")

            elif role == "age":
                total_validity_checked_cells += non_miss_count
                bad_num = num_series.isna() | (num_series < 1) | (num_series > 120)
                col_invalid_count = int(bad_num.sum())
                invalid_numeric_domain_count += col_invalid_count
                invalid_row_mask.loc[bad_num[bad_num].index] = True
                total_consistency_applicable_cells += non_miss_count
                total_inconsistent_cells += mixed_type_count

            elif role == "positive_numeric":
                total_validity_checked_cells += non_miss_count
                bad_num = num_series.isna() | (num_series < 0)
                col_invalid_count = int(bad_num.sum())
                invalid_numeric_domain_count += col_invalid_count
                invalid_row_mask.loc[bad_num[bad_num].index] = True
                total_consistency_applicable_cells += non_miss_count
                total_inconsistent_cells += mixed_type_count

            elif role == "numeric":
                total_validity_checked_cells += non_miss_count
                bad_num = num_series.isna()
                col_invalid_count = int(bad_num.sum())
                invalid_numeric_domain_count += col_invalid_count
                invalid_row_mask.loc[bad_num[bad_num].index] = True
                total_consistency_applicable_cells += non_miss_count
                total_inconsistent_cells += mixed_type_count

            elif role in {"categorical", "text"}:
                total_consistency_applicable_cells += non_miss_count
                # Check whitespace & capitalization inconsistency
                stripped = str_vals.str.strip()
                incons_count = ws_count
                if role == "categorical":
                    # Find values whose casing differs from Title Case / dominant casing for the same lowercase key
                    groups = stripped.groupby(stripped.str.lower()).transform(lambda s: s.mode().iloc[0] if len(s) > 0 else s)
                    case_diff = int((stripped != groups).sum())
                    # Also flag all-lower or all-upper when mixed casing exists
                    incons_count = max(incons_count, case_diff)
                    total_inconsistent_formats += case_diff
                    if case_diff > 0:
                        col_issues.append(f"{case_diff} casing inconsistencies")
                else:
                    # For names/text, check all-uppercase or all-lowercase anomalies
                    case_anom = int((stripped.str.islower() | stripped.str.isupper()).sum())
                    incons_count = max(incons_count, case_anom)
                    total_inconsistent_formats += case_anom
                    if case_anom > 0:
                        col_issues.append(f"{case_anom} casing inconsistencies")
                total_inconsistent_cells += min(incons_count, non_miss_count)

        total_invalid_cells += col_invalid_count
        if col_invalid_count > 0:
            col_issues.append(f"{col_invalid_count} invalid")

        # Sample values
        samples = [serialize_cell(v) for v in non_miss.head(5).tolist()]
        inferred_dtype = "float64" if has_numeric_stats and mixed_type_count == 0 else (
            "datetime" if role == "date" and col_invalid_count == 0 else "string/mixed" if mixed_type_count > 0 else str(series.dtype)
        )

        column_profiles.append(
            {
                "name": col,
                "dtype": inferred_dtype,
                "raw_dtype": str(series.dtype),
                "semantic_role": role,
                "non_null_count": non_miss_count,
                "missing_count": miss_count,
                "missing_percentage": miss_pct,
                "unique_count": unique_count,
                "whitespace_issues": ws_count,
                "invalid_count": col_invalid_count,
                "mixed_type_count": mixed_type_count,
                "outliers_count": col_outliers,
                "stats": stats,
                "issues": col_issues,
                "sample_values": samples,
            }
        )

    # Quality Score Dimensions
    total_cells = total_rows * total_cols
    completeness_score = round((1.0 - (total_missing_cells / total_cells)) * 100.0, 2) if total_cells > 0 else 0.0
    uniqueness_score = round((1.0 - (duplicate_rows_count / total_rows)) * 100.0, 2) if total_rows > 0 else 0.0

    validity_calculable = total_validity_checked_cells > 0
    validity_score = (
        round(max(0.0, (1.0 - (total_invalid_cells / total_validity_checked_cells)) * 100.0), 2)
        if validity_calculable
        else 0.0
    )

    consistency_calculable = total_consistency_applicable_cells > 0
    consistency_score = (
        round(max(0.0, (1.0 - (total_inconsistent_cells / total_consistency_applicable_cells)) * 100.0), 2)
        if consistency_calculable
        else 0.0
    )

    calculable_scores = [completeness_score, uniqueness_score]
    if validity_calculable:
        calculable_scores.append(validity_score)
    if consistency_calculable:
        calculable_scores.append(consistency_score)

    adjusted = not (validity_calculable and consistency_calculable)
    overall_score = round(sum(calculable_scores) / len(calculable_scores), 2) if calculable_scores else 0.0
    adjustment_note = (
        "All 4 quality dimensions were evaluated using identical deterministic rules."
        if not adjusted
        else "One or more dimensions lacked applicable columns; overall score was computed across calculable dimensions only."
    )

    quality = {
        "overall_score": overall_score,
        "classification": _classify_score(overall_score, settings),
        "formula": "Overall Data Quality Score = (Completeness + Uniqueness + Validity + Consistency) / 4",
        "adjusted": adjusted,
        "adjustment_note": adjustment_note,
        "note": "Structural validity verifies schema, format, and domain rules; it does not prove real-world factual accuracy.",
        "dimensions": {
            "completeness": {
                "score": completeness_score,
                "calculable": True,
                "formula": "(1 - missing_cells / total_cells) * 100",
                "details": f"{total_missing_cells:,} missing cells out of {total_cells:,} total cells",
            },
            "uniqueness": {
                "score": uniqueness_score,
                "calculable": True,
                "formula": "(1 - duplicate_rows / total_rows) * 100",
                "details": f"{duplicate_rows_count:,} duplicate records out of {total_rows:,} rows",
            },
            "validity": {
                "score": validity_score,
                "calculable": validity_calculable,
                "formula": "(1 - invalid_cells / checked_cells) * 100",
                "details": (
                    f"{total_invalid_cells:,} invalid values across {total_validity_checked_cells:,} validated cells"
                    if validity_calculable
                    else "No domain-typed columns (email/phone/date/numeric) available to evaluate"
                ),
            },
            "consistency": {
                "score": consistency_score,
                "calculable": consistency_calculable,
                "formula": "(1 - inconsistent_cells / applicable_cells) * 100",
                "details": (
                    f"{total_inconsistent_cells:,} formatting/whitespace/casing/type inconsistencies across {total_consistency_applicable_cells:,} cells"
                    if consistency_calculable
                    else "No string, date, or mixed-type columns available to evaluate"
                ),
            },
        },
    }

    # Issue breakdown for charts
    issue_breakdown = [
        {"name": "Missing Values", "count": total_missing_cells, "color": "#F59E0B"},
        {"name": "Duplicate Records", "count": duplicate_rows_count, "color": "#EF4444"},
        {"name": "Invalid Values", "count": total_invalid_cells, "color": "#8B5CF6"},
        {"name": "Format & Casing", "count": total_inconsistent_formats, "color": "#06B6D4"},
        {"name": "Whitespace Issues", "count": total_whitespace, "color": "#4F46E5"},
        {"name": "Numerical Outliers", "count": total_outliers, "color": "#EC4899"},
    ]

    # Smart Cleaning Recommendations
    if empty_rows_count > 0:
        recommendations.append({
            "id": "rec_empty_rows",
            "severity": "high",
            "title": f"{empty_rows_count} completely empty rows detected",
            "description": "Rows containing no values across any column should be removed before analysis.",
            "affected_columns": cols,
            "affected_records": empty_rows_count,
            "recommended_action": "Remove Empty Rows",
            "operation": {"op_type": "remove_empty_rows", "columns": [], "params": {}},
        })

    if duplicate_rows_count > 0:
        recommendations.append({
            "id": "rec_duplicates",
            "severity": "high",
            "title": f"{duplicate_rows_count} duplicate records detected — review and remove duplicates",
            "description": "Exact duplicate entries skew aggregations and inflate record counts.",
            "affected_columns": cols,
            "affected_records": duplicate_rows_count,
            "recommended_action": "Remove Duplicate Rows (keep first)",
            "operation": {"op_type": "remove_duplicates", "columns": [], "params": {"keep": "first"}},
        })

    ws_cols = [c["name"] for c in column_profiles if c["whitespace_issues"] > 0]
    if ws_cols:
        recommendations.append({
            "id": "rec_whitespace",
            "severity": "medium",
            "title": "Extra leading/trailing or repeated whitespace detected",
            "description": "Trim whitespace and collapse double spaces to prevent false distinct categories.",
            "affected_columns": ws_cols,
            "affected_records": total_whitespace,
            "recommended_action": "Trim & Normalize Whitespace",
            "operation": {"op_type": "trim_whitespace", "columns": ws_cols, "params": {}},
        })

    mixed_cols = [c["name"] for c in column_profiles if c["mixed_type_count"] > 0]
    if mixed_cols:
        recommendations.append({
            "id": "rec_mixed_types",
            "severity": "high",
            "title": "Mixed data types or currency symbols in numeric columns",
            "description": "Strip currency symbols and convert numeric columns cleanly to float/integer types.",
            "affected_columns": mixed_cols,
            "affected_records": total_mixed_types,
            "recommended_action": "Convert to Numeric Type",
            "operation": {"op_type": "convert_dtype", "columns": mixed_cols, "params": {"target_type": "numeric"}},
        })

    date_cols = [c["name"] for c in column_profiles if c["semantic_role"] == "date" and (c["invalid_count"] > 0 or any("date" in iss for iss in c["issues"]))]
    if date_cols:
        recommendations.append({
            "id": "rec_dates",
            "severity": "medium",
            "title": "Inconsistent date formats — standardize to YYYY-MM-DD",
            "description": "Multiple date conventions (MM/DD/YYYY, DD-MMM-YYYY, etc.) were found.",
            "affected_columns": date_cols,
            "affected_records": total_inconsistent_formats + invalid_dates_count,
            "recommended_action": "Standardize Dates to YYYY-MM-DD",
            "operation": {"op_type": "standardize_dates", "columns": date_cols, "params": {"format": "%Y-%m-%d"}},
        })

    email_cols = [c["name"] for c in column_profiles if c["semantic_role"] == "email" and (c["invalid_count"] > 0 or c["whitespace_issues"] > 0)]
    if email_cols:
        recommendations.append({
            "id": "rec_emails",
            "severity": "medium",
            "title": "Invalid or unnormalized email addresses detected",
            "description": "Lowercase valid emails, trim spaces, and flag malformed addresses as null for review.",
            "affected_columns": email_cols,
            "affected_records": invalid_emails_count,
            "recommended_action": "Normalize & Flag Invalid Emails",
            "operation": {"op_type": "normalize_emails", "columns": email_cols, "params": {"flag_invalid_as_null": True}},
        })

    phone_cols = [c["name"] for c in column_profiles if c["semantic_role"] == "phone"]
    if phone_cols and (invalid_phones_count > 0 or total_inconsistent_formats > 0):
        recommendations.append({
            "id": "rec_phones",
            "severity": "medium",
            "title": "Inconsistent or invalid phone number formats",
            "description": "Standardize 10/11-digit numbers to +1-XXX-XXX-XXXX and flag invalid entries.",
            "affected_columns": phone_cols,
            "affected_records": invalid_phones_count,
            "recommended_action": "Normalize Phone Numbers",
            "operation": {"op_type": "normalize_phones", "columns": phone_cols, "params": {"flag_invalid_as_null": True}},
        })

    case_cols = [c["name"] for c in column_profiles if c["semantic_role"] in {"categorical", "text"} and any("casing" in iss for iss in c["issues"])]
    if case_cols:
        recommendations.append({
            "id": "rec_casing",
            "severity": "low",
            "title": "Inconsistent capitalization across text & categorical columns",
            "description": "Standardize casing to Title Case so categories aggregate accurately.",
            "affected_columns": case_cols,
            "affected_records": sum(1 for _ in case_cols),
            "recommended_action": "Standardize to Title Case",
            "operation": {"op_type": "standardize_case", "columns": case_cols, "params": {"case_style": "title"}},
        })

    age_pos_cols = [c["name"] for c in column_profiles if c["semantic_role"] in {"age", "positive_numeric"} and c["invalid_count"] > 0]
    if age_pos_cols:
        recommendations.append({
            "id": "rec_domain_invalid",
            "severity": "high",
            "title": "Out-of-range invalid domain values (negative amounts or impossible ages)",
            "description": "Replace impossible values (Age < 1 or > 120, Amount < 0) with null before imputation.",
            "affected_columns": age_pos_cols,
            "affected_records": invalid_numeric_domain_count,
            "recommended_action": "Nullify Out-of-Range Values",
            "operation": {"op_type": "replace_invalid", "columns": age_pos_cols, "params": {"action": "nullify"}},
        })

    num_miss_cols = [c["name"] for c in column_profiles if c["missing_count"] > 0 and c["semantic_role"] in {"numeric", "positive_numeric", "age"}]
    if num_miss_cols:
        recommendations.append({
            "id": "rec_num_impute",
            "severity": "medium",
            "title": "Missing numerical values — consider median imputation",
            "description": "Median imputation preserves distribution robustness even when outliers exist.",
            "affected_columns": num_miss_cols,
            "affected_records": sum(c["missing_count"] for c in column_profiles if c["name"] in num_miss_cols),
            "recommended_action": "Impute Missing Numbers (Median)",
            "operation": {"op_type": "impute_missing", "columns": num_miss_cols, "params": {"strategy": "median"}},
        })

    cat_miss_cols = [c["name"] for c in column_profiles if c["missing_count"] > 0 and c["semantic_role"] in {"categorical"}]
    if cat_miss_cols:
        recommendations.append({
            "id": "rec_cat_impute",
            "severity": "low",
            "title": "Missing categorical values — consider mode imputation",
            "description": "Fill missing category labels using the most frequent observed category.",
            "affected_columns": cat_miss_cols,
            "affected_records": sum(c["missing_count"] for c in column_profiles if c["name"] in cat_miss_cols),
            "recommended_action": "Impute Missing Categories (Mode)",
            "operation": {"op_type": "impute_missing", "columns": cat_miss_cols, "params": {"strategy": "mode"}},
        })

    out_cols = [c["name"] for c in column_profiles if c["outliers_count"] > 0]
    if out_cols:
        recommendations.append({
            "id": "rec_outliers",
            "severity": "medium",
            "title": f"{total_outliers} numerical outliers detected — inspect before capping or removing",
            "description": "Cap extreme values at IQR fences (Winsorization) to preserve records while reducing skew.",
            "affected_columns": out_cols,
            "affected_records": total_outliers,
            "recommended_action": "Cap Outliers at IQR Bounds",
            "operation": {"op_type": "handle_outliers", "columns": out_cols, "params": {"method": outlier_method, "action": "cap"}},
        })

    total_issues = (
        total_missing_cells
        + duplicate_rows_count
        + total_invalid_cells
        + total_whitespace
        + total_inconsistent_formats
        + total_outliers
    )

    return {
        "summary": {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "missing_values": total_missing_cells,
            "missing_percentage": round((total_missing_cells / total_cells) * 100.0, 2) if total_cells else 0.0,
            "duplicate_rows": duplicate_rows_count,
            "empty_rows": empty_rows_count,
            "invalid_records": int(invalid_row_mask.sum()),
            "invalid_cells": total_invalid_cells,
            "invalid_emails": invalid_emails_count,
            "invalid_phones": invalid_phones_count,
            "invalid_dates": invalid_dates_count,
            "outliers_detected": total_outliers,
            "whitespace_issues": total_whitespace,
            "inconsistent_formats": total_inconsistent_formats,
            "mixed_type_cells": total_mixed_types,
            "total_issues": total_issues,
        },
        "quality": quality,
        "columns": column_profiles,
        "issue_breakdown": issue_breakdown,
        "recommendations": recommendations,
        "semantic_roles": semantic_roles,
    }
