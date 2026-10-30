import pytest
from pathlib import Path
from sqlalchemy import text
from backend.app.config import settings, ROOT_DIR
from backend.app.db import engine, SessionLocal
from backend.app.models import User, Paper, Chunk, Tag, PaperTag, Chat, Message, Summary, Extraction, LLMCall, Job

def test_config_loaded():
    assert settings.DATABASE_URL is not None
    assert settings.PDF_SOURCE in ["local", "r2"]
    assert settings.LLM_PROVIDER in ["none", "openai", "anthropic", "gemini", "openai_compatible"]

def test_database_connection():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1")).scalar()
        assert res == 1

def test_models_exist_in_db():
    db = SessionLocal()
    try:
        # Check admin user seeded
        admin = db.query(User).filter(User.role == "admin").first()
        assert admin is not None
        assert admin.email in settings.admin_emails_list or admin.email == "admin@example.com"
    finally:
        db.close()

def test_fts5_available():
    import sqlite3
    con = sqlite3.connect(":memory:")
    con.execute("CREATE VIRTUAL TABLE fts_test USING fts5(content);")
    con.execute("INSERT INTO fts_test(content) VALUES ('deep learning attention');")
    res = con.execute("SELECT * FROM fts_test WHERE fts_test MATCH 'learning';").fetchall()
    con.close()
    assert len(res) == 1

def test_pymupdf_available():
    import fitz
    assert fitz.__version__ is not None

def test_api_health_endpoint():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["llm_provider"] in ("none", "gemini", "openai", "mock", "anthropic")

