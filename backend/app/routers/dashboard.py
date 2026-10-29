from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.db import get_db
from backend.app.models import Paper, Chunk, Chat, Tag, PaperTag, User
from backend.app.auth import get_current_user_optional

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    total_papers = db.query(Paper).count()
    total_chunks = db.query(Chunk).count()
    total_chats = db.query(Chat).count()

    # Topic distribution
    tag_counts = (
        db.query(Tag.name, func.count(PaperTag.id))
        .join(PaperTag, PaperTag.tag_id == Tag.id)
        .group_by(Tag.name)
        .order_by(desc(func.count(PaperTag.id)))
        .limit(8)
        .all()
    )
    topics = [{"name": name, "count": count} for name, count in tag_counts]

    # Recent additions
    recent = (
        db.query(Paper)
        .order_by(desc(Paper.added_at), desc(Paper.id))
        .limit(5)
        .all()
    )
    recent_papers = [
        {
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "year": p.year,
            "page_count": p.page_count,
            "added_at": p.added_at.strftime("%b %d, %Y") if p.added_at else "N/A"
        }
        for p in recent
    ]

    # Suggested papers (curated selection from top topics)
    suggested = (
        db.query(Paper)
        .filter(Paper.has_text.is_(True))
        .order_by(desc(Paper.page_count))
        .limit(4)
        .all()
    )
    suggested_papers = [
        {
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "year": p.year,
            "page_count": p.page_count,
            "thumbnail_url": f"/api/thumbnails/{p.id}.png"
        }
        for p in suggested
    ]

    # Recent chats
    recent_chats_q = db.query(Chat).order_by(desc(Chat.updated_at)).limit(4).all()
    recent_chats = [
        {
            "id": c.id,
            "title": c.title,
            "paper_id": c.paper_id,
            "updated_at": c.updated_at.strftime("%b %d, %H:%M") if c.updated_at else "N/A"
        }
        for c in recent_chats_q
    ]

    return {
        "total_papers": total_papers,
        "total_chunks": total_chunks,
        "total_chats": total_chats,
        "topics": topics,
        "recent_papers": recent_papers,
        "suggested_papers": suggested_papers,
        "recent_chats": recent_chats
    }
