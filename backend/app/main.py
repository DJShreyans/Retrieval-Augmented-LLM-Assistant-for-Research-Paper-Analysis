from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.routers import health

app = FastAPI(
    title="ResearchMate API",
    description="AI-Powered Research Intelligence Platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)

@app.get("/")
def root():
    return {
        "message": "ResearchMate API is active",
        "docs": "/docs",
        "health": "/health"
    }
