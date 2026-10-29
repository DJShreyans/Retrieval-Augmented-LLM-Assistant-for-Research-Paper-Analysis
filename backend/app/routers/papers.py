from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from pydantic import BaseModel

from backend.app.db import get_db
from backend.app.models import Paper, Tag, PaperTag, User
from backend.app.auth import get_current_user_optional
from backend.app.config import ROOT_DIR

router = APIRouter(tags=["Papers"])

THUMBNAILS_DIR = ROOT_DIR / "data" / "thumbnails"

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
        thumb_url = f"/api/thumbnails/{p.id}.png" if thumb_file.exists() else "/placeholder-paper.png"
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

    tags = (
        db.query(Tag.name)
        .join(PaperTag, PaperTag.tag_id == Tag.id)
        .filter(PaperTag.paper_id == paper.id)
        .all()
    )

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
        "added_at": paper.added_at.isoformat() if paper.added_at else None,
        "tags": [t[0] for t in tags],
        "thumbnail_url": f"/api/thumbnails/{paper.id}.png"
    }

@router.get("/thumbnails/{paper_id}.png")
def get_paper_thumbnail(paper_id: int):
    target = THUMBNAILS_DIR / f"{paper_id}.png"
    if not target.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(target, media_type="image/png")
