import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from backend.app.config import settings, ROOT_DIR

CORPUS_DB_PATH = Path(settings.CORPUS_DB_PATH).resolve()

def get_corpus_connection() -> sqlite3.Connection:
    CORPUS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(CORPUS_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_corpus_db():
    conn = get_corpus_connection()
    try:
        with conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS corpus_papers (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                authors TEXT,
                abstract TEXT,
                year INTEGER,
                file_hash TEXT UNIQUE,
                file_path TEXT,
                page_count INTEGER,
                has_text BOOLEAN,
                text_quality TEXT,
                storage_key TEXT NOT NULL
            );
            """)

            conn.execute("""
            CREATE TABLE IF NOT EXISTS corpus_chunks (
                id INTEGER PRIMARY KEY,
                paper_id INTEGER,
                page_start INTEGER,
                page_end INTEGER,
                section_hint TEXT,
                text TEXT,
                n_tokens INTEGER,
                is_reference BOOLEAN,
                faiss_id INTEGER,
                FOREIGN KEY(paper_id) REFERENCES corpus_papers(id) ON DELETE CASCADE
            );
            """)

            conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_corpus_chunks_paper ON corpus_chunks(paper_id);
            """)
            conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_corpus_chunks_faiss ON corpus_chunks(faiss_id);
            """)

            # FTS5 Virtual Table for keyword/BM25 search
            conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                chunk_id UNINDEXED,
                paper_id UNINDEXED,
                section_hint,
                text,
                tokenize = 'porter unicode61'
            );
            """)
    finally:
        conn.close()

def search_bm25(query: str, top_k: int = 40, filter_paper_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Query the FTS5 virtual table using BM25 ranking.
    Returns chunk matches with BM25 score.
    """
    # Clean query for FTS5 syntax
    tokens = [t.replace('"', '""') for t in query.split() if t.isalnum()]
    if not tokens:
        return []
    fts_query = " OR ".join(f'"{t}"' for t in tokens)

    conn = get_corpus_connection()
    try:
        cur = conn.cursor()
        if filter_paper_id is not None:
            sql = """
            SELECT c.id, c.paper_id, c.page_start, c.page_end, c.section_hint, c.text,
                   bm25(chunks_fts) as rank_score, p.title, p.year
            FROM chunks_fts f
            JOIN corpus_chunks c ON c.id = CAST(f.chunk_id AS INTEGER)
            JOIN corpus_papers p ON p.id = c.paper_id
            WHERE chunks_fts MATCH ? AND c.paper_id = ? AND c.is_reference = 0
            ORDER BY rank_score ASC
            LIMIT ?
            """
            cur.execute(sql, (fts_query, filter_paper_id, top_k))
        else:
            sql = """
            SELECT c.id, c.paper_id, c.page_start, c.page_end, c.section_hint, c.text,
                   bm25(chunks_fts) as rank_score, p.title, p.year
            FROM chunks_fts f
            JOIN corpus_chunks c ON c.id = CAST(f.chunk_id AS INTEGER)
            JOIN corpus_papers p ON p.id = c.paper_id
            WHERE chunks_fts MATCH ? AND c.is_reference = 0
            ORDER BY rank_score ASC
            LIMIT ?
            """
            cur.execute(sql, (fts_query, top_k))

        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
