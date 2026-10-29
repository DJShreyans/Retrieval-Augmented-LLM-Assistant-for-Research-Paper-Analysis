from typing import List, Optional
import numpy as np
import torch
from backend.app.config import settings, yaml_config

_MODEL = None

QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
MODEL_NAME = "BAAI/bge-small-en-v1.5"

def get_device() -> str:
    cfg_dev = yaml_config.get("hardware", {}).get("device", "auto")
    if cfg_dev == "cuda" and torch.cuda.is_available():
        return "cuda"
    elif cfg_dev == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cpu"

def get_embedding_model():
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        dev = get_device()
        print(f"[Embeddings] Loading {MODEL_NAME} on device: {dev}...")
        _MODEL = SentenceTransformer(MODEL_NAME, device=dev)
    return _MODEL

def embed_passages(texts: List[str], batch_size: int = 64) -> np.ndarray:
    """Embed chunks/passages without query instruction, normalized."""
    if not texts:
        return np.empty((0, 384), dtype=np.float32)
    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    return embeddings.astype(np.float32)

def embed_query(query: str) -> np.ndarray:
    """Embed search query with BGE search instruction prepended, normalized."""
    full_prompt = f"{QUERY_INSTRUCTION}{query}"
    model = get_embedding_model()
    embedding = model.encode(
        [full_prompt],
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    return embedding[0].astype(np.float32)
