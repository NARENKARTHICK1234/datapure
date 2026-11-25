"""Dataset snapshot storage and parsing helpers preserving original raw data and stable row IDs."""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any
import pandas as pd

from ..config import DATASETS_DIR

ROW_ID_COL = "_dp_row_id"


def dataset_dir(dataset_id: str) -> Path:
    path = DATASETS_DIR / dataset_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def version_path(dataset_id: str, version_number: int) -> Path:
    return dataset_dir(dataset_id) / f"v{version_number}.pkl"


def save_df_version(dataset_id: str, version_number: int, df: pd.DataFrame) -> str:
    """Persist a DataFrame snapshot cleanly with stable _dp_row_id intact."""
    path = version_path(dataset_id, version_number)
    df.to_pickle(path)
    return str(path)


def load_df_version(dataset_id: str, version_number: int) -> pd.DataFrame:
    """Load a specific version snapshot."""
    path = version_path(dataset_id, version_number)
    if not path.exists():
        raise FileNotFoundError(f"Snapshot v{version_number} not found for dataset {dataset_id}")
    return pd.read_pickle(path)


def attach_row_ids(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure every row has a stable integer _dp_row_id for comparison & audit tracking."""
    out = df.copy()
    if ROW_ID_COL not in out.columns:
        out.insert(0, ROW_ID_COL, range(len(out)))
    return out


def user_columns(df: pd.DataFrame) -> list[str]:
    """Return user-facing column names excluding internal _dp_row_id."""
    return [str(c) for c in df.columns if c != ROW_ID_COL]


def strip_row_id(df: pd.DataFrame) -> pd.DataFrame:
    """Return copy without internal _dp_row_id."""
    if ROW_ID_COL in df.columns:
        return df.drop(columns=[ROW_ID_COL])
    return df.copy()


def inspect_excel_sheets(content: bytes) -> list[str]:
    """Return sheet names for an uploaded Excel workbook."""
    bio = io.BytesIO(content)
    xl = pd.ExcelFile(bio, engine="openpyxl")
    return [str(s) for s in xl.sheet_names]


def parse_uploaded_bytes(
    content: bytes,
    filename: str,
    sheet_name: str | None = None,
) -> pd.DataFrame:
    """Parse CSV, Excel, or JSON bytes into a DataFrame while preserving raw values."""
    lower = filename.lower()
    bio = io.BytesIO(content)
    if lower.endswith(".csv"):
        try:
            df = pd.read_csv(bio, dtype=object, keep_default_na=True)
        except UnicodeDecodeError:
            bio.seek(0)
            df = pd.read_csv(bio, dtype=object, keep_default_na=True, encoding="latin-1")
    elif lower.endswith((".xlsx", ".xls")):
        xl = pd.ExcelFile(bio, engine="openpyxl")
        target_sheet = sheet_name if sheet_name and sheet_name in xl.sheet_names else xl.sheet_names[0]
        df = pd.read_excel(bio, sheet_name=target_sheet, dtype=object, engine="openpyxl")
    elif lower.endswith(".json"):
        raw = json.loads(content.decode("utf-8"))
        if isinstance(raw, list):
            df = pd.DataFrame(raw)
        elif isinstance(raw, dict):
            # Support {"data": [...]} or column-oriented dicts
            if "data" in raw and isinstance(raw["data"], list):
                df = pd.DataFrame(raw["data"])
            elif "records" in raw and isinstance(raw["records"], list):
                df = pd.DataFrame(raw["records"])
            else:
                df = pd.DataFrame(raw)
        else:
            raise ValueError("Unsupported JSON structure. Expected an array of objects or record map.")
    else:
        raise ValueError("Unsupported file format. Allowed formats: CSV, Excel (.xlsx/.xls), JSON.")

    # Normalize column names to strings
    df.columns = [str(c).strip() if str(c).strip() else f"Column_{idx + 1}" for idx, c in enumerate(df.columns)]
    return attach_row_ids(df)


def serialize_cell(val: Any) -> Any:
    """Safely convert pandas/numpy scalars to JSON-serializable Python primitives."""
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(val, "item"):
        return val.item()
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    return val
