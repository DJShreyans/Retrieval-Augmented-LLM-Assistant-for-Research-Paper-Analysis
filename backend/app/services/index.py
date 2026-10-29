from pathlib import Path
from typing import Tuple, Optional
import numpy as np
import faiss
from backend.app.config import settings, ROOT_DIR

FAISS_PATH = Path(settings.FAISS_INDEX_PATH).resolve()

_INDEX: Optional[faiss.IndexFlatIP] = None

def get_faiss_index(dim: int = 384) -> faiss.IndexFlatIP:
    global _INDEX
    if _INDEX is None:
        if FAISS_PATH.exists():
            print(f"[FAISS] Loading existing index from {FAISS_PATH}...")
            _INDEX = faiss.read_index(str(FAISS_PATH))
        else:
            print(f"[FAISS] Initializing new IndexFlatIP (dim={dim})...")
            FAISS_PATH.parent.mkdir(parents=True, exist_ok=True)
            _INDEX = faiss.IndexFlatIP(dim)
    return _INDEX

def add_to_index(vectors: np.ndarray) -> int:
    """Add batch of normalized float32 vectors to FAISS index. Returns starting faiss_id."""
    if len(vectors) == 0:
        return 0
    index = get_faiss_index(vectors.shape[1])
    start_id = index.ntotal
    index.add(vectors.astype(np.float32))
    save_index()
    return start_id

def save_index():
    global _INDEX
    if _INDEX is not None:
        FAISS_PATH.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(_INDEX, str(FAISS_PATH))

def search_index(query_vec: np.ndarray, top_k: int = 40) -> Tuple[np.ndarray, np.ndarray]:
    """Search FAISS index with query vector. Returns (scores, faiss_indices)."""
    index = get_faiss_index()
    if index.ntotal == 0:
        return np.array([]), np.array([])
    q = np.expand_dims(query_vec.astype(np.float32), axis=0)
    scores, indices = index.search(q, min(top_k, index.ntotal))
    return scores[0], indices[0]
