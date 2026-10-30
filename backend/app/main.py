from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.routers import (
    health, auth, search, chat, papers, compare, dashboard, litreview, gaps, settings as settings_router
)

app = FastAPI(
    title="ResearchMate API",
    description="AI-Powered Research Intelligence Platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(papers.router)
app.include_router(compare.router)
app.include_router(dashboard.router)
app.include_router(litreview.router)
app.include_router(gaps.router)
app.include_router(settings_router.router)

@app.get("/")
def root():
    return {
        "message": "ResearchMate API is active",
        "docs": "/docs",
        "health": "/health"
    }
