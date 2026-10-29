import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import Paper

client = TestClient(app)

def test_comparison_endpoints():
    db = SessionLocal()
    papers = db.query(Paper).limit(4).all()
    assert len(papers) >= 3, "At least 3 papers should be available for testing"
    p_ids = [p.id for p in papers]
    db.close()

    # 1. Test Candidates endpoint
    res_cand = client.get("/compare/candidates?limit=10")
    assert res_cand.status_code == 200
    candidates = res_cand.json()
    assert len(candidates) >= 3

    # 2. Test Invalid comparisons (< 2 and > 6 papers)
    res_under = client.post("/compare", json={"paper_ids": [p_ids[0]]})
    assert res_under.status_code == 422 or res_under.status_code == 400

    res_over = client.post("/compare", json={"paper_ids": [p_ids[0]] * 7})
    assert res_over.status_code == 422 or res_over.status_code == 400

    # 3. Test Valid 3-paper comparison
    test_ids = p_ids[:3]
    res_comp = client.post("/compare", json={"paper_ids": test_ids})
    assert res_comp.status_code == 200
    data = res_comp.json()

    assert "papers" in data
    assert len(data["papers"]) == 3
    assert "aspect_matrix" in data
    assert len(data["aspect_matrix"]) >= 3

    # Verify aspect matrix cells contain quote and page
    for row in data["aspect_matrix"]:
        assert "aspect" in row
        assert "cells" in row
        for pid_str, cell in row["cells"].items():
            assert "value" in cell
            assert "quote" in cell
            assert "page" in cell

    # Verify comparability groupings
    assert "comparable_groups" in data
    assert "not_comparable_groups" in data

    # Check that any non-comparable group has an explicit reason
    for ncg in data["not_comparable_groups"]:
        assert "reason" in ncg
        assert len(ncg["reason"]) > 5
        assert ncg["is_comparable"] is False
