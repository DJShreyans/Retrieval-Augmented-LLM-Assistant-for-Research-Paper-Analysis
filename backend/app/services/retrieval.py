from typing import List, Dict, Any, Optional
from backend.app.corpus_db import get_corpus_connection, search_bm25
from backend.app.services.embeddings import embed_query
from backend.app.services.index import search_index
from backend.app.services.rerank import rerank_passages
from backend.app.db import SessionLocal
from backend.app.models import Paper, PaperTag

def hybrid_search(
    query: str,
    top_k: int = 8,
    paper_id: Optional[int] = None,
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    tag_id: Optional[int] = None,
    user_id: Optional[int] = None,
    rrf_k: int = 60
) -> List[Dict[str, Any]]:
    """
    Executes hybrid retrieval: BM25 (FTS5) + FAISS (Dense vector) + RRF fusion + optional CrossEncoder rerank.
    Enforces paper visibility and filters (year, tag).
    """
    conn = get_corpus_connection()
    app_db = SessionLocal()

    try:
        # 1. Filter eligible paper IDs based on visibility and filters
        p_query = app_db.query(Paper.id)
        if user_id is not None:
            p_query = p_query.filter((Paper.visibility == "shared") | (Paper.owner_id == user_id))
        else:
            p_query = p_query.filter(Paper.visibility == "shared")

        if paper_id is not None:
            p_query = p_query.filter(Paper.id == paper_id)
        if year_start is not None:
            p_query = p_query.filter(Paper.year >= year_start)
        if year_end is not None:
            p_query = p_query.filter(Paper.year <= year_end)
        if tag_id is not None:
            p_query = p_query.join(PaperTag, PaperTag.paper_id == Paper.id).filter(PaperTag.tag_id == tag_id)

        allowed_paper_ids = set(r[0] for r in p_query.all())
        if not allowed_paper_ids:
            return []

        # 2. BM25 Search
        bm25_raw = search_bm25(query, top_k=60, filter_paper_id=paper_id)
        bm25_filtered = [r for r in bm25_raw if r["paper_id"] in allowed_paper_ids]

        # 3. Vector Search
        q_vec = embed_query(query)
        v_scores, v_indices = search_index(q_vec, top_k=60)

        vector_filtered = []
        if len(v_indices) > 0:
            cur = conn.cursor()
            placeholders = ",".join("?" for _ in v_indices)
            cur.execute(f"""
            SELECT c.id, c.paper_id, c.page_start, c.page_end, c.section_hint, c.text,
                   c.faiss_id, p.title, p.year
            FROM corpus_chunks c
            JOIN corpus_papers p ON p.id = c.paper_id
            WHERE c.faiss_id IN ({placeholders}) AND c.is_reference = 0
            """, [int(i) for i in v_indices])
            rows = {r["faiss_id"]: dict(r) for r in cur.fetchall()}
            for f_id, score in zip(v_indices, v_scores):
                if f_id in rows:
                    item = rows[f_id]
                    if item["paper_id"] in allowed_paper_ids:
                        item["vector_score"] = float(score)
                        vector_filtered.append(item)

        # 4. Reciprocal Rank Fusion (RRF)
        fused_scores: Dict[int, float] = {}
        chunk_map: Dict[int, Dict[str, Any]] = {}

        for rank, item in enumerate(bm25_filtered, 1):
            c_id = item["id"]
            chunk_map[c_id] = item
            fused_scores[c_id] = fused_scores.get(c_id, 0.0) + (1.0 / (rrf_k + rank))

        for rank, item in enumerate(vector_filtered, 1):
            c_id = item["id"]
            if c_id not in chunk_map:
                chunk_map[c_id] = item
            fused_scores[c_id] = fused_scores.get(c_id, 0.0) + (1.0 / (rrf_k + rank))

        ranked_candidates = []
        for c_id, score in sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)[:40]:
            chunk = chunk_map[c_id]
            chunk["score"] = score
            ranked_candidates.append(chunk)

        # 5. Optional CrossEncoder Rerank down to top_k
        final_results = rerank_passages(query, ranked_candidates, top_k=top_k)
        return final_results

    finally:
        conn.close()
        app_db.close()
