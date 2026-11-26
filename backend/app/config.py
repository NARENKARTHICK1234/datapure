"""Application configuration and constants.

On Render's free tier the filesystem is ephemeral — data written outside /tmp
may be lost between deploys.  We store everything under DATA_DIR which falls
back to /tmp/datapure when the standard ./data directory is not writable.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# On Render use /tmp for writable storage; fall back to local ./data in dev
_data_candidate = BASE_DIR / "data"
try:
    _data_candidate.mkdir(parents=True, exist_ok=True)
    # Quick write-access check
    (_data_candidate / ".write_test").touch()
    (_data_candidate / ".write_test").unlink()
    DATA_DIR = _data_candidate
except (OSError, PermissionError):
    DATA_DIR = Path("/tmp/datapure")

DATASETS_DIR = DATA_DIR / "datasets"
DB_PATH = DATA_DIR / "datapure.db"

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}

DEFAULT_SETTINGS = {
    "outlier_method": "iqr",
    "iqr_multiplier": 1.5,
    "zscore_threshold": 3.0,
    "date_format": "%Y-%m-%d",
    "quality_excellent_min": 90.0,
    "quality_good_min": 75.0,
    "quality_fair_min": 50.0,
    "default_numeric_imputation": "median",
    "default_categorical_imputation": "mode",
}


def ensure_directories() -> None:
    """Create data storage directories if missing."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
