"""Structural validation engine powered by Pandera + custom domain rules."""

from __future__ import annotations

import re
from typing import Any
import pandas as pd
import pandera.pandas as pa

from .profiler import EMAIL_REGEX, _is_valid_email, _is_valid_phone, _to_numeric_clean, is_missing_series
from .storage import ROW_ID_COL, serialize_cell, user_columns


def generate_default_rules(df: pd.DataFrame, semantic_roles: dict[str, str]) -> list[dict[str, Any]]:
    """Create sensible structural validation rules inferred from dataset schema & roles."""
    rules: list[dict[str, Any]] = []
    cols = user_columns(df)

    for col in cols:
        role = semantic_roles.get(col, "text")
        rules.append({
            "name": f"Required Column: {col}",
            "column_name": col,
            "rule_type": "required_column",
            "params": {},
            "severity": "error",
            "enabled": True,
        })

        if role == "identifier":
            rules.append({
                "name": f"Unique Identifier: {col}",
                "column_name": col,
                "rule_type": "unique",
                "params": {},
                "severity": "error",
                "enabled": True,
            })
            rules.append({
                "name": f"Mandatory Field: {col}",
                "column_name": col,
                "rule_type": "not_null",
                "params": {},
                "severity": "error",
                "enabled": True,
            })
        elif role == "email":
            rules.append({
                "name": f"Valid Email Format: {col}",
                "column_name": col,
                "rule_type": "email",
                "params": {},
                "severity": "error",
                "enabled": True,
            })
        elif role == "phone":
            rules.append({
                "name": f"Valid Phone Number: {col}",
                "column_name": col,
                "rule_type": "phone",
                "params": {},
                "severity": "warning",
                "enabled": True,
            })
        elif role == "date":
            rules.append({
                "name": f"Valid Date Format: {col}",
                "column_name": col,
                "rule_type": "date",
                "params": {},
                "severity": "error",
                "enabled": True,
            })
        elif role == "age":
            rules.append({
                "name": f"Numeric Type Check: {col}",
                "column_name": col,
                "rule_type": "dtype",
                "params": {"expected_type": "numeric"},
                "severity": "error",
                "enabled": True,
            })
            rules.append({
                "name": f"Valid Age Range (1-120): {col}",
                "column_name": col,
                "rule_type": "min_max",
                "params": {"min": 1, "max": 120},
                "severity": "error",
                "enabled": True,
            })
        elif role == "positive_numeric":
            rules.append({
                "name": f"Numeric Type Check: {col}",
                "column_name": col,
                "rule_type": "dtype",
                "params": {"expected_type": "numeric"},
                "severity": "error",
                "enabled": True,
            })
            rules.append({
                "name": f"Non-Negative Amount: {col}",
                "column_name": col,
                "rule_type": "min_max",
                "params": {"min": 0},
                "severity": "error",
                "enabled": True,
            })
        elif role == "numeric":
            rules.append({
                "name": f"Numeric Type Check: {col}",
                "column_name": col,
                "rule_type": "dtype",
                "params": {"expected_type": "numeric"},
                "severity": "error",
                "enabled": True,
            })

    return rules


def _pandera_check_column(df: pd.DataFrame, col: str, expected_type: str) -> tuple[bool, list[int], str]:
    """Use Pandera DataFrameSchema for core structural dtype verification."""
    try:
        if expected_type == "numeric":
            num_df = pd.DataFrame({col: pd.to_numeric(df[col], errors="coerce")})
            schema = pa.DataFrameSchema({col: pa.Column(float, nullable=True, coerce=True)})
            schema.validate(num_df)
            # Flag rows where original was non-missing but numeric conversion failed
            miss = is_missing_series(df[col])
            bad_mask = (~miss) & num_df[col].isna()
            bad_rows = [int(r) for r in df.loc[bad_mask, ROW_ID_COL].tolist()] if ROW_ID_COL in df.columns else [int(i) for i in df.index[bad_mask]]
            return len(bad_rows) == 0, bad_rows, "Non-numeric values found where numeric type is required"
        elif expected_type == "string":
            schema = pa.DataFrameSchema({col: pa.Column(str, nullable=True, coerce=True)})
            schema.validate(df[[col]])
            return True, [], ""
        elif expected_type == "datetime":
            parsed = pd.to_datetime(df[col], format="mixed", errors="coerce")
            miss = is_missing_series(df[col])
            bad_mask = (~miss) & parsed.isna()
            bad_rows = [int(r) for r in df.loc[bad_mask, ROW_ID_COL].tolist()] if ROW_ID_COL in df.columns else [int(i) for i in df.index[bad_mask]]
            return len(bad_rows) == 0, bad_rows, "Unparseable datetime values found"
    except pa.errors.SchemaError as exc:
        return False, [], str(exc)
    return True, [], ""


def run_validation(df: pd.DataFrame, rules: list[dict[str, Any]]) -> dict[str, Any]:
    """Execute all enabled validation rules and return detailed results + row-level errors."""
    cols = user_columns(df)
    has_row_id = ROW_ID_COL in df.columns

    results: list[dict[str, Any]] = []
    passed_count = 0
    failed_count = 0
    warning_count = 0
    row_errors: list[dict[str, Any]] = []

    def row_ids_for(mask: pd.Series) -> list[int]:
        if has_row_id:
            return [int(x) for x in df.loc[mask, ROW_ID_COL].tolist()]
        return [int(i) for i in df.index[mask].tolist()]

    for rule in rules:
        if not rule.get("enabled", True):
            continue

        rtype = rule["rule_type"]
        col = rule.get("column_name")
        params = rule.get("params") or {}
        severity = rule.get("severity", "error")

        status = "passed"
        failing_rids: list[int] = []
        message = "Validation passed"
        suggestion = ""

        if rtype == "required_column":
            if not col or col not in cols:
                status = "failed" if severity == "error" else "warning"
                message = f"Required column '{col}' is missing from dataset."
                suggestion = f"Add or rename a column to '{col}' before downstream processing."
            else:
                message = f"Column '{col}' is present."

        elif not col or col not in cols:
            status = "failed" if severity == "error" else "warning"
            message = f"Target column '{col}' not found in dataset."
            suggestion = "Update the rule target column or restore the missing column."

        elif rtype == "dtype":
            expected = str(params.get("expected_type", "numeric")).lower()
            ok, bad_rids, err_msg = _pandera_check_column(df, col, expected)
            if not ok:
                failing_rids = bad_rids
                status = "failed" if severity == "error" else "warning"
                message = f"{err_msg} ({len(bad_rids)} row(s))."
                suggestion = f"Run 'Convert Data Type ({expected})' on '{col}' in Data Cleaning."

        elif rtype == "not_null":
            miss = is_missing_series(df[col])
            failing_rids = row_ids_for(miss)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} missing/null value(s) in mandatory field '{col}'."
                suggestion = f"Impute missing values or filter incomplete rows for '{col}'."

        elif rtype == "unique":
            miss = is_missing_series(df[col])
            non_miss = df.loc[~miss, col].astype(str).str.strip()
            dup_non_miss = non_miss.duplicated(keep=False)
            dup_mask = pd.Series(False, index=df.index)
            dup_mask.loc[non_miss.index] = dup_non_miss
            failing_rids = row_ids_for(dup_mask)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} row(s) share duplicate values in unique column '{col}'."
                suggestion = "Review and remove duplicate records in Data Cleaning."

        elif rtype == "min_max":
            miss = is_missing_series(df[col])
            num = _to_numeric_clean(df[col])
            bad = pd.Series(False, index=df.index)
            bad |= (~miss) & num.isna()
            if params.get("min") is not None:
                bad |= (~miss) & num.notna() & (num < float(params["min"]))
            if params.get("max") is not None:
                bad |= (~miss) & num.notna() & (num > float(params["max"]))
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                bounds = f"[{params.get('min', '-inf')}, {params.get('max', '+inf')}]"
                message = f"{len(failing_rids)} value(s) in '{col}' fall outside range {bounds}."
                suggestion = f"Use 'Replace Invalid Values' or 'Handle Outliers' on '{col}'."

        elif rtype == "email":
            miss = is_missing_series(df[col])
            bad = (~miss) & (~df[col].apply(_is_valid_email))
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} invalid email format(s) in '{col}'."
                suggestion = f"Run 'Normalize Emails' on '{col}' to trim/lowercase and flag invalid records."

        elif rtype == "phone":
            miss = is_missing_series(df[col])
            bad = (~miss) & (~df[col].apply(_is_valid_phone))
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} invalid phone number(s) in '{col}'."
                suggestion = f"Run 'Normalize Phone Numbers' on '{col}'."

        elif rtype == "date":
            miss = is_missing_series(df[col])
            parsed = pd.to_datetime(df[col].astype(str).str.strip(), format="mixed", errors="coerce")
            bad = (~miss) & parsed.isna()
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} unparseable date(s) in '{col}'."
                suggestion = f"Run 'Standardize Dates' on '{col}'."

        elif rtype == "regex":
            pattern = str(params.get("pattern", ".*"))
            try:
                compiled = re.compile(pattern)
                miss = is_missing_series(df[col])
                bad = (~miss) & (~df[col].astype(str).str.strip().apply(lambda s: bool(compiled.match(s))))
                failing_rids = row_ids_for(bad)
                if failing_rids:
                    status = "failed" if severity == "error" else "warning"
                    message = f"{len(failing_rids)} value(s) in '{col}' failed regex '{pattern}'."
                    suggestion = f"Inspect and clean non-matching values in '{col}'."
            except re.error as exc:
                status = "failed"
                message = f"Invalid regular expression: {exc}"
                suggestion = "Fix the regex pattern in rule settings."

        elif rtype == "allowed_values":
            allowed = [str(v).strip() for v in params.get("values", [])]
            case_sensitive = bool(params.get("case_sensitive", False))
            miss = is_missing_series(df[col])
            vals = df[col].astype(str).str.strip()
            if not case_sensitive:
                allowed_cmp = {a.lower() for a in allowed}
                bad = (~miss) & (~vals.str.lower().isin(allowed_cmp))
            else:
                allowed_cmp = set(allowed)
                bad = (~miss) & (~vals.isin(allowed_cmp))
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} value(s) in '{col}' not in allowed set {allowed[:6]}."
                suggestion = f"Standardize casing or map invalid categories in '{col}'."

        elif rtype == "custom_expression":
            # Safe pandas query / comparison: supports e.g. "min_length", "max_length", "no_whitespace"
            check_mode = str(params.get("mode", "no_whitespace"))
            miss = is_missing_series(df[col])
            s = df[col].astype(str)
            if check_mode == "min_length":
                min_len = int(params.get("length", 1))
                bad = (~miss) & (s.str.strip().str.len() < min_len)
            elif check_mode == "max_length":
                max_len = int(params.get("length", 255))
                bad = (~miss) & (s.str.strip().str.len() > max_len)
            else:
                bad = (~miss) & (s != s.str.strip())
            failing_rids = row_ids_for(bad)
            if failing_rids:
                status = "failed" if severity == "error" else "warning"
                message = f"{len(failing_rids)} value(s) failed custom check '{check_mode}'."
                suggestion = f"Clean '{col}' values matching '{check_mode}'."

        if status == "passed":
            passed_count += 1
        elif status == "warning":
            warning_count += 1
        else:
            failed_count += 1

        # Sample up to 25 failing row details for this rule
        sample_rows = []
        if failing_rids and col in cols:
            idx_df = df.set_index(ROW_ID_COL) if has_row_id else df
            for rid in failing_rids[:25]:
                val = serialize_cell(idx_df.loc[rid, col]) if rid in idx_df.index else None
                sample_rows.append({"row_id": rid, "column": col, "value": val})
                if len(row_errors) < 250:
                    row_errors.append({
                        "row_id": rid,
                        "rule_name": rule["name"],
                        "column": col,
                        "severity": severity,
                        "value": val,
                        "message": message,
                    })

        results.append({
            "rule_id": rule.get("id"),
            "name": rule["name"],
            "column_name": col,
            "rule_type": rtype,
            "severity": severity,
            "status": status,
            "failing_count": len(failing_rids),
            "message": message,
            "suggestion": suggestion,
            "sample_failures": sample_rows,
        })

    return {
        "summary": {
            "total_rules": len(results),
            "passed": passed_count,
            "failed": failed_count,
            "warnings": warning_count,
            "pass_rate": round((passed_count / len(results)) * 100.0, 2) if results else 100.0,
        },
        "results": results,
        "row_errors": row_errors,
    }
