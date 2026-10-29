import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db import get_db, SessionLocal
from backend.app.models import User, Chat, Message
from backend.app.auth import get_current_user_optional
from backend.app.services.rag import generate_rag_stream

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    scope: str = "library"  # 'library' | 'paper'
    paper_id: Optional[int] = None

class MessageItem(BaseModel):
    id: int
    sender: str
    content: str
    citations: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

class ChatDetailResponse(BaseModel):
    id: int
    title: str
    paper_id: Optional[int] = None
    created_at: datetime
    messages: List[MessageItem]

@router.post("")
def chat_endpoint(
    req: ChatRequest,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else 1  # Default to admin/first user for evaluation

    # 1. Resolve or create chat session
    if req.chat_id:
        chat = db.query(Chat).filter(Chat.id == req.chat_id, Chat.user_id == user_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        chat_title = req.message[:50].strip() + ("..." if len(req.message) > 50 else "")
        chat = Chat(
            user_id=user_id,
            paper_id=req.paper_id if req.scope == "paper" else None,
            title=chat_title
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    # 2. Save user message
    user_msg = Message(
        chat_id=chat.id,
        sender="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()

    # 3. Fetch recent history for multi-turn context
    history_msgs = (
        db.query(Message)
        .filter(Message.chat_id == chat.id)
        .order_by(Message.id.asc())
        .limit(6)
        .all()
    )
    history = [{"role": "assistant" if m.sender == "assistant" else "user", "content": m.content} for m in history_msgs[:-1]]

    # 4. Stream RAG response and persist assistant message on completion
    def stream_with_persistence():
        full_answer = ""
        citations = []

        # Yield chat_id first so frontend knows session ID
        yield f"data: {json.dumps({'chat_id': chat.id})}\n\n"

        for event in generate_rag_stream(
            query=req.message,
            scope=req.scope,
            paper_id=req.paper_id,
            history=history,
            user_id=user_id
        ):
            yield event
            # Check for completion event
            if event.startswith("data: "):
                try:
                    payload = json.loads(event[6:].strip())
                    if payload.get("done"):
                        full_answer = payload.get("full_answer", "")
                        citations = payload.get("citations", [])
                except Exception:
                    pass

        # Persist assistant message
        if full_answer:
            save_db = SessionLocal()
            try:
                asst_msg = Message(
                    chat_id=chat.id,
                    sender="assistant",
                    content=full_answer,
                    citations_json=json.dumps(citations) if citations else None
                )
                save_db.add(asst_msg)
                save_db.commit()
            finally:
                save_db.close()

    return StreamingResponse(stream_with_persistence(), media_type="text/event-stream")

@router.get("/history")
def get_chat_history(
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else 1
    chats = db.query(Chat).filter(Chat.user_id == user_id).order_by(Chat.updated_at.desc()).all()

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)

    grouped = {
        "today": [],
        "yesterday": [],
        "last_7_days": [],
        "older": []
    }

    for c in chats:
        item = {
            "id": c.id,
            "title": c.title,
            "paper_id": c.paper_id,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat()
        }
        if c.updated_at >= today_start:
            grouped["today"].append(item)
        elif c.updated_at >= yesterday_start:
            grouped["yesterday"].append(item)
        elif c.updated_at >= week_start:
            grouped["last_7_days"].append(item)
        else:
            grouped["older"].append(item)

    return grouped

@router.get("/{chat_id}", response_model=ChatDetailResponse)
def get_chat_detail(
    chat_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else 1
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.id.asc()).all()
    msg_items = []
    for m in messages:
        cits = json.loads(m.citations_json) if m.citations_json else []
        msg_items.append(MessageItem(
            id=m.id,
            sender=m.sender,
            content=m.content,
            citations=cits,
            created_at=m.created_at
        ))

    return ChatDetailResponse(
        id=chat.id,
        title=chat.title,
        paper_id=chat.paper_id,
        created_at=chat.created_at,
        messages=msg_items
    )

@router.delete("/{chat_id}")
def delete_chat(
    chat_id: int,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = user.id if user else 1
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted"}
