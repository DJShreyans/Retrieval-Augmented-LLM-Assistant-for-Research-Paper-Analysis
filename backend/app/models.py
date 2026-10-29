from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, Index, func
)
from sqlalchemy.orm import relationship
from backend.app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    google_sub = Column(String(255), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="user", nullable=False)  # 'user' | 'admin'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    papers = relationship("Paper", back_populates="owner")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="user")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(500), nullable=False, index=True)
    authors = Column(Text, nullable=True)
    abstract = Column(Text, nullable=True)
    year = Column(Integer, nullable=True, index=True)
    file_path = Column(String(1000), nullable=True)
    file_hash = Column(String(64), unique=True, index=True, nullable=False)
    page_count = Column(Integer, default=0, nullable=False)
    has_text = Column(Boolean, default=True, nullable=False)
    text_quality = Column(String(50), default="good", nullable=False)  # 'good' | 'poor' | 'ocr_needed'
    source = Column(String(50), default="local", nullable=False)  # 'local' | 'r2' | 'upload'
    visibility = Column(String(50), default="shared", index=True, nullable=False)  # 'shared' | 'private'
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    storage_key = Column(String(1000), nullable=False)
    status = Column(String(50), default="ready", index=True, nullable=False)  # 'pending' | 'indexing' | 'ready' | 'error'
    added_at = Column(DateTime, server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="papers")
    chunks = relationship("Chunk", back_populates="paper", cascade="all, delete-orphan")
    tags = relationship("PaperTag", back_populates="paper", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="paper", cascade="all, delete-orphan")
    extractions = relationship("Extraction", back_populates="paper", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    page_start = Column(Integer, nullable=False)
    page_end = Column(Integer, nullable=False)
    section_hint = Column(String(255), nullable=True)
    text = Column(Text, nullable=False)
    n_tokens = Column(Integer, default=0, nullable=False)
    is_reference = Column(Boolean, default=False, index=True, nullable=False)
    faiss_id = Column(Integer, nullable=True, index=True)

    paper = relationship("Paper", back_populates="chunks")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    papers = relationship("PaperTag", back_populates="tag", cascade="all, delete-orphan")


class PaperTag(Base):
    __tablename__ = "paper_tags"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False, index=True)

    paper = relationship("Paper", back_populates="tags")
    tag = relationship("Tag", back_populates="papers")

    __table_args__ = (
        Index("idx_paper_tag", "paper_id", "tag_id", unique=True),
    )


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), default="New Chat", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(50), nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    citations_json = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    chat = relationship("Chat", back_populates="messages")


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    content_json = Column(Text, nullable=False)  # Structured JSON summary
    model = Column(String(100), default="none", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    paper = relationship("Paper", back_populates="summaries")


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    content_json = Column(Text, nullable=False)  # JSON records for comparison
    model = Column(String(100), default="none", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    paper = relationship("Paper", back_populates="extractions")


class LLMCall(Base):
    __tablename__ = "llm_calls"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    purpose = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    latency_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(String(100), nullable=False, index=True)  # 'ingest' | 'embed' | 'summary' | 'litreview'
    status = Column(String(50), default="queued", index=True, nullable=False)  # 'queued' | 'running' | 'completed' | 'failed'
    progress = Column(Float, default=0.0, nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="jobs")
