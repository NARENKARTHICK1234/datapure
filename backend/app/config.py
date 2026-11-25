"""Application configuration and constants."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
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
