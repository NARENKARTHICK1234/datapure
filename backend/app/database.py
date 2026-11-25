"""SQLite persistence layer for datasets, versions, audit logs, validation rules, and settings."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator

from .config import DB_PATH, DEFAULT_SETTINGS, ensure_directories


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Initialize SQLite tables if they do not exist."""
    ensure_directories()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_format TEXT NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                sheet_name TEXT,
                is_synthetic INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                current_version INTEGER NOT NULL DEFAULT 0,
                max_version INTEGER NOT NULL DEFAULT 0,
                row_count INTEGER NOT NULL DEFAULT 0,
                column_count INTEGER NOT NULL DEFAULT 0,
                semantic_roles_json TEXT NOT NULL DEFAULT '{}',
                initial_quality_json TEXT NOT NULL DEFAULT '{}',
                current_quality_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS dataset_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                column_count INTEGER NOT NULL,
                quality_score REAL NOT NULL,
                quality_json TEXT NOT NULL DEFAULT '{}',
                description TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
                UNIQUE(dataset_id, version_number)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                version_from INTEGER,
                version_to INTEGER,
                action_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                details_json TEXT NOT NULL DEFAULT '{}',
                modified_cells_count INTEGER NOT NULL DEFAULT 0,
                removed_rows_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS validation_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                name TEXT NOT NULL,
                column_name TEXT,
                rule_type TEXT NOT NULL,
                params_json TEXT NOT NULL DEFAULT '{}',
                severity TEXT NOT NULL DEFAULT 'error',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS validation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                passed_count INTEGER NOT NULL,
                failed_count INTEGER NOT NULL,
                warning_count INTEGER NOT NULL,
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        for k, v in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)",
                (k, json.dumps(v), utc_now_iso()),
            )
        conn.commit()


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Yield a SQLite connection configured with Row factory and foreign keys."""
    ensure_directories()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute("SELECT key, value_json FROM app_settings").fetchall()
    settings = dict(DEFAULT_SETTINGS)
    for row in rows:
        try:
            settings[row["key"]] = json.loads(row["value_json"])
        except json.JSONDecodeError:
            pass
    return settings
