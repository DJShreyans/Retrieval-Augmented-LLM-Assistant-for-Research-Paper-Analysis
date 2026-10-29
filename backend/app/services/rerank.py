from typing import List, Dict, Any
from backend.app.config import settings

_RERANKER_MODEL = None

def get_reranker():
    global _RERANKER_MODEL
    if _RERANKER_MODEL is None and settings.USE_RERANKER:
        try:
            from sentence_transformers import CrossEncoder
            print("[Reranker] Loading BAAI/bge-reranker-v2-m3...")
            _RERANKER_MODEL = CrossEncoder("BAAI/bge-reranker-v2-m3")
        except Exception as e:
            print(f"[Reranker Warning] Failed to load reranker: {e}")
            _RERANKER_MODEL = False
    return _RERANKER_MODEL

def rerank_passages(query: str, candidates: List[Dict[str, Any]], top_k: int = 8) -> List[Dict[str, Any]]:
    if not candidates:
        return []

    if not settings.USE_RERANKER:
        return candidates[:top_k]

    model = get_reranker()
    if not model:
        return candidates[:top_k]

    try:
        pairs = [(query, c["text"]) for c in candidates]
        scores = model.predict(pairs)
        for cand, score in zip(candidates, scores):
            cand["rerank_score"] = float(score)

        reranked = sorted(candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
        return reranked[:top_k]
    except Exception as e:
        print(f"[Reranker Error] {e}")
        return candidates[:top_k]
