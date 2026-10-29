from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from pydantic import BaseModel

from backend.app.db import get_db
from backend.app.models import Paper, Tag, PaperTag, User, Job, Summary
from backend.app.auth import get_current_user_optional, get_current_user
from backend.app.config import ROOT_DIR, settings
from backend.app.services.summary import generate_paper_summary, extract_paper_references
from backend.app.services.ingest_job import process_upload_draft, run_indexing_task

router = APIRouter(tags=["Papers"])

THUMBNAILS_DIR = ROOT_DIR / "data" / "thumbnails"
UPLOAD_DIR = ROOT_DIR / "data" / "papers"

class TagResponse(BaseModel):
    id: int
    name: str

class PaperItemResponse(BaseModel):
    id: int
    title: str
    authors: Optional[str] = None
    abstract: Optional[str] = None
    year: Optional[int] = None
    page_count: int
    has_text: bool
    text_quality: str
    source: str
    visibility: str
    status: str
    added_at: str
    thumbnail_url: str
    tags: List[str]

class PaperListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    papers: List[PaperItemResponse]

class ConfirmUploadRequest(BaseModel):
    file_hash: str
    title: str
    authors: Optional[str] = None
    abstract: Optional[str] = None
    year: Optional[int] = None
    visibility: str = "shared"  # 'shared' | 'private'

@router.get("/papers", response_model=PaperListResponse)
def list_papers(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    sort_by: str = Query("newest", pattern="^(newest|oldest|title|year)$"),
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else None
    query = db.query(Paper)

    # Visibility filter
    if user_id:
        query = query.filter((Paper.visibility == "shared") | (Paper.owner_id == user_id))
    else:
        query = query.filter(Paper.visibility == "shared")

    # Tag filter
    if tag_id:
        query = query.join(PaperTag, PaperTag.paper_id == Paper.id).filter(PaperTag.tag_id == tag_id)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((Paper.title.ilike(term)) | (Paper.authors.ilike(term)) | (Paper.abstract.ilike(term)))

    total = query.count()

    # Sort
    if sort_by == "newest":
        query = query.order_by(desc(Paper.added_at), desc(Paper.id))
    elif sort_by == "oldest":
        query = query.order_by(asc(Paper.added_at), asc(Paper.id))
    elif sort_by == "title":
        query = query.order_by(asc(Paper.title))
    elif sort_by == "year":
        query = query.order_by(desc(Paper.year), desc(Paper.id))

    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    # Gather tags for returned papers
    paper_ids = [p.id for p in records]
    pt_rows = (
        db.query(PaperTag.paper_id, Tag.name)
        .join(Tag, Tag.id == PaperTag.tag_id)
        .filter(PaperTag.paper_id.in_(paper_ids))
        .all()
    ) if paper_ids else []

    tag_map: Dict[int, List[str]] = {}
    for pid, tname in pt_rows:
        tag_map.setdefault(pid, []).append(tname)

    items = []
    for p in records:
        thumb_file = THUMBNAILS_DIR / f"{p.id}.png"
        thumb_url = f"/api/thumbnails/{p.id}.png" if thumb_file.exists() else f"/api/thumbnails/{p.file_hash}.png"
        items.append(PaperItemResponse(
            id=p.id,
            title=p.title,
            authors=p.authors,
            abstract=p.abstract,
            year=p.year,
            page_count=p.page_count,
            has_text=p.has_text,
            text_quality=p.text_quality,
            source=p.source,
            visibility=p.visibility,
            status=p.status,
            added_at=p.added_at.strftime("%b %d, %Y") if p.added_at else "N/A",
            thumbnail_url=thumb_url,
            tags=tag_map.get(p.id, ["AI / Machine Learning"])
        ))

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaperListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        papers=items
    )

@router.get("/papers/tags", response_model=List[TagResponse])
def get_paper_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).order_by(Tag.name.asc()).all()
    return [TagResponse(id=t.id, name=t.name) for t in tags]

@router.get("/papers/{paper_id}")
def get_paper_detail(
    paper_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.visibility == "private" and (not user or user.id != paper.owner_id):
        raise HTTPException(status_code=403, detail="Access denied to private paper")

    tags = (
        db.query(Tag.name)
        .join(PaperTag, PaperTag.tag_id == Tag.id)
        .filter(PaperTag.paper_id == paper.id)
        .all()
    )

    thumb_file = THUMBNAILS_DIR / f"{paper.id}.png"
    thumb_url = f"/api/thumbnails/{paper.id}.png" if thumb_file.exists() else f"/api/thumbnails/{paper.file_hash}.png"

    return {
        "id": paper.id,
        "title": paper.title,
        "authors": paper.authors,
        "abstract": paper.abstract,
        "year": paper.year,
        "page_count": paper.page_count,
        "has_text": paper.has_text,
        "text_quality": paper.text_quality,
        "visibility": paper.visibility,
        "status": paper.status,
        "added_at": paper.added_at.isoformat() if paper.added_at else None,
        "tags": [t[0] for t in tags],
        "thumbnail_url": thumb_url
    }

@router.get("/papers/{paper_id}/pdf")
def get_paper_pdf(
    paper_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.visibility == "private" and (not user or user.id != paper.owner_id):
        raise HTTPException(status_code=403, detail="Access denied to private paper")

    target_path = ROOT_DIR / paper.storage_key
    if not target_path.exists():
        if paper.file_path:
            target_path = Path(paper.file_path)

    if not target_path.exists():
        raise HTTPException(status_code=404, detail="PDF binary file not found on disk")

    return FileResponse(
        target_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={paper.id}.pdf"}
    )

@router.get("/papers/{paper_id}/summary")
def get_paper_summary_endpoint(
    paper_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.visibility == "private" and (not user or user.id != paper.owner_id):
        raise HTTPException(status_code=403, detail="Access denied to private paper")

    try:
        summary = generate_paper_summary(paper_id, db=db, force_regenerate=False)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/papers/{paper_id}/summary")
def regenerate_paper_summary_endpoint(
    paper_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.visibility == "private" and (not user or user.id != paper.owner_id):
        raise HTTPException(status_code=403, detail="Access denied to private paper")

    try:
        summary = generate_paper_summary(paper_id, db=db, force_regenerate=True)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/papers/{paper_id}/references")
def get_paper_references_endpoint(
    paper_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.visibility == "private" and (not user or user.id != paper.owner_id):
        raise HTTPException(status_code=403, detail="Access denied to private paper")
    return extract_paper_references(paper_id, db)

@router.post("/papers/upload")
async def upload_paper_endpoint(
    file: UploadFile = File(...),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Empty or corrupted PDF file")

    draft = process_upload_draft(file_bytes=content, filename=file.filename, db=db)
    return draft

@router.post("/papers/confirm")
def confirm_upload_endpoint(
    req: ConfirmUploadRequest,
    background_tasks: BackgroundTasks,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    # Check if duplicate exists
    existing = db.query(Paper).filter(Paper.file_hash == req.file_hash).first()
    if existing:
        return {"paper_id": existing.id, "job_id": None, "status": "exists"}

    user_id = user.id if user else 1
    pdf_filename = f"{req.file_hash}.pdf"
    storage_key = f"data/papers/{pdf_filename}"
    file_path = UPLOAD_DIR / pdf_filename

    if not file_path.exists():
        raise HTTPException(status_code=400, detail="Uploaded file draft expired or not found")

    # Create Paper record
    paper = Paper(
        title=req.title.strip() or "Untitled Paper",
        authors=req.authors.strip() if req.authors else None,
        abstract=req.abstract.strip() if req.abstract else None,
        year=req.year,
        file_path=str(file_path),
        file_hash=req.file_hash,
        page_count=0,
        has_text=True,
        text_quality="good",
        source="upload",
        visibility=req.visibility,
        owner_id=user_id,
        storage_key=storage_key,
        status="indexing"
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # Create Job record
    job = Job(
        user_id=user_id,
        type="ingest_and_index",
        status="queued",
        progress=0.0
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Launch background indexing
    background_tasks.add_task(run_indexing_task, job_id=job.id, paper_id=paper.id)

    return {
        "paper_id": paper.id,
        "job_id": job.id,
        "status": "indexing"
    }

@router.get("/jobs/{job_id}")
def get_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "progress": round(job.progress * 100, 1),
        "error": job.error
    }

@router.get("/thumbnails/{thumb_name}")
def get_thumbnail_file(thumb_name: str):
    target = THUMBNAILS_DIR / thumb_name
    if not target.exists():
        # Fallback to id or hash without extension
        clean_name = thumb_name.replace(".png", "")
        fallback = THUMBNAILS_DIR / f"{clean_name}.png"
        if fallback.exists():
            return FileResponse(fallback, media_type="image/png")
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(target, media_type="image/png")
