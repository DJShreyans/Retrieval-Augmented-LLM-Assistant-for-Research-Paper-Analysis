import sys
import csv
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.corpus_db import get_corpus_connection, search_bm25
from backend.app.services.embeddings import embed_query
from backend.app.services.index import search_index
from backend.app.services.rerank import rerank_passages
from backend.app.services.retrieval import hybrid_search

def evaluate_retrieval(csv_path: str = "eval/questions.csv"):
    conn = get_corpus_connection()
    cur = conn.cursor()

    eval_items = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            eval_items.append({
                "question": row["question"],
                "expected_paper_id": int(row["expected_paper_id"]),
                "expected_page": int(row.get("expected_page", 1))
            })

    total_q = len(eval_items)
    print(f"\n[Eval] Loaded {total_q} benchmark questions from {csv_path}...")

    methods = ["BM25-only", "Vector-only", "Hybrid (RRF)", "Hybrid + Rerank"]
    stats = {m: {"r5": 0, "r10": 0, "mrr": 0.0} for m in methods}

    for item in eval_items:
        q = item["question"]
        exp_id = item["expected_paper_id"]

        # 1. BM25
        bm25_res = search_bm25(q, top_k=20)
        bm25_paper_ids = []
        for r in bm25_res:
            if r["paper_id"] not in bm25_paper_ids:
                bm25_paper_ids.append(r["paper_id"])

        # 2. Vector
        q_vec = embed_query(q)
        v_scores, v_indices = search_index(q_vec, top_k=20)
        vec_paper_ids = []
        if len(v_indices) > 0:
            placeholders = ",".join("?" for _ in v_indices)
            cur.execute(f"SELECT faiss_id, paper_id FROM corpus_chunks WHERE faiss_id IN ({placeholders})", [int(i) for i in v_indices])
            id_map = dict(cur.fetchall())
            for f_id in v_indices:
                p_id = id_map.get(f_id)
                if p_id and p_id not in vec_paper_ids:
                    vec_paper_ids.append(p_id)

        # 3. Hybrid (RRF)
        hybrid_res = hybrid_search(q, top_k=20)
        hybrid_paper_ids = []
        for r in hybrid_res:
            if r["paper_id"] not in hybrid_paper_ids:
                hybrid_paper_ids.append(r["paper_id"])

        # 4. Hybrid + Reranker (takes top 20 and reranks)
        rerank_res = rerank_passages(q, hybrid_res, top_k=20)
        rerank_paper_ids = []
        for r in rerank_res:
            if r["paper_id"] not in rerank_paper_ids:
                rerank_paper_ids.append(r["paper_id"])

        method_predictions = {
            "BM25-only": bm25_paper_ids,
            "Vector-only": vec_paper_ids,
            "Hybrid (RRF)": hybrid_paper_ids,
            "Hybrid + Rerank": rerank_paper_ids
        }

        for m, preds in method_predictions.items():
            top5 = preds[:5]
            top10 = preds[:10]

            if exp_id in top5:
                stats[m]["r5"] += 1
            if exp_id in top10:
                stats[m]["r10"] += 1

            if exp_id in top10:
                rank = top10.index(exp_id) + 1
                stats[m]["mrr"] += 1.0 / rank

    conn.close()

    # Print Table
    print("\n" + "=" * 65)
    print("        RESEARCHMATE RETRIEVAL BENCHMARK EVALUATION")
    print("=" * 65)
    print(f"{'Method':<20} | {'Recall@5':<10} | {'Recall@10':<10} | {'MRR':<10}")
    print("-" * 65)
    for m in methods:
        r5 = (stats[m]["r5"] / total_q) * 100
        r10 = (stats[m]["r10"] / total_q) * 100
        mrr = stats[m]["mrr"] / total_q
        print(f"{m:<20} | {r5:>6.1f}%    | {r10:>6.1f}%    | {mrr:>6.3f}")
    print("=" * 65 + "\n")

    return stats

if __name__ == "__main__":
    evaluate_retrieval()
