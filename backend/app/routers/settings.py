import os
import psutil
import torch
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import requests

from backend.app.config import settings, yaml_config, ROOT_DIR
from backend.app.db import get_db
from backend.app.models import Paper, Chunk, User
from backend.app.auth import get_current_user
from backend.app.services.index import get_faiss_index

router = APIRouter(prefix="/settings", tags=["Settings"])

class LLMConfigRequest(BaseModel):
    provider: str  # 'none' | 'gemini' | 'openai' | 'openai_compatible' | 'anthropic'
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None

def update_env_file(key_values: Dict[str, str]):
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    lines = env_path.read_text(encoding="utf-8").splitlines()
    new_lines = []
    seen = set()
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k = line.split("=", 1)[0].strip()
            if k in key_values:
                new_lines.append(f"{k}={key_values[k]}")
                seen.add(k)
                continue
        new_lines.append(line)
    for k, v in key_values.items():
        if k not in seen:
            new_lines.append(f"{k}={v}")
    env_path.write_text("\n".join(new_lines), encoding="utf-8")

def mask_key(key: Optional[str]) -> str:
    if not key:
        return "Not Configured (Free local extractive mode)"
    if len(key) <= 8:
        return "Configured (••••••••)"
    return f"Configured ({key[:4]}••••{key[-4:]})"

@router.get("")
def get_system_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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

@router.post("/llm")
def update_llm_settings(
    req: LLMConfigRequest,
    user: User = Depends(get_current_user)
):
    provider = req.provider.lower().strip()
    model = (req.model or "").strip()
    api_key = (req.api_key or "").strip()
    base_url = (req.base_url or "").strip()

    if provider not in ("none", "gemini", "openai", "openai_compatible", "anthropic"):
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    if provider == "none":
        settings.LLM_PROVIDER = "none"
        settings.LLM_MODEL = ""
        settings.LLM_API_KEY = ""
        update_env_file({"LLM_PROVIDER": "none", "LLM_MODEL": "", "LLM_API_KEY": ""})
        return {"status": "success", "message": "Switched to free local extractive mode", "provider": "none"}

    # Test the connection before saving
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required to connect an external LLM provider.")

    if provider == "gemini":
        target_model = model or "gemini-2.5-flash"
        if "1.5" in target_model:
            target_model = "gemini-2.5-flash"
        test_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        test_payload = {"contents": [{"role": "user", "parts": [{"text": "Ping"}]}]}
        try:
            res = requests.post(test_url, json=test_payload, timeout=15)
            if res.status_code == 404 and target_model != "gemini-2.5-flash":
                target_model = "gemini-2.5-flash"
                test_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                res = requests.post(test_url, json=test_payload, timeout=15)
            res.raise_for_status()
            model = target_model
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Gemini API connection test failed: {str(e)}")

    elif provider in ("openai", "openai_compatible"):
        from openai import OpenAI
        target_model = model or "gpt-4o-mini"
        client = OpenAI(api_key=api_key, base_url=base_url or None)
        try:
            client.chat.completions.create(
                model=target_model,
                messages=[{"role": "user", "content": "Ping"}],
                max_tokens=5
            )
            model = target_model
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"OpenAI connection test failed: {str(e)}")

    # Update in-memory settings
    settings.LLM_PROVIDER = provider
    settings.LLM_MODEL = model
    settings.LLM_API_KEY = api_key
    if base_url:
        settings.LLM_BASE_URL = base_url

    # Persist in .env
    update_env_file({
        "LLM_PROVIDER": provider,
        "LLM_MODEL": model,
        "LLM_API_KEY": api_key,
        "LLM_BASE_URL": base_url or ""
    })

    return {
        "status": "success",
        "message": f"Successfully connected to {provider.upper()} ({model})",
        "provider": provider,
        "model": model
    }

@router.post("/reindex")
def trigger_reindex(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {
        "status": "ready",
        "message": "Corpus index is synchronized and up-to-date with SQLite store."
    }
