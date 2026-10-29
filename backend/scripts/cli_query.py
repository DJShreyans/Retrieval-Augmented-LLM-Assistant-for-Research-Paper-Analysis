import sys
import argparse
from pathlib import Path
from typing import Dict, Any, List

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.corpus_db import get_corpus_connection, search_bm25
from backend.app.services.embeddings import embed_query
from backend.app.services.index import search_index

def hybrid_query(query: str, top_k: int = 5, rrf_k: int = 60) -> List[Dict[str, Any]]:
    conn = get_corpus_connection()
    try:
        # 1. BM25 Search
        bm25_results = search_bm25(query, top_k=40)

        # 2. Vector Search
        q_vec = embed_query(query)
        v_scores, v_indices = search_index(q_vec, top_k=40)

        cur = conn.cursor()
        # Map faiss_id to chunk
        vector_results = []
        if len(v_indices) > 0:
            placeholders = ",".join("?" for _ in v_indices)
            cur.execute(f"""
            SELECT c.id, c.paper_id, c.page_start, c.page_end, c.section_hint, c.text,
                   c.faiss_id, p.title, p.year
            FROM corpus_chunks c
            JOIN corpus_papers p ON p.id = c.paper_id
            WHERE c.faiss_id IN ({placeholders})
            """, [int(i) for i in v_indices])
            rows = {r["faiss_id"]: dict(r) for r in cur.fetchall()}
            for rank_idx, (f_id, score) in enumerate(zip(v_indices, v_scores)):
                if f_id in rows:
                    item = rows[f_id]
                    item["vector_score"] = float(score)
                    vector_results.append(item)

        # 3. Reciprocal Rank Fusion (RRF)
        fused_scores: Dict[int, float] = {}
        chunk_map: Dict[int, Dict[str, Any]] = {}

        # BM25 RRF
        for rank, item in enumerate(bm25_results, 1):
            c_id = item["id"]
            chunk_map[c_id] = item
            fused_scores[c_id] = fused_scores.get(c_id, 0.0) + (1.0 / (rrf_k + rank))

        # Vector RRF
        for rank, item in enumerate(vector_results, 1):
            c_id = item["id"]
            if c_id not in chunk_map:
                chunk_map[c_id] = item
            fused_scores[c_id] = fused_scores.get(c_id, 0.0) + (1.0 / (rrf_k + rank))

        # Sort by fused score descending
        ranked_chunks = sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        final_results = []
        for c_id, score in ranked_chunks:
            chunk = chunk_map[c_id]
            chunk["rrf_score"] = score
            final_results.append(chunk)

        return final_results
    finally:
        conn.close()

def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="CLI Query for ResearchMate Corpus")
    parser.add_argument("query", type=str, nargs="?", default="neural network attention mechanism", help="Search query")
    parser.add_argument("--top_k", type=int, default=5, help="Number of results to display")
    args = parser.parse_args()

    print(f"\n[CLI Query] Running hybrid retrieval for: '{args.query}'...")
    results = hybrid_query(args.query, top_k=args.top_k)

    print("\n" + "=" * 75)
    print(f" TOP {len(results)} RETRIEVED EVIDENCE PASSAGES")
    print("=" * 75)
    for idx, r in enumerate(results, 1):
        clean_title = r['title'].encode("ascii", "replace").decode("ascii")
        clean_section = (r.get('section_hint') or 'General').encode("ascii", "replace").decode("ascii")
        clean_quote = r['text'][:300].replace("\n", " ").encode("ascii", "replace").decode("ascii")

        print(f"\n[Result #{idx}] Score: {r['rrf_score']:.4f}")
        print(f"  * Paper:    {clean_title} ({r.get('year') or 'N/A'})")
        print(f"  * Location: Page {r['page_start']} | Section: {clean_section}")
        print(f"  * Quote:    \"{clean_quote}...\"")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    main()
