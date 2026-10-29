import sys
import time
from pathlib import Path

ROOT_DIR_PATH = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR_PATH) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR_PATH))

from backend.app.db import SessionLocal
from backend.app.models import Paper, Chunk
from backend.app.corpus_db import search_bm25
from backend.app.services.extraction import extract_paper_records
from backend.app.services.retrieval import hybrid_search
from backend.app.services.embeddings import embed_passages, embed_query
from backend.app.services.index import search_index

def measure():
    db = SessionLocal()
    print("--- 1. Extraction Timing ---")
    paper = db.query(Paper).filter(Paper.has_text.is_(True)).first()
    t0 = time.perf_counter()
    records = extract_paper_records(paper.id, db=db, force_regenerate=True)
    t_extract = time.perf_counter() - t0
    print(f"Paper {paper.id} ({len(records)} records extracted): {t_extract*1000:.2f} ms")

    print("\n--- 2. Embedding Speed (per 1,000 chunks) ---")
    chunks = db.query(Chunk).limit(50).all()
    texts = [c.text for c in chunks]
    t0 = time.perf_counter()
    _ = embed_passages(texts, batch_size=16)
    t_embed = time.perf_counter() - t0
    rate = len(texts) / t_embed
    sec_per_1000 = 1000 / rate
    print(f"50 chunks embedded in {t_embed:.2f}s -> {rate:.2f} chunks/sec (~{sec_per_1000:.2f}s per 1,000 chunks)")

    print("\n--- 3. Query Latency ---")
    query = "transformer architecture self-attention mechanism multi-head"

    # BM25
    t0 = time.perf_counter()
    for _ in range(10):
        _ = search_bm25(query, top_k=10)
    t_bm25 = (time.perf_counter() - t0) / 10 * 1000

    # Vector
    t0 = time.perf_counter()
    for _ in range(10):
        q_vec = embed_query(query)
        _ = search_index(q_vec, top_k=10)
    t_vec = (time.perf_counter() - t0) / 10 * 1000

    # Hybrid RRF
    t0 = time.perf_counter()
    for _ in range(10):
        _ = hybrid_search(query, top_k=10)
    t_hybrid = (time.perf_counter() - t0) / 10 * 1000

    print(f"BM25 latency: {t_bm25:.2f} ms")
    print(f"Vector latency: {t_vec:.2f} ms")
    print(f"Hybrid RRF latency: {t_hybrid:.2f} ms")
    db.close()

if __name__ == "__main__":
    measure()
