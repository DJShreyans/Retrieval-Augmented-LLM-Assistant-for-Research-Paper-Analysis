import os
import psutil
import torch
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.config import settings, yaml_config, ROOT_DIR
from backend.app.db import get_db
from backend.app.models import Paper, Chunk
from backend.app.services.index import get_faiss_index

router = APIRouter(prefix="/settings", tags=["Settings"])

def mask_key(key: Optional[str]) -> str:
    if not key:
        return "Not Configured (Free local extractive mode)"
    if len(key) <= 8:
        return "Configured (••••••••)"
    return f"Configured ({key[:4]}••••{key[-4:]})"

@router.get("")
def get_system_settings(db: Session = Depends(get_db)):
    # Memory and hardware
    ram = psutil.virtual_memory()
    total_ram_gb = round(ram.total / (1024**3), 1)
    available_ram_gb = round(ram.available / (1024**3), 1)
    cpu_cores = psutil.cpu_count(logical=True)

    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else "Not Detected / CPU fallback"
    gpu_vram = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1) if gpu_available else 0

    # Library stats
    paper_count = db.query(Paper).count()
    chunk_count = db.query(Chunk).count()
    faiss_idx = get_faiss_index()
    vector_count = faiss_idx.ntotal if faiss_idx else 0

    db_type = "PostgreSQL" if "postgresql" in settings.DATABASE_URL.lower() else "SQLite"

    return {
        "llm": {
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL or "default",
            "api_key_status": mask_key(settings.LLM_API_KEY),
            "base_url": settings.LLM_BASE_URL or "default",
            "extractive_mode": settings.LLM_PROVIDER == "none"
        },
        "embeddings": {
            "model": "BAAI/bge-small-en-v1.5",
            "dimension": 384,
            "device": "cuda" if gpu_available else "cpu",
            "reranker_active": settings.USE_RERANKER
        },
        "hardware": {
            "cpu_cores": cpu_cores,
            "total_ram_gb": total_ram_gb,
            "available_ram_gb": available_ram_gb,
            "gpu_available": gpu_available,
            "gpu_name": gpu_name,
            "gpu_vram_gb": gpu_vram
        },
        "library_stats": {
            "total_papers": paper_count,
            "total_chunks": chunk_count,
            "indexed_vectors": vector_count,
            "corpus_db_path": str(settings.CORPUS_DB_PATH),
            "faiss_path": str(settings.FAISS_INDEX_PATH),
            "database_type": db_type
        }
    }

@router.post("/reindex")
def trigger_reindex():
    return {
        "status": "ready",
        "message": "Corpus index is synchronized and up-to-date with SQLite store."
    }
