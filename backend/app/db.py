from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings, ROOT_DIR

# Ensure data directory exists
data_dir = ROOT_DIR / "data"
data_dir.mkdir(parents=True, exist_ok=True)

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure driver compatibility between psycopg v3 and psycopg2
if db_url.startswith("postgresql://") and "+" not in db_url.split("://")[0]:
    try:
        import psycopg
    except ImportError:
        try:
            import psycopg2
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        except ImportError:
            pass

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
