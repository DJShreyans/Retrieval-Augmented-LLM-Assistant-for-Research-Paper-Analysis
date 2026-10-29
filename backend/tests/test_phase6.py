import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_dashboard_stats_endpoint():
    res = client.get("/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_papers" in data
    assert data["total_papers"] > 0
    assert "total_chunks" in data
    assert "topics" in data
    assert "suggested_papers" in data

def test_literature_review_endpoint():
    res = client.post("/litreview", json={"topic": "Attention and graph representation learning"})
    assert res.status_code == 200
    data = res.json()

    assert "topic" in data
    assert "sections" in data
    assert len(data["sections"]) >= 4

    # Verify coverage log
    assert "coverage_log" in data
    cov = data["coverage_log"]
    assert "queries_run" in cov
    assert len(cov["queries_run"]) >= 3
    assert "passages_used" in cov
    assert "papers_used" in cov

    # Verify citations
    assert "citations" in data
    assert len(data["citations"]) > 0
    c0 = data["citations"][0]
    assert "n" in c0
    assert "page" in c0
    assert "quote" in c0

def test_research_gaps_and_ideas_endpoints():
    # 1. Gaps list
    res_gaps = client.get("/gaps")
    assert res_gaps.status_code == 200
    gaps = res_gaps.json()
    assert len(gaps) >= 3

    g0 = gaps[0]
    assert "theme" in g0
    assert "hypothesis" in g0
    assert "Hypothesis for expert review" in g0["hypothesis"]
    assert "supporting_quotes" in g0

    # 2. Study outline idea for gap 1
    res_idea = client.get(f"/gaps/{g0['id']}/idea")
    assert res_idea.status_code == 200
    idea_data = res_idea.json()
    assert "study_outline" in idea_data
    outline = idea_data["study_outline"]
    assert "working_title" in outline
    assert "problem_statement" in outline
    assert "proposed_methodology" in outline
    assert "required_datasets" in outline
    assert "expected_metrics" in outline

def test_settings_endpoints():
    from backend.app.db import SessionLocal
    from backend.app.models import User
    from backend.app.security import create_access_token
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "admin").first()
    token = create_access_token({"sub": str(admin.id), "email": admin.email, "role": admin.role}) if admin else ""
    db.close()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # 1. Get settings
    res = client.get("/settings", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "llm" in data
    assert "provider" in data["llm"]
    assert "api_key_status" in data["llm"]
    # Check that raw secret is not leaked
    assert "sk-" not in data["llm"]["api_key_status"] or "••••" in data["llm"]["api_key_status"]

    assert "embeddings" in data
    assert "hardware" in data
    assert data["hardware"]["cpu_cores"] > 0
    assert "library_stats" in data
    assert data["library_stats"]["total_papers"] > 0

    # 2. Trigger reindex
    res_reindex = client.post("/settings/reindex", headers=headers)
    assert res_reindex.status_code == 200
