# ResearchMate

AI-Powered Research Intelligence Platform designed to transform how researchers, students, and academics interact with scientific literature.

## Features
- **Extractive & LLM-Powered Exploration**: Operates in full extractive mode (`LLM_PROVIDER=none`) and seamlessly connects with OpenAI, Anthropic, Gemini, or custom OpenAI-compatible models.
- **Hybrid Search**: BM25 (SQLite FTS5) + Dense Vector (FAISS `IndexFlatIP` with `bge-small-en-v1.5`) with Reciprocal Rank Fusion (RRF).
- **Cited Q&A**: Every answer is strictly grounded in quotes with page citations.
- **Deep Analytics**: Paper comparison, literature reviews, research gap detection, and ideas generation.
- **Multi-user & Dual-store**: Portable SQLite (dev) / PostgreSQL (production) with Alembic migrations, plus fast local corpus store.

## Quickstart

### 1. Requirements
- Python 3.10+ (tested on Python 3.11)
- Node.js 18+ (tested on Node v24)
- Windows 10/11 with 8GB RAM

### 2. Installation
```powershell
# Install backend dependencies
pip install -r requirements.txt

# (Optional) For CUDA acceleration on NVIDIA GPU:
# pip install torch --index-url https://download.pytorch.org/whl/cu121 --force-reinstall
```

### 3. Environment & Migrations
```powershell
# Run environment and hardware check
python backend/scripts/check_env.py

# Apply database migrations
alembic upgrade head

# Seed initial admin user
python backend/scripts/seed.py
```

### 4. Running the Application
- `run_backend.bat` -> Starts FastAPI server at http://localhost:8000
- `run_frontend.bat` -> Starts Next.js development server at http://localhost:3000
- `run_all.bat` -> Starts both servers concurrently
