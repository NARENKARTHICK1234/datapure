"""Pydantic models for API requests and responses."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class CleaningOperation(BaseModel):
    op_type: Literal[
        "remove_duplicates",
        "remove_empty_rows",
        "trim_whitespace",
        "standardize_case",
        "impute_missing",
        "standardize_dates",
        "normalize_emails",
        "normalize_phones",
        "convert_dtype",
        "handle_outliers",
        "replace_invalid",
    ]
    columns: list[str] = Field(default_factory=list)
    params: dict[str, Any] = Field(default_factory=dict)


class CleaningRequest(BaseModel):
    operations: list[CleaningOperation]
    mode: Literal["auto", "manual"] = "manual"
    confirm_destructive: bool = False


class ValidationRuleCreate(BaseModel):
    name: str
    column_name: str | None = None
    rule_type: Literal[
        "required_column",
        "dtype",
        "unique",
        "not_null",
        "min_max",
        "email",
        "phone",
        "date",
        "regex",
        "allowed_values",
        "custom_expression",
    ]
    params: dict[str, Any] = Field(default_factory=dict)
    severity: Literal["error", "warning"] = "error"
    enabled: bool = True


class ValidationRuleUpdate(BaseModel):
    name: str | None = None
    column_name: str | None = None
    rule_type: str | None = None
    params: dict[str, Any] | None = None
    severity: Literal["error", "warning"] | None = None
    enabled: bool | None = None


class SettingsUpdate(BaseModel):
    settings: dict[str, Any]
