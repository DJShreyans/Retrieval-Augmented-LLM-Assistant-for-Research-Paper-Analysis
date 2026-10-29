import os
from pathlib import Path
from typing import Optional, List
import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        extra="ignore"
    )
    # LLM
    LLM_PROVIDER: str = "none"
    LLM_MODEL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: Optional[str] = None

    # PDF Storage
    PDF_SOURCE: str = "local"
    PDF_DIR: str = str(ROOT_DIR)
    R2_ENDPOINT: Optional[str] = None
    R2_BUCKET: Optional[str] = None
    R2_PREFIX: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None

    # Databases
    DATABASE_URL: str = "sqlite:///./data/app.db"
    CORPUS_DB_PATH: str = "./data/corpus.db"
    FAISS_INDEX_PATH: str = "./data/faiss/index.faiss"
    THUMBNAILS_DIR: str = "./data/thumbnails"
    CACHE_DIR: str = "./data/cache"

    # Security & Auth
    GOOGLE_CLIENT_ID: Optional[str] = None
    JWT_SECRET: str = "default_dev_secret_key_antigravity_researchmate"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    COOKIE_DOMAIN: str = "localhost"
    COOKIE_SECURE: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ADMIN_EMAILS: str = "admin@example.com"
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # Search & Acceleration
    USE_RERANKER: bool = False
    DEVICE: str = "cpu"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def admin_emails_list(self) -> List[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]



settings = Settings()

def load_yaml_config() -> dict:
    yaml_path = ROOT_DIR / "config.yaml"
    if yaml_path.exists():
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}

yaml_config = load_yaml_config()
