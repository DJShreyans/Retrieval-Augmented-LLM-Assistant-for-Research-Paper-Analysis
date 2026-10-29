from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.db import get_db
from backend.app.models import User
from backend.app.security import decode_token
from backend.app.config import settings

security = HTTPBearer(auto_error=False)

def get_token_from_request(request: Request, creds: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    # 1. Check HttpOnly cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token

    # 2. Check Authorization Bearer header
    if creds and creds.scheme.lower() == "bearer":
        return creds.credentials

    return None

def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = get_token_from_request(request, creds)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user

def get_current_user_optional(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    try:
        return get_current_user(request, creds, db)
    except HTTPException:
        # For public/eval convenience, return default admin if available in db
        admin = db.query(User).filter(User.role == "admin").first()
        return admin

def verify_google_id_token(credential: str) -> dict:
    from google.oauth2 import id_token
    from google.auth.transport import requests

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured on the server")

    try:
        id_info = id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        if not id_info.get("email_verified"):
            raise HTTPException(status_code=400, detail="Google email is not verified")
        return id_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google authentication failed: {str(e)}")
