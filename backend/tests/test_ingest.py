import pytest
from pathlib import Path
from backend.app.config import ROOT_DIR
from backend.app.db import SessionLocal
from backend.app.models import Paper, Chunk
from backend.app.corpus_db import get_corpus_connection, search_bm25
from backend.app.services.chunking import chunk_pages, estimate_tokens

def test_chunking_logic():
    sample_pages = [
        "Abstract\n\nThis is an abstract about deep learning.\n\n1. Introduction\n\nDeep neural networks have revolutionized AI. " * 15,
        "Methodology\n\nWe present a novel multi-head self-attention mechanism. " * 20,
        "References\n\n[1] Vaswani et al. Attention is all you need. 2017.\n\n[2] Devlin et al. BERT. 2018."
    ]
    chunks = chunk_pages(sample_pages, min_tokens=100, max_tokens=300, overlap_tokens=30)
    assert len(chunks) >= 2

    # Check reference detection
    ref_chunks = [c for c in chunks if c["is_reference"]]
    assert len(ref_chunks) >= 1

    for c in chunks:
        assert c["page_start"] >= 1
        assert c["page_end"] >= c["page_start"]
        assert len(c["text"]) > 20

def test_database_ingestion_records():
    db = SessionLocal()
    try:
        paper_count = db.query(Paper).count()
        chunk_count = db.query(Chunk).count()
        assert paper_count > 0, "At least some papers should be ingested in Phase 1"
        assert chunk_count > 0, "Chunks should exist in database"
    finally:
        db.close()

def test_corpus_db_sync():
    conn = get_corpus_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM corpus_papers")
        p_count = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM corpus_chunks")
        c_count = cur.fetchone()[0]
        assert p_count > 0
        assert c_count > 0
    finally:
        conn.close()

def test_thumbnails_created():
    thumb_dir = ROOT_DIR / "data" / "thumbnails"
    assert thumb_dir.exists()
    thumbs = list(thumb_dir.glob("*.png"))
    assert len(thumbs) > 0, "Page 1 thumbnails should be generated"

def test_bm25_search_functional():
    results = search_bm25("learning", top_k=5)
    assert len(results) > 0
    assert "text" in results[0]
    assert "page_start" in results[0]
