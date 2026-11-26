"""FastAPI application and all REST API endpoints for DataPure."""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
import pandas as pd

from .config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, ensure_directories
from .database import get_db, get_settings, init_db, utc_now_iso
from .models import (
    CleaningOperation,
    CleaningRequest,
    SettingsUpdate,
    ValidationRuleCreate,
    ValidationRuleUpdate,
)
from .sample_data import generate_synthetic_customer_dataset
from .services.cleaner import (
    apply_operations,
    build_auto_cleaning_plan,
    is_operation_destructive,
    preview_cleaning,
)
from .services.comparator import compare_versions
from .services.exporter import (
    build_pdf_report,
    export_csv_bytes,
    export_excel_bytes,
    export_json_bytes,
)
from .services.profiler import infer_semantic_roles, profile_dataset
from .services.storage import (
    ROW_ID_COL,
    attach_row_ids,
    dataset_dir,
    inspect_excel_sheets,
    load_df_version,
    parse_uploaded_bytes,
    save_df_version,
    serialize_cell,
    user_columns,
)
from .services.validator import generate_default_rules, run_validation
from .services.visualizer import build_visualizations

@asynccontextmanager
async def lifespan(application: FastAPI):  # noqa: ARG001
    ensure_directories()
    init_db()
    yield


app = FastAPI(
    title="DataPure API",
    description="Intelligent Data Cleaning & Structural Validation Backend",
    version="1.0.0",
    lifespan=lifespan,
)

import os

# ---------------------------------------------------------------------------
# CORS — allow the Render-deployed frontend URL + localhost for local dev
# Set ALLOWED_ORIGINS env var on Render to your frontend URL, e.g.:
#   https://datapure.onrender.com
# ---------------------------------------------------------------------------
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




def _get_dataset_row(conn, dataset_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    d = dict(row)
    d["semantic_roles"] = json.loads(d.pop("semantic_roles_json") or "{}")
    d["initial_quality"] = json.loads(d.pop("initial_quality_json") or "{}")
    d["current_quality"] = json.loads(d.pop("current_quality_json") or "{}")
    return d


def _create_dataset_record(
    conn,
    name: str,
    original_filename: str,
    file_format: str,
    file_size_bytes: int,
    df: pd.DataFrame,
    sheet_name: str | None = None,
    is_synthetic: bool = False,
) -> dict[str, Any]:
    dataset_id = str(uuid.uuid4())[:12]
    df_with_ids = attach_row_ids(df)
    settings = get_settings(conn)
    semantic_roles = infer_semantic_roles(df_with_ids)
    prof = profile_dataset(df_with_ids, semantic_roles=semantic_roles, settings=settings)

    now = utc_now_iso()
    v0_path = save_df_version(dataset_id, 0, df_with_ids)

    conn.execute(
        """
        INSERT INTO datasets (
            id, name, original_filename, file_format, file_size_bytes, sheet_name,
            is_synthetic, created_at, updated_at, current_version, max_version,
            row_count, column_count, semantic_roles_json, initial_quality_json, current_quality_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
        """,
        (
            dataset_id,
            name,
            original_filename,
            file_format,
            file_size_bytes,
            sheet_name,
            1 if is_synthetic else 0,
            now,
            now,
            int(len(df_with_ids)),
            int(len(user_columns(df_with_ids))),
            json.dumps(semantic_roles),
            json.dumps(prof["quality"]),
            json.dumps(prof["quality"]),
        ),
    )

    conn.execute(
        """
        INSERT INTO dataset_versions (
            dataset_id, version_number, file_path, row_count, column_count,
            quality_score, quality_json, description, created_at
        ) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            dataset_id,
            v0_path,
            int(len(df_with_ids)),
            int(len(user_columns(df_with_ids))),
            float(prof["quality"]["overall_score"]),
            json.dumps(prof["quality"]),
            "Original Raw Upload (Immutable Backup)" if not is_synthetic else "Synthetic Customer Sample (Raw v0)",
            now,
        ),
    )

    conn.execute(
        """
        INSERT INTO audit_logs (
            dataset_id, version_from, version_to, action_type, summary,
            details_json, modified_cells_count, removed_rows_count, created_at
        ) VALUES (?, NULL, 0, ?, ?, ?, 0, 0, ?)
        """,
        (
            dataset_id,
            "DATASET_LOADED",
            f"Ingested '{original_filename}' ({len(df_with_ids):,} rows, {len(user_columns(df_with_ids))} columns)",
            json.dumps({"is_synthetic": is_synthetic, "sheet_name": sheet_name}),
            now,
        ),
    )

    # Seed inferred validation rules
    default_rules = generate_default_rules(df_with_ids, semantic_roles)
    for r in default_rules:
        conn.execute(
            """
            INSERT INTO validation_rules (
                dataset_id, name, column_name, rule_type, params_json, severity, enabled, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                r["name"],
                r["column_name"],
                r["rule_type"],
                json.dumps(r["params"]),
                r["severity"],
                1 if r["enabled"] else 0,
                now,
            ),
        )

    return _get_dataset_row(conn, dataset_id)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "DataPure API"}


@app.get("/api/datasets")
def list_datasets() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM datasets ORDER BY updated_at DESC").fetchall()
        out = []
        for row in rows:
            d = dict(row)
            d["semantic_roles"] = json.loads(d.pop("semantic_roles_json") or "{}")
            d["initial_quality"] = json.loads(d.pop("initial_quality_json") or "{}")
            d["current_quality"] = json.loads(d.pop("current_quality_json") or "{}")
            out.append(d)
        return out


@app.post("/api/datasets/inspect-sheets")
async def inspect_sheets(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or "upload.xlsx"
    ext = Path(filename).suffix.lower()
    if ext not in {".xlsx", ".xls"}:
        return {"sheets": []}
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB size limit.")
    try:
        sheets = inspect_excel_sheets(content)
        return {"sheets": sheets}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel sheets: {exc}") from exc


@app.post("/api/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    sheet_name: str | None = Form(None),
) -> dict[str, Any]:
    filename = file.filename or "dataset.csv"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: CSV, Excel (.xlsx/.xls), JSON.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds maximum allowed size of 50 MB.")

    try:
        df = parse_uploaded_bytes(content, filename, sheet_name=sheet_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file '{filename}': {exc}") from exc

    if len(user_columns(df)) == 0:
        raise HTTPException(status_code=400, detail="Uploaded dataset contains no columns.")

    display_name = (name or Path(filename).stem).strip() or "Uploaded Dataset"
    with get_db() as conn:
        meta = _create_dataset_record(
            conn=conn,
            name=display_name,
            original_filename=filename,
            file_format=ext.lstrip(".").upper(),
            file_size_bytes=len(content),
            df=df,
            sheet_name=sheet_name,
            is_synthetic=False,
        )
    return {"dataset": meta}


@app.post("/api/datasets/sample")
def load_sample_dataset() -> dict[str, Any]:
    """Generate and load the reproducible 5,000-row synthetic customer dataset."""
    df = generate_synthetic_customer_dataset(n_total=5000, seed=42)
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    with get_db() as conn:
        meta = _create_dataset_record(
            conn=conn,
            name="Synthetic Customer Retail Dataset (5,000 rows)",
            original_filename="synthetic_customers_5000.csv",
            file_format="CSV",
            file_size_bytes=len(csv_bytes),
            df=df,
            sheet_name=None,
            is_synthetic=True,
        )
    return {"dataset": meta}


@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        versions = conn.execute(
            "SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version_number ASC",
            (dataset_id,),
        ).fetchall()
        v_list = []
        for v in versions:
            vd = dict(v)
            vd["quality"] = json.loads(vd.pop("quality_json") or "{}")
            v_list.append(vd)
        df = load_df_version(dataset_id, meta["current_version"])
        cols = user_columns(df)
        return {"dataset": meta, "versions": v_list, "columns": cols}


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str) -> dict[str, str]:
    with get_db() as conn:
        _get_dataset_row(conn, dataset_id)
        conn.execute("DELETE FROM datasets WHERE id = ?", (dataset_id,))
    d_path = dataset_dir(dataset_id)
    if d_path.exists():
        shutil.rmtree(d_path, ignore_errors=True)
    return {"status": "deleted", "dataset_id": dataset_id}


@app.get("/api/datasets/{dataset_id}/rows")
def get_dataset_rows(
    dataset_id: str,
    version: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str = "",
    sort_by: str | None = None,
    sort_dir: str = "asc",
    filter_col: str | None = None,
    filter_val: str | None = None,
) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        ver = meta["current_version"] if version is None else version

    df = load_df_version(dataset_id, ver)
    cols = user_columns(df)
    work = df.copy()

    if filter_col and filter_col in cols and filter_val is not None and filter_val != "":
        if filter_val == "__MISSING__":
            work = work[work[filter_col].isna() | (work[filter_col].astype(str).str.strip() == "")]
        else:
            work = work[work[filter_col].astype(str).str.strip().str.lower() == filter_val.strip().lower()]

    if search.strip():
        q = search.strip().lower()
        mask = work[cols].fillna("").astype(str).apply(lambda col: col.str.lower().str.contains(q, regex=False)).any(axis=1)
        work = work[mask]

    if sort_by and sort_by in cols:
        asc = sort_dir.lower() != "desc"
        try:
            work = work.sort_values(by=sort_by, ascending=asc, key=lambda s: s.fillna("").astype(str), kind="mergesort")
        except Exception:
            pass

    total = len(work)
    start = (page - 1) * page_size
    slice_df = work.iloc[start : start + page_size]

    rows = []
    for _, r in slice_df.iterrows():
        row_obj = {"_row_id": int(r[ROW_ID_COL]) if ROW_ID_COL in slice_df.columns else 0}
        for c in cols:
            row_obj[c] = serialize_cell(r[c])
        rows.append(row_obj)

    return {
        "columns": cols,
        "version": ver,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
        "rows": rows,
    }


@app.get("/api/datasets/{dataset_id}/profile")
def get_profile(dataset_id: str, version: int | None = None) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
        ver = meta["current_version"] if version is None else version
    df = load_df_version(dataset_id, ver)
    prof = profile_dataset(df, semantic_roles=meta["semantic_roles"], settings=settings)
    return {"dataset": meta, "version": ver, **prof}


@app.get("/api/datasets/{dataset_id}/quality")
def get_quality_score(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
    raw_df = load_df_version(dataset_id, 0)
    cur_df = load_df_version(dataset_id, meta["current_version"])
    raw_prof = profile_dataset(raw_df, semantic_roles=meta["semantic_roles"], settings=settings)
    cur_prof = profile_dataset(cur_df, semantic_roles=meta["semantic_roles"], settings=settings)
    return {
        "before": raw_prof["quality"],
        "after": cur_prof["quality"],
        "improvement_points": round(cur_prof["quality"]["overall_score"] - raw_prof["quality"]["overall_score"], 2),
        "remaining_issues": cur_prof["recommendations"],
        "summary_before": raw_prof["summary"],
        "summary_after": cur_prof["summary"],
    }


@app.post("/api/datasets/{dataset_id}/clean/auto-plan")
def get_auto_clean_plan(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
    cur_df = load_df_version(dataset_id, meta["current_version"])
    ops = build_auto_cleaning_plan(cur_df, meta["semantic_roles"], settings)
    preview = preview_cleaning(cur_df, ops, meta["semantic_roles"], settings)
    return {
        "operations": [op.model_dump() for op in ops],
        "preview": preview,
    }


@app.post("/api/datasets/{dataset_id}/clean/preview")
def preview_clean(dataset_id: str, req: CleaningRequest) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
    cur_df = load_df_version(dataset_id, meta["current_version"])
    return preview_cleaning(cur_df, req.operations, meta["semantic_roles"], settings)


@app.post("/api/datasets/{dataset_id}/clean/apply")
def apply_clean(dataset_id: str, req: CleaningRequest) -> dict[str, Any]:
    if not req.operations:
        raise HTTPException(status_code=400, detail="No cleaning operations specified.")

    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
        cur_ver = meta["current_version"]
        cur_df = load_df_version(dataset_id, cur_ver)

        # Safety check for destructive changes
        has_destructive = any(is_operation_destructive(op)[0] for op in req.operations)
        if has_destructive and not req.confirm_destructive:
            raise HTTPException(
                status_code=409,
                detail="Confirmation required before deleting records or applying destructive cleaning operations.",
            )

        preview_stats = preview_cleaning(cur_df, req.operations, meta["semantic_roles"], settings)
        cleaned_df, op_logs = apply_operations(cur_df, req.operations, meta["semantic_roles"], settings)
        after_prof = profile_dataset(cleaned_df, semantic_roles=meta["semantic_roles"], settings=settings)

        # If user previously undid versions, drop future redo branch > cur_ver
        conn.execute(
            "DELETE FROM dataset_versions WHERE dataset_id = ? AND version_number > ?",
            (dataset_id, cur_ver),
        )

        new_ver = cur_ver + 1
        v_path = save_df_version(dataset_id, new_ver, cleaned_df)
        now = utc_now_iso()
        desc = f"{req.mode.title()} clean: " + "; ".join(l["summary"] for l in op_logs[:3])
        if len(op_logs) > 3:
            desc += f" (+{len(op_logs) - 3} more)"

        conn.execute(
            """
            INSERT INTO dataset_versions (
                dataset_id, version_number, file_path, row_count, column_count,
                quality_score, quality_json, description, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                new_ver,
                v_path,
                int(len(cleaned_df)),
                int(len(user_columns(cleaned_df))),
                float(after_prof["quality"]["overall_score"]),
                json.dumps(after_prof["quality"]),
                desc,
                now,
            ),
        )

        conn.execute(
            """
            UPDATE datasets SET
                current_version = ?, max_version = ?, updated_at = ?,
                row_count = ?, column_count = ?, current_quality_json = ?
            WHERE id = ?
            """,
            (
                new_ver,
                new_ver,
                now,
                int(len(cleaned_df)),
                int(len(user_columns(cleaned_df))),
                json.dumps(after_prof["quality"]),
                dataset_id,
            ),
        )

        conn.execute(
            """
            INSERT INTO audit_logs (
                dataset_id, version_from, version_to, action_type, summary,
                details_json, modified_cells_count, removed_rows_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                cur_ver,
                new_ver,
                f"CLEAN_{req.mode.upper()}",
                desc,
                json.dumps({"operations": [op.model_dump() for op in req.operations], "logs": op_logs}),
                int(preview_stats["modified_cells_count"]),
                int(preview_stats["rows_removed"]),
                now,
            ),
        )

        updated_meta = _get_dataset_row(conn, dataset_id)
        return {
            "dataset": updated_meta,
            "version": new_ver,
            "operation_logs": op_logs,
            "modified_cells_count": preview_stats["modified_cells_count"],
            "rows_removed": preview_stats["rows_removed"],
            "profile": after_prof,
        }


def _switch_version(conn, dataset_id: str, target_ver: int, action_type: str, summary: str) -> dict[str, Any]:
    meta = _get_dataset_row(conn, dataset_id)
    v_row = conn.execute(
        "SELECT * FROM dataset_versions WHERE dataset_id = ? AND version_number = ?",
        (dataset_id, target_ver),
    ).fetchone()
    if not v_row:
        raise HTTPException(status_code=400, detail=f"Version v{target_ver} does not exist.")

    now = utc_now_iso()
    conn.execute(
        """
        UPDATE datasets SET
            current_version = ?, updated_at = ?, row_count = ?, column_count = ?, current_quality_json = ?
        WHERE id = ?
        """,
        (
            target_ver,
            now,
            v_row["row_count"],
            v_row["column_count"],
            v_row["quality_json"],
            dataset_id,
        ),
    )
    conn.execute(
        """
        INSERT INTO audit_logs (
            dataset_id, version_from, version_to, action_type, summary,
            details_json, modified_cells_count, removed_rows_count, created_at
        ) VALUES (?, ?, ?, ?, ?, '{}', 0, 0, ?)
        """,
        (dataset_id, meta["current_version"], target_ver, action_type, summary, now),
    )
    return _get_dataset_row(conn, dataset_id)


@app.post("/api/datasets/{dataset_id}/undo")
def undo_clean(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        if meta["current_version"] <= 0:
            raise HTTPException(status_code=400, detail="Already at original raw version (v0). Nothing to undo.")
        target = meta["current_version"] - 1
        updated = _switch_version(conn, dataset_id, target, "UNDO", f"Undid changes from v{meta['current_version']} back to v{target}")
        return {"dataset": updated}


@app.post("/api/datasets/{dataset_id}/redo")
def redo_clean(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        if meta["current_version"] >= meta["max_version"]:
            raise HTTPException(status_code=400, detail="Already at latest version. Nothing to redo.")
        target = meta["current_version"] + 1
        updated = _switch_version(conn, dataset_id, target, "REDO", f"Redid changes from v{meta['current_version']} forward to v{target}")
        return {"dataset": updated}


@app.post("/api/datasets/{dataset_id}/reset")
def reset_to_raw(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        updated = _switch_version(conn, dataset_id, 0, "RESET", f"Reset dataset from v{meta['current_version']} back to raw v0 backup")
        return {"dataset": updated}


@app.post("/api/datasets/{dataset_id}/restore/{version_number}")
def restore_version(dataset_id: str, version_number: int) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        updated = _switch_version(
            conn,
            dataset_id,
            version_number,
            "RESTORE",
            f"Restored version v{version_number} (from v{meta['current_version']})",
        )
        return {"dataset": updated}


@app.get("/api/datasets/{dataset_id}/validation/rules")
def list_validation_rules(dataset_id: str) -> list[dict[str, Any]]:
    with get_db() as conn:
        _get_dataset_row(conn, dataset_id)
        rows = conn.execute(
            "SELECT * FROM validation_rules WHERE dataset_id = ? ORDER BY id ASC",
            (dataset_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["params"] = json.loads(d.pop("params_json") or "{}")
            d["enabled"] = bool(d["enabled"])
            out.append(d)
        return out


@app.post("/api/datasets/{dataset_id}/validation/rules")
def create_validation_rule(dataset_id: str, payload: ValidationRuleCreate) -> dict[str, Any]:
    with get_db() as conn:
        _get_dataset_row(conn, dataset_id)
        now = utc_now_iso()
        cur = conn.execute(
            """
            INSERT INTO validation_rules (
                dataset_id, name, column_name, rule_type, params_json, severity, enabled, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                payload.name,
                payload.column_name,
                payload.rule_type,
                json.dumps(payload.params),
                payload.severity,
                1 if payload.enabled else 0,
                now,
            ),
        )
        row = conn.execute("SELECT * FROM validation_rules WHERE id = ?", (cur.lastrowid,)).fetchone()
        d = dict(row)
        d["params"] = json.loads(d.pop("params_json") or "{}")
        d["enabled"] = bool(d["enabled"])
        return d


@app.patch("/api/datasets/{dataset_id}/validation/rules/{rule_id}")
def update_validation_rule(dataset_id: str, rule_id: int, payload: ValidationRuleUpdate) -> dict[str, Any]:
    with get_db() as conn:
        _get_dataset_row(conn, dataset_id)
        row = conn.execute(
            "SELECT * FROM validation_rules WHERE id = ? AND dataset_id = ?",
            (rule_id, dataset_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Validation rule not found.")

        existing = dict(row)
        name = payload.name if payload.name is not None else existing["name"]
        col = payload.column_name if payload.column_name is not None else existing["column_name"]
        rtype = payload.rule_type if payload.rule_type is not None else existing["rule_type"]
        params = json.dumps(payload.params) if payload.params is not None else existing["params_json"]
        severity = payload.severity if payload.severity is not None else existing["severity"]
        enabled = (1 if payload.enabled else 0) if payload.enabled is not None else existing["enabled"]

        conn.execute(
            """
            UPDATE validation_rules SET name = ?, column_name = ?, rule_type = ?,
                params_json = ?, severity = ?, enabled = ?
            WHERE id = ? AND dataset_id = ?
            """,
            (name, col, rtype, params, severity, enabled, rule_id, dataset_id),
        )
        updated = conn.execute("SELECT * FROM validation_rules WHERE id = ?", (rule_id,)).fetchone()
        d = dict(updated)
        d["params"] = json.loads(d.pop("params_json") or "{}")
        d["enabled"] = bool(d["enabled"])
        return d


@app.delete("/api/datasets/{dataset_id}/validation/rules/{rule_id}")
def delete_validation_rule(dataset_id: str, rule_id: int) -> dict[str, str]:
    with get_db() as conn:
        _get_dataset_row(conn, dataset_id)
        conn.execute("DELETE FROM validation_rules WHERE id = ? AND dataset_id = ?", (rule_id, dataset_id))
        return {"status": "deleted"}


@app.post("/api/datasets/{dataset_id}/validation/run")
def execute_validation(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        rules_rows = conn.execute(
            "SELECT * FROM validation_rules WHERE dataset_id = ? ORDER BY id ASC",
            (dataset_id,),
        ).fetchall()
        rules = []
        for r in rules_rows:
            d = dict(r)
            d["params"] = json.loads(d.pop("params_json") or "{}")
            d["enabled"] = bool(d["enabled"])
            rules.append(d)

        cur_df = load_df_version(dataset_id, meta["current_version"])
        res = run_validation(cur_df, rules)
        now = utc_now_iso()
        conn.execute(
            """
            INSERT INTO validation_runs (
                dataset_id, version_number, passed_count, failed_count, warning_count, results_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                meta["current_version"],
                res["summary"]["passed"],
                res["summary"]["failed"],
                res["summary"]["warnings"],
                json.dumps(res),
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO audit_logs (
                dataset_id, version_from, version_to, action_type, summary,
                details_json, modified_cells_count, removed_rows_count, created_at
            ) VALUES (?, ?, ?, 'VALIDATION_RUN', ?, ?, 0, 0, ?)
            """,
            (
                dataset_id,
                meta["current_version"],
                meta["current_version"],
                f"Structural validation: {res['summary']['passed']} passed, {res['summary']['failed']} failed, {res['summary']['warnings']} warnings",
                json.dumps(res["summary"]),
                now,
            ),
        )
        return {"version": meta["current_version"], **res}


@app.get("/api/datasets/{dataset_id}/visualizations")
def get_visualizations(
    dataset_id: str,
    numeric_col: str | None = None,
    scatter_x: str | None = None,
    scatter_y: str | None = None,
    category_col: str | None = None,
) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
        versions_rows = conn.execute(
            "SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version_number ASC",
            (dataset_id,),
        ).fetchall()
        versions = []
        for v in versions_rows:
            vd = dict(v)
            vd["quality_json"] = json.loads(vd.get("quality_json") or "{}")
            versions.append(vd)
        audit_rows = conn.execute(
            "SELECT * FROM audit_logs WHERE dataset_id = ? ORDER BY id DESC LIMIT 15",
            (dataset_id,),
        ).fetchall()
        audit_logs = [dict(a) for a in audit_rows]

    raw_df = load_df_version(dataset_id, 0)
    cur_df = load_df_version(dataset_id, meta["current_version"])
    viz = build_visualizations(
        raw_df=raw_df,
        current_df=cur_df,
        semantic_roles=meta["semantic_roles"],
        settings=settings,
        versions=versions,
        audit_logs=audit_logs,
        numeric_col=numeric_col,
        scatter_x=scatter_x,
        scatter_y=scatter_y,
        category_col=category_col,
    )
    return {"dataset": meta, "recent_activities": audit_logs, **viz}


@app.get("/api/datasets/{dataset_id}/compare")
def get_comparison(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    filter_status: str = "all",
    search: str = "",
) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
    raw_df = load_df_version(dataset_id, 0)
    cur_df = load_df_version(dataset_id, meta["current_version"])
    return compare_versions(
        raw_df=raw_df,
        current_df=cur_df,
        semantic_roles=meta["semantic_roles"],
        settings=settings,
        page=page,
        page_size=page_size,
        filter_status=filter_status,
        search=search,
    )


@app.get("/api/datasets/{dataset_id}/history")
def get_history(dataset_id: str) -> dict[str, Any]:
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        versions = conn.execute(
            "SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version_number DESC",
            (dataset_id,),
        ).fetchall()
        logs = conn.execute(
            "SELECT * FROM audit_logs WHERE dataset_id = ? ORDER BY id DESC",
            (dataset_id,),
        ).fetchall()
        val_runs = conn.execute(
            "SELECT id, version_number, passed_count, failed_count, warning_count, created_at FROM validation_runs WHERE dataset_id = ? ORDER BY id DESC LIMIT 20",
            (dataset_id,),
        ).fetchall()

        v_list = []
        for v in versions:
            vd = dict(v)
            vd["quality"] = json.loads(vd.pop("quality_json") or "{}")
            v_list.append(vd)
        l_list = []
        for l in logs:
            ld = dict(l)
            ld["details"] = json.loads(ld.pop("details_json") or "{}")
            l_list.append(ld)

        return {
            "dataset": meta,
            "versions": v_list,
            "audit_logs": l_list,
            "validation_runs": [dict(vr) for vr in val_runs],
        }


@app.get("/api/datasets/{dataset_id}/export/{fmt}")
def export_dataset(dataset_id: str, fmt: str) -> Response:
    fmt_low = fmt.lower()
    with get_db() as conn:
        meta = _get_dataset_row(conn, dataset_id)
        settings = get_settings(conn)
        versions_rows = conn.execute(
            "SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version_number ASC",
            (dataset_id,),
        ).fetchall()
        versions = [
            {**dict(v), "quality_json": json.loads(v["quality_json"] or "{}")}
            for v in versions_rows
        ]
        audit_rows = conn.execute(
            "SELECT * FROM audit_logs WHERE dataset_id = ? ORDER BY id DESC",
            (dataset_id,),
        ).fetchall()
        audit_logs = [dict(a) for a in audit_rows]
        rules_rows = conn.execute(
            "SELECT * FROM validation_rules WHERE dataset_id = ? ORDER BY id ASC",
            (dataset_id,),
        ).fetchall()
        rules = [{**dict(r), "params": json.loads(r["params_json"] or "{}"), "enabled": bool(r["enabled"])} for r in rules_rows]

    cur_df = load_df_version(dataset_id, meta["current_version"])
    stem = Path(meta["original_filename"]).stem

    if fmt_low == "csv":
        data = export_csv_bytes(cur_df)
        return Response(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{stem}_cleaned.csv"'},
        )
    if fmt_low == "xlsx":
        data = export_excel_bytes(cur_df)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{stem}_cleaned.xlsx"'},
        )
    if fmt_low == "json":
        data = export_json_bytes(cur_df)
        return Response(
            content=data,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{stem}_cleaned.json"'},
        )
    if fmt_low == "validation-json":
        val_res = run_validation(cur_df, rules)
        payload = json.dumps({"dataset": meta["name"], "version": meta["current_version"], **val_res}, indent=2).encode("utf-8")
        return Response(
            content=payload,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{stem}_validation_report.json"'},
        )
    if fmt_low == "audit-json":
        payload = json.dumps({"dataset": meta, "versions": versions, "audit_logs": audit_logs}, indent=2).encode("utf-8")
        return Response(
            content=payload,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{stem}_audit_report.json"'},
        )
    if fmt_low == "pdf":
        raw_df = load_df_version(dataset_id, 0)
        raw_prof = profile_dataset(raw_df, semantic_roles=meta["semantic_roles"], settings=settings)
        cur_prof = profile_dataset(cur_df, semantic_roles=meta["semantic_roles"], settings=settings)
        val_res = run_validation(cur_df, rules)
        viz = build_visualizations(
            raw_df=raw_df,
            current_df=cur_df,
            semantic_roles=meta["semantic_roles"],
            settings=settings,
            versions=versions,
            audit_logs=audit_logs,
        )
        pdf_bytes = build_pdf_report(meta, raw_prof, cur_prof, val_res, viz, audit_logs)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{stem}_quality_report.pdf"'},
        )

    raise HTTPException(status_code=400, detail=f"Unsupported export format '{fmt}'.")


@app.get("/api/settings")
def read_settings() -> dict[str, Any]:
    with get_db() as conn:
        return get_settings(conn)


@app.put("/api/settings")
def write_settings(payload: SettingsUpdate) -> dict[str, Any]:
    with get_db() as conn:
        now = utc_now_iso()
        for k, v in payload.settings.items():
            conn.execute(
                "INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
                (k, json.dumps(v), now),
            )
        return get_settings(conn)


# ---------------------------------------------------------------------------
# Serve built React frontend as SPA — MUST be registered LAST so API routes win
# ---------------------------------------------------------------------------
_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    def spa_root() -> FileResponse:
        return FileResponse(str(_DIST / "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        """Serve index.html for all non-API, non-asset frontend routes."""
        return FileResponse(str(_DIST / "index.html"))
