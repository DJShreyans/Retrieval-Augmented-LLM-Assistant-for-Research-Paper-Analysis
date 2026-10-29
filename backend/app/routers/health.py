from fastapi import APIRouter
from backend.app.config import settings
from backend.app.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", response_model=HealthResponse)
def get_health():
    db_type = "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"
    return HealthResponse(
        status="ok",
        llm_provider=settings.LLM_PROVIDER,
        pdf_source=settings.PDF_SOURCE,
        database=db_type,
        reranker_enabled=settings.USE_RERANKER
    )
