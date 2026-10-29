from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db import get_db
from backend.app.auth import get_current_user_optional
from backend.app.models import User
from backend.app.services.retrieval import hybrid_search

router = APIRouter(prefix="/search", tags=["Search"])

class SearchRequest(BaseModel):
    query: str
    top_k: int = 8
    paper_id: Optional[int] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    tag_id: Optional[int] = None

class SearchResultItem(BaseModel):
    id: int
    paper_id: int
    title: str
    year: Optional[int] = None
    page_start: int
    page_end: int
    section_hint: Optional[str] = None
    text: str
    score: float

class SearchResponse(BaseModel):
    query: str
    total: int
    results: List[SearchResultItem]

@router.post("", response_model=SearchResponse)
def search_corpus(
    req: SearchRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else None
    passages = hybrid_search(
        query=req.query,
        top_k=req.top_k,
        paper_id=req.paper_id,
        year_start=req.year_start,
        year_end=req.year_end,
        tag_id=req.tag_id,
        user_id=user_id
    )

    items = [
        SearchResultItem(
            id=p["id"],
            paper_id=p["paper_id"],
            title=p["title"],
            year=p.get("year"),
            page_start=p["page_start"],
            page_end=p["page_end"],
            section_hint=p.get("section_hint"),
            text=p["text"],
            score=round(p.get("score", 0.0), 4)
        )
        for p in passages
    ]

    return SearchResponse(query=req.query, total=len(items), results=items)
