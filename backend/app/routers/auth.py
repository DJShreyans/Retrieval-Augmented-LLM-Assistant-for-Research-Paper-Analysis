from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from backend.app.db import get_db
from backend.app.models import User, RefreshToken
from backend.app.config import settings
from backend.app.security import (
    hash_password, verify_password, hash_token, create_access_token, create_refresh_token, decode_token
)
from backend.app.auth import get_current_user, verify_google_id_token
from backend.app.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=None if settings.COOKIE_DOMAIN == "localhost" else settings.COOKIE_DOMAIN,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=None if settings.COOKIE_DOMAIN == "localhost" else settings.COOKIE_DOMAIN,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

@router.post("/register", response_model=UserResponse)
def register(req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    role = "admin" if req.email.lower() in settings.admin_emails_list else "user"
    user = User(
        email=req.email.lower(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name or req.email.split("@")[0].title(),
        role=role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_tok = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    refresh_tok = create_refresh_token({"sub": str(user.id)})

    # Store refresh token hash
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_tok),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    db.commit()

    set_auth_cookies(response, access_tok, refresh_tok)
    return user

@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    access_tok = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    refresh_tok = create_refresh_token({"sub": str(user.id)})

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_tok),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    db.commit()

    set_auth_cookies(response, access_tok, refresh_tok)
    return {
        "access_token": access_tok,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@router.post("/google")
def google_auth(req: GoogleLoginRequest, response: Response, db: Session = Depends(get_db)):
    id_info = verify_google_id_token(req.credential)
    google_sub = id_info["sub"]
    email = id_info.get("email", "").lower()
    name = id_info.get("name") or email.split("@")[0].title()

    user = db.query(User).filter((User.google_sub == google_sub) | (User.email == email)).first()
    if not user:
        role = "admin" if email in settings.admin_emails_list else "user"
        user = User(
            email=email,
            google_sub=google_sub,
            full_name=name,
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_sub:
            user.google_sub = google_sub
            db.commit()

    access_tok = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    refresh_tok = create_refresh_token({"sub": str(user.id)})

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_tok),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    db.commit()

    set_auth_cookies(response, access_tok, refresh_tok)
    return {
        "access_token": access_tok,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@router.post("/refresh")
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_tok = request.cookies.get("refresh_token")
    if not refresh_tok:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    payload = decode_token(refresh_tok)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    # Verify token exists and not expired in DB
    h = hash_token(refresh_tok)
    rt_record = db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.token_hash == h,
        RefreshToken.revoked.is_(False),
        RefreshToken.expires_at > datetime.utcnow()
    ).first()

    if not rt_record:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    new_access_tok = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    response.set_cookie(
        key="access_token",
        value=new_access_tok,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=None if settings.COOKIE_DOMAIN == "localhost" else settings.COOKIE_DOMAIN,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return {
        "access_token": new_access_tok,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token", domain=None if settings.COOKIE_DOMAIN == "localhost" else settings.COOKIE_DOMAIN)
    response.delete_cookie(key="refresh_token", domain=None if settings.COOKIE_DOMAIN == "localhost" else settings.COOKIE_DOMAIN)
    return {"message": "Logged out successfully"}
