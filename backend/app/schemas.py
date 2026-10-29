from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, ConfigDict

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "user"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class GoogleAuthRequest(BaseModel):
    credential: str

class PaperResponse(BaseModel):
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
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CitationItem(BaseModel):
    n: int
    paper_id: int
    title: str
    year: Optional[int] = None
    page: int
    quote: str

class ChatMessageCreate(BaseModel):
    content: str
    scope: str = "library"  # 'paper' | 'library'
    paper_id: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    llm_provider: str
    pdf_source: str
    database: str
    reranker_enabled: bool
