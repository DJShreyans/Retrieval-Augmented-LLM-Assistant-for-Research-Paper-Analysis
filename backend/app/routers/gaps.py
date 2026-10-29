from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.gaps import mine_research_gaps, GAP_CLUSTERS

router = APIRouter(prefix="/gaps", tags=["Research Gaps & Ideas"])

@router.get("")
def list_research_gaps(db: Session = Depends(get_db)):
    """Returns clustered research gaps labeled as hypotheses for expert review."""
    return mine_research_gaps(db=db)

@router.get("/{gap_id}/idea")
def get_gap_study_idea(gap_id: int):
    """Returns AI-generated study outline for a specific research gap."""
    cluster = next((c for c in GAP_CLUSTERS if c["id"] == gap_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail="Research gap not found")

    return {
        "gap_id": cluster["id"],
        "gap_title": cluster["title"],
        "theme": cluster["theme"],
        "hypothesis": cluster["hypothesis"],
        "study_outline": cluster["study_outline"],
        "disclaimer": "AI-Generated Research Suggestions - For Expert Review Only"
    }
