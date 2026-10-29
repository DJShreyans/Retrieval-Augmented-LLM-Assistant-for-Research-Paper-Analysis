import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.config import ROOT_DIR, settings
from backend.app.db import SessionLocal
from backend.app.models import Paper, Chunk, Job, Tag, PaperTag
from backend.app.services.pdf_extract import compute_sha256, extract_pdf_metadata
from backend.app.services.chunking import chunk_document
from backend.app.services.embeddings import embed_passages
from backend.app.services.index import add_to_index
from backend.app.corpus_db import insert_corpus_paper, insert_corpus_chunks

UPLOAD_DIR = ROOT_DIR / "data" / "papers"
THUMBNAILS_DIR = ROOT_DIR / "data" / "thumbnails"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

def process_upload_draft(file_bytes: bytes, filename: str, db: Session) -> Dict[str, Any]:
    """Saves uploaded PDF temporarily and extracts draft metadata for user review."""
    sha256 = compute_sha256(file_bytes)

    # Check for duplicate
    existing = db.query(Paper).filter(Paper.file_hash == sha256).first()
    if existing:
        return {
            "status": "duplicate",
            "message": "Paper already exists in library",
            "paper_id": existing.id,
            "title": existing.title,
            "file_hash": sha256
        }

    # Save PDF file to upload directory
    saved_filename = f"{sha256}.pdf"
    file_path = UPLOAD_DIR / saved_filename
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Extract metadata and thumbnail
    thumb_path = THUMBNAILS_DIR / f"{sha256}.png"
    meta = extract_pdf_metadata(file_bytes, thumbnail_path=thumb_path)

    return {
        "status": "draft",
        "file_hash": sha256,
        "filename": filename,
        "storage_key": f"data/papers/{saved_filename}",
        "title": meta.get("title"),
        "authors": meta.get("authors"),
        "abstract": meta.get("abstract"),
        "year": meta.get("year"),
        "page_count": meta.get("page_count", 0),
        "has_text": meta.get("has_text", True),
        "text_quality": meta.get("text_quality", "good"),
        "thumbnail_url": f"/api/thumbnails/{sha256}.png"
    }

def run_indexing_task(job_id: int, paper_id: int):
    """Background worker task that chunks, embeds, indexes, and tags the paper."""
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if not job or not paper:
            return

        job.status = "running"
        job.progress = 0.15
        db.commit()

        # 1. Read PDF file and extract pages
        pdf_file = ROOT_DIR / paper.storage_key
        if not pdf_file.exists():
            pdf_file = Path(paper.file_path)

        with open(pdf_file, "rb") as f:
            pdf_bytes = f.read()

        thumb_target = THUMBNAILS_DIR / f"{paper.id}.png"
        meta = extract_pdf_metadata(pdf_bytes, thumbnail_path=thumb_target)

        # 2. Chunk document
        chunks_data = chunk_document(meta["pages"])
        job.progress = 0.35
        db.commit()

        # 3. Save chunks to SQLite database
        saved_chunks = []
        for c in chunks_data:
            chunk_rec = Chunk(
                paper_id=paper.id,
                page_start=c["page_start"],
                page_end=c["page_end"],
                section_hint=c.get("section_hint"),
                text=c["text"],
                n_tokens=c["n_tokens"],
                is_reference=c["is_reference"]
            )
            db.add(chunk_rec)
            saved_chunks.append(chunk_rec)

        db.commit()
        for sc in saved_chunks:
            db.refresh(sc)

        job.progress = 0.55
        db.commit()

        # 4. Insert chunks into Corpus SQLite DB for BM25 FTS5
        insert_corpus_paper({
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "abstract": paper.abstract,
            "year": paper.year,
            "file_hash": paper.file_hash,
            "file_path": paper.file_path,
            "page_count": paper.page_count,
            "has_text": paper.has_text,
            "text_quality": paper.text_quality,
            "storage_key": paper.storage_key
        })

        corpus_chunk_dicts = [
            {
                "id": sc.id,
                "paper_id": paper.id,
                "page_start": sc.page_start,
                "page_end": sc.page_end,
                "section_hint": sc.section_hint,
                "text": sc.text,
                "n_tokens": sc.n_tokens,
                "is_reference": sc.is_reference,
                "faiss_id": sc.faiss_id
            }
            for sc in saved_chunks
        ]
        insert_corpus_chunks(corpus_chunk_dicts)

        job.progress = 0.70
        db.commit()

        # 5. Embed non-reference chunks and insert into FAISS
        retrieval_chunks = [sc for sc in saved_chunks if not sc.is_reference]
        if retrieval_chunks:
            texts = [rc.text for rc in retrieval_chunks]
            embeddings = embed_passages(texts, batch_size=16)
            start_faiss_id = add_to_index(embeddings)

            for idx, rc in enumerate(retrieval_chunks):
                rc.faiss_id = start_faiss_id + idx
            db.commit()

        job.progress = 0.85
        db.commit()

        # 6. Assign topic tag
        default_tag = db.query(Tag).first()
        if default_tag:
            pt = PaperTag(paper_id=paper.id, tag_id=default_tag.id)
            db.add(pt)
            db.commit()

        # 7. Complete job
        paper.status = "ready"
        job.status = "completed"
        job.progress = 1.0
        db.commit()

    except Exception as e:
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error = str(e)
            db.commit()
    finally:
        db.close()
