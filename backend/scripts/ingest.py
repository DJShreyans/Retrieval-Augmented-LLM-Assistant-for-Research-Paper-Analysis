import sys
import os
import argparse
import random
from pathlib import Path
from typing import Dict, Any, List, Optional
import fitz
from tqdm import tqdm

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.config import settings, ROOT_DIR
from backend.app.storage import get_storage
from backend.app.db import SessionLocal
from backend.app.models import Paper, Chunk
from backend.app.corpus_db import get_corpus_connection, init_corpus_db
from backend.app.services.pdf_extract import compute_sha256, extract_pdf_data, generate_thumbnail
from backend.app.services.chunking import chunk_pages

def process_single_pdf(storage, key: str) -> Dict[str, Any]:
    """Process a single PDF from storage: metadata, thumbnail, chunking."""
    try:
        # Check file size
        try:
            size_bytes = storage.get_file_size(key)
        except Exception:
            size_bytes = 0

        # Read stream
        with storage.open(key) as f:
            pdf_bytes = f.read()

        if len(pdf_bytes) < 100:
            return {"key": key, "status": "failed", "reason": "Corrupt or empty file"}

        # Check PDF header magic bytes
        if not pdf_bytes.startswith(b"%PDF-"):
            return {"key": key, "status": "failed", "reason": "Not a valid PDF file (missing %PDF- header)"}

        file_hash = compute_sha256(pdf_bytes)

        # Open with PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pdf_data = extract_pdf_data(doc, filename=key)

        # Generate chunks if text is present
        chunks = []
        if pdf_data["has_text"]:
            chunks = chunk_pages(pdf_data["pages_text"])

        return {
            "key": key,
            "status": "ok",
            "file_hash": file_hash,
            "title": pdf_data["title"],
            "authors": pdf_data["authors"],
            "abstract": pdf_data["abstract"],
            "year": pdf_data["year"],
            "page_count": pdf_data["page_count"],
            "has_text": pdf_data["has_text"],
            "text_quality": pdf_data["text_quality"],
            "chunks": chunks,
            "doc": doc
        }
    except Exception as e:
        return {"key": key, "status": "failed", "reason": str(e)}

def run_ingestion(limit: Optional[int] = None, max_workers: int = 3):
    init_corpus_db()
    storage = get_storage()

    print(f"\n[Ingest] Scanning storage ({settings.PDF_SOURCE})...")
    all_keys = storage.list_keys()
    print(f"[Ingest] Found {len(all_keys)} PDF files.")

    if limit and limit > 0:
        target_keys = all_keys[:limit]
        print(f"[Ingest] Limiting to first {limit} papers for testing.")
    else:
        target_keys = all_keys

    app_db = SessionLocal()
    corpus_conn = get_corpus_connection()

    # Preload existing hashes to avoid redundant work
    existing_hashes = set(r[0] for r in app_db.query(Paper.file_hash).all())
    print(f"[Ingest] Found {len(existing_hashes)} already ingested papers in DB.")

    stats = {
        "found": len(target_keys),
        "ok": 0,
        "no_text": 0,
        "failed": [],
        "skipped": 0,
        "total_pages": 0,
        "total_chunks": 0,
        "ingested_papers": []
    }

    try:
        with tqdm(total=len(target_keys), desc="Ingesting PDFs") as pbar:
            for key in target_keys:
                res = process_single_pdf(storage, key)
                pbar.update(1)

                if res["status"] != "ok":
                    stats["failed"].append((key, res.get("reason", "Unknown error")))
                    continue

                f_hash = res["file_hash"]
                if f_hash in existing_hashes:
                    stats["skipped"] += 1
                    continue

                # Add to App DB
                new_paper = Paper(
                    title=res["title"],
                    authors=res["authors"],
                    abstract=res["abstract"],
                    year=res["year"],
                    file_path=key,
                    file_hash=f_hash,
                    page_count=res["page_count"],
                    has_text=res["has_text"],
                    text_quality=res["text_quality"],
                    source=settings.PDF_SOURCE,
                    visibility="shared",
                    storage_key=key,
                    status="ready"
                )
                app_db.add(new_paper)
                app_db.flush()

                # Generate thumbnail using paper ID
                if "doc" in res and res["doc"]:
                    generate_thumbnail(res["doc"], new_paper.id)
                    res["doc"].close()

                # Save chunks in App DB and Corpus DB
                chunks_to_add = res["chunks"]
                corpus_cur = corpus_conn.cursor()

                # Insert paper into corpus_papers
                corpus_cur.execute("""
                INSERT OR REPLACE INTO corpus_papers(id, title, authors, abstract, year, file_hash, file_path, page_count, has_text, text_quality, storage_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_paper.id, new_paper.title, new_paper.authors, new_paper.abstract,
                    new_paper.year, new_paper.file_hash, new_paper.file_path,
                    new_paper.page_count, new_paper.has_text, new_paper.text_quality,
                    new_paper.storage_key
                ))

                for ch in chunks_to_add:
                    chunk_obj = Chunk(
                        paper_id=new_paper.id,
                        page_start=ch["page_start"],
                        page_end=ch["page_end"],
                        section_hint=ch["section_hint"],
                        text=ch["text"],
                        n_tokens=ch["n_tokens"],
                        is_reference=ch["is_reference"]
                    )
                    app_db.add(chunk_obj)
                    app_db.flush()

                    # Insert into corpus_chunks
                    corpus_cur.execute("""
                    INSERT INTO corpus_chunks(id, paper_id, page_start, page_end, section_hint, text, n_tokens, is_reference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        chunk_obj.id, chunk_obj.paper_id, chunk_obj.page_start,
                        chunk_obj.page_end, chunk_obj.section_hint, chunk_obj.text,
                        chunk_obj.n_tokens, chunk_obj.is_reference
                    ))

                    # Insert into chunks_fts
                    corpus_cur.execute("""
                    INSERT INTO chunks_fts(chunk_id, paper_id, section_hint, text)
                    VALUES (?, ?, ?, ?)
                    """, (
                        str(chunk_obj.id), str(new_paper.id),
                        chunk_obj.section_hint or "", chunk_obj.text
                    ))

                app_db.commit()
                corpus_conn.commit()
                existing_hashes.add(f_hash)

                if res["has_text"]:
                    stats["ok"] += 1
                else:
                    stats["no_text"] += 1

                stats["total_pages"] += res["page_count"]
                stats["total_chunks"] += len(chunks_to_add)
                stats["ingested_papers"].append({
                    "id": new_paper.id,
                    "title": new_paper.title,
                    "abstract": new_paper.abstract[:200] if new_paper.abstract else "(No abstract detected)"
                })
    finally:
        app_db.close()
        corpus_conn.close()

    print_quality_report(stats)
    return stats

def print_quality_report(stats: Dict[str, Any]):
    print("\n" + "=" * 70)
    print("                  RESEARCHMATE INGESTION QUALITY REPORT")
    print("=" * 70)
    print(f" Papers Evaluated:    {stats['found']}")
    print(f" Successfully Parsed: {stats['ok']}")
    print(f" Already Ingested:    {stats['skipped']}")
    print(f" Scanned / No-Text:   {stats['no_text']}")
    print(f" Failed to Process:   {len(stats['failed'])}")
    print(f" Total Pages:         {stats['total_pages']}")
    print(f" Total Chunks:        {stats['total_chunks']}")
    avg_chunks = (stats['total_chunks'] / stats['ok']) if stats['ok'] > 0 else 0
    print(f" Avg Chunks / Paper:  {avg_chunks:.1f}")

    if stats["failed"]:
        print("\n--- Failure Samples (up to 5) ---")
        for k, reason in stats["failed"][:5]:
            print(f"  * {k}: {reason}")

    papers_to_show = stats["ingested_papers"]
    if not papers_to_show:
        try:
            conn = get_corpus_connection()
            cur = conn.cursor()
            cur.execute("SELECT id, title, abstract FROM corpus_papers ORDER BY RANDOM() LIMIT 10")
            papers_to_show = [{"id": r[0], "title": r[1], "abstract": (r[2][:200] if r[2] else "(No abstract)")} for r in cur.fetchall()]
            conn.close()
        except Exception:
            pass

    if papers_to_show:
        print("\n--- 10 Random Parsed Papers for Eyeball Verification ---")
        sample_size = min(10, len(papers_to_show))
        sample_papers = papers_to_show[:sample_size]
        for idx, p in enumerate(sample_papers, 1):
            clean_title = p['title'].encode("ascii", "replace").decode("ascii")
            clean_abs = p['abstract'].encode("ascii", "replace").decode("ascii")
            print(f"\n[{idx}] ID {p['id']}: {clean_title}")
            print(f"    Abstract: {clean_abs}...")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Ingest PDFs into ResearchMate")
    parser.add_argument("--limit", type=int, default=None, help="Max number of PDFs to process")
    parser.add_argument("--workers", type=int, default=3, help="Worker count")
    args = parser.parse_args()

    run_ingestion(limit=args.limit, max_workers=args.workers)
