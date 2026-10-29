from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.db import get_db
from backend.app.models import User
from backend.app.auth import get_current_user_optional
from backend.app.services.litreview import generate_lit_review

router = APIRouter(prefix="/litreview", tags=["Literature Review"])

class LitReviewRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)

@router.post("")
def create_lit_review(
    req: LitReviewRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else 1
    review = generate_lit_review(topic=req.topic, db=db, user_id=user_id)
    return review
