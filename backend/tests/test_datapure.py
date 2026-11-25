"""Comprehensive end-to-end backend test suite for DataPure."""

from __future__ import annotations

import io
import json
import openpyxl
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_sample_dataset_end_to_end(client: TestClient):
    # 1. Load 5,000-row synthetic sample dataset
    res = client.post("/api/datasets/sample")
    assert res.status_code == 200
    ds = res.json()["dataset"]
    dataset_id = ds["id"]
    assert ds["row_count"] == 5000
    assert ds["column_count"] == 13
    assert ds["is_synthetic"] == 1

    try:
        # 2. Profile dataset
        prof = client.get(f"/api/datasets/{dataset_id}/profile").json()
        assert prof["summary"]["total_rows"] == 5000
        assert prof["summary"]["duplicate_rows"] > 0
        assert prof["summary"]["empty_rows"] > 0
        assert prof["summary"]["missing_values"] > 0
        assert prof["summary"]["outliers_detected"] > 0
        initial_score = prof["quality"]["overall_score"]
        assert 0 < initial_score < 95

        # 3. Auto-clean plan & confirmation guard
        plan = client.post(f"/api/datasets/{dataset_id}/clean/auto-plan").json()
        ops = plan["operations"]
        assert len(ops) >= 5
        assert plan["preview"]["requires_confirmation"] is True

        # Without confirm_destructive -> 409
        blocked = client.post(
            f"/api/datasets/{dataset_id}/clean/apply",
            json={"operations": ops, "mode": "auto", "confirm_destructive": False},
        )
        assert blocked.status_code == 409

        # With confirm_destructive=True -> 200
        applied = client.post(
            f"/api/datasets/{dataset_id}/clean/apply",
            json={"operations": ops, "mode": "auto", "confirm_destructive": True},
        )
        assert applied.status_code == 200
        cleaned_meta = applied.json()["dataset"]
        assert cleaned_meta["current_version"] == 1
        assert cleaned_meta["row_count"] < 5000
        after_score = applied.json()["profile"]["quality"]["overall_score"]
        assert after_score > initial_score

        # 4. Structural validation (Pandera + custom rules)
        rules_res = client.get(f"/api/datasets/{dataset_id}/validation/rules")
        assert rules_res.status_code == 200
        assert len(rules_res.json()) > 5

        # Add custom regex rule
        new_rule = client.post(
            f"/api/datasets/{dataset_id}/validation/rules",
            json={
                "name": "Customer ID Prefix",
                "column_name": "Customer ID",
                "rule_type": "regex",
                "params": {"pattern": r"^CUST-\d+$"},
                "severity": "error",
                "enabled": True,
            },
        )
        assert new_rule.status_code == 200

        val_run = client.post(f"/api/datasets/{dataset_id}/validation/run").json()
        assert val_run["summary"]["total_rules"] > 5

        # 5. Visualizations (all 16 charts)
        viz = client.get(f"/api/datasets/{dataset_id}/visualizations").json()
        charts = viz["charts"]
        for key in [
            "donut_issues",
            "grouped_before_after",
            "missing_by_column",
            "quality_timeline",
            "radar_dimensions",
            "missing_heatmap",
            "boxplot",
            "histogram",
            "scatter",
            "correlation_heatmap",
            "stacked_column_health",
            "radial_gauge",
            "treemap",
            "waterfall",
            "funnel",
        ]:
            assert key in charts

        # 6. Before vs After Comparison
        cmp = client.get(f"/api/datasets/{dataset_id}/compare?filter_status=modified").json()
        assert cmp["metrics"]["rows_before"] == 5000
        assert cmp["metrics"]["rows_removed"] > 0
        assert cmp["metrics"]["modified_cells"] > 0
        assert cmp["metrics"]["quality_gain"] > 0

        # 7. Undo / Redo / Restore
        undo_res = client.post(f"/api/datasets/{dataset_id}/undo")
        assert undo_res.status_code == 200
        assert undo_res.json()["dataset"]["current_version"] == 0

        redo_res = client.post(f"/api/datasets/{dataset_id}/redo")
        assert redo_res.status_code == 200
        assert redo_res.json()["dataset"]["current_version"] == 1

        # 8. Exports (CSV, XLSX, JSON, PDF, Audit JSON, Validation JSON)
        for fmt in ["csv", "xlsx", "json", "pdf", "validation-json", "audit-json"]:
            exp = client.get(f"/api/datasets/{dataset_id}/export/{fmt}")
            assert exp.status_code == 200
            assert len(exp.content) > 100
        assert client.get(f"/api/datasets/{dataset_id}/export/pdf").content[:4] == b"%PDF"

    finally:
        del_res = client.delete(f"/api/datasets/{dataset_id}")
        assert del_res.status_code == 200


def test_uploads_and_edge_cases(client: TestClient):
    # Invalid extension
    bad_ext = client.post(
        "/api/datasets/upload",
        files={"file": ("malware.exe", b"hello", "application/octet-stream")},
    )
    assert bad_ext.status_code == 400

    # Empty file
    empty_file = client.post(
        "/api/datasets/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert empty_file.status_code == 400

    # Headers-only CSV (0 rows)
    header_only = client.post(
        "/api/datasets/upload",
        files={"file": ("headers.csv", b"id,name,amount\n", "text/csv")},
    )
    assert header_only.status_code == 200
    hid = header_only.json()["dataset"]["id"]
    hprof = client.get(f"/api/datasets/{hid}/profile")
    assert hprof.status_code == 200
    assert hprof.json()["summary"]["total_rows"] == 0
    client.delete(f"/api/datasets/{hid}")

    # Multi-sheet Excel upload
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "RawOrders"
    ws1.append(["Order ID", "Email", "Amount"])
    ws1.append(["ORD-1", "test@example.com", 100])
    ws1.append(["ORD-2", "bad-email", -50])
    ws2 = wb.create_sheet("Summary")
    ws2.append(["Metric", "Val"])
    ws2.append(["Total", 2])
    bio = io.BytesIO()
    wb.save(bio)
    xlsx_bytes = bio.getvalue()

    sheets_res = client.post(
        "/api/datasets/inspect-sheets",
        files={"file": ("orders.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert sheets_res.status_code == 200
    assert sheets_res.json()["sheets"] == ["RawOrders", "Summary"]

    up_xlsx = client.post(
        "/api/datasets/upload",
        data={"sheet_name": "RawOrders"},
        files={"file": ("orders.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert up_xlsx.status_code == 200
    xid = up_xlsx.json()["dataset"]["id"]
    assert up_xlsx.json()["dataset"]["row_count"] == 2
    client.delete(f"/api/datasets/{xid}")

    # JSON upload
    json_bytes = json.dumps([{"id": 1, "score": 95}, {"id": 2, "score": "bad"}]).encode("utf-8")
    up_json = client.post(
        "/api/datasets/upload",
        files={"file": ("scores.json", json_bytes, "application/json")},
    )
    assert up_json.status_code == 200
    jid = up_json.json()["dataset"]["id"]
    assert up_json.json()["dataset"]["row_count"] == 2
    client.delete(f"/api/datasets/{jid}")
