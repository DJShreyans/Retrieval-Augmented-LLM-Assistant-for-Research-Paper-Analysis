from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.db import get_db
from backend.app.models import Paper, User
from backend.app.auth import get_current_user_optional
from backend.app.services.extraction import extract_paper_records, ExtractionRecord
from backend.app.services.comparability import evaluate_comparability, build_aspect_matrix
from backend.app.services.summary import generate_paper_summary

router = APIRouter(prefix="/compare", tags=["Comparison"])

class CompareRequest(BaseModel):
    paper_ids: List[int] = Field(..., min_length=2, max_length=6)
    aspects: Optional[List[str]] = None

@router.get("/candidates")
def get_comparison_candidates(
    limit: int = Query(12, ge=2, le=30),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Returns candidate papers for the comparison picker."""
    query = db.query(Paper)
    if user:
        query = query.filter((Paper.visibility == "shared") | (Paper.owner_id == user.id))
    else:
        query = query.filter(Paper.visibility == "shared")

    papers = query.order_by(Paper.added_at.desc()).limit(limit).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "year": p.year,
            "page_count": p.page_count
        }
        for p in papers
    ]

@router.post("")
def compare_papers_endpoint(
    req: CompareRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Performs side-by-side aspect comparison and rule-based metric comparability evaluation
    across 2 to 6 selected papers.
    """
    if len(req.paper_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 papers to compare")
    if len(req.paper_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 papers can be compared simultaneously")

    papers = db.query(Paper).filter(Paper.id.in_(req.paper_ids)).all()
    if len(papers) < len(req.paper_ids):
        found_ids = {p.id for p in papers}
        missing = set(req.paper_ids) - found_ids
        raise HTTPException(status_code=404, detail=f"Papers not found: {missing}")

    all_records: List[ExtractionRecord] = []
    paper_extractions_map: Dict[int, List[ExtractionRecord]] = {}
    summary_map: Dict[int, Any] = {}

    for p in papers:
        # Extract or get cached records
        records = extract_paper_records(p.id, db=db, force_regenerate=False)
        all_records.extend(records)
        paper_extractions_map[p.id] = records

        # Summary
        summary = generate_paper_summary(p.id, db=db, force_regenerate=False)
        summary_map[p.id] = summary

    # Rule-based comparability
    comparability_result = evaluate_comparability(all_records)

    # Side-by-side aspect matrix
    aspect_matrix = build_aspect_matrix(papers, paper_extractions_map, summary_map)

    return {
        "papers": [
            {
                "id": p.id,
                "title": p.title,
                "authors": p.authors,
                "year": p.year,
                "page_count": p.page_count
            }
            for p in papers
        ],
        "aspect_matrix": aspect_matrix,
        "comparable_groups": comparability_result["comparable_groups"],
        "not_comparable_groups": comparability_result["not_comparable_groups"]
    }
