# ResearchMate 🔬

> **Understand Research Papers in Minutes, Not Hours.**  
> A full-stack AI research assistant engineered for strict citation grounding, hybrid search, multi-paper comparison, and local-first execution.

---

## ⚡ Quickstart (Under 15 Minutes)

### 1. Prerequisites
- **Python**: 3.10 or 3.11 installed.
- **Node.js**: v18 or v20+ with `npm`.
- **Operating System**: Windows 10/11 or Ubuntu Linux (4+ GB RAM).

---

### 2. Environment Setup

#### Clone & Python Environment
```bash
# Clone the repository
git clone https://github.com/your-username/researchmate.git
cd researchmate

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install Python backend dependencies
pip install -r backend/requirements.txt
```

> **PyTorch CUDA Note (Optional for NVIDIA GPU acceleration):**  
> To enable GPU acceleration for embeddings, install PyTorch with CUDA:  
> `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`  
> If no GPU is available, ResearchMate seamlessly defaults to CPU inference.

#### Frontend Environment
```bash
cd frontend
npm install
cd ..
```

---

### 3. Configuration (`.env`)

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key configuration parameters in `.env`:
| Parameter | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `none` | `none` (free local extractive mode), `mock`, `openai`, or `gemini` |
| `DATABASE_URL` | `sqlite:///./data/app.db` | App relational database (`postgresql://...` for production) |
| `PDF_SOURCE` | `local` | `local` for disk storage or `r2` for Cloudflare R2 |
| `PDF_DIR` | `./data/papers` | Directory containing local paper PDFs |
| `JWT_SECRET` | `change-this-in-production` | Secret key for signing session tokens |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth Web Application Client ID |
| `ADMIN_EMAILS` | `admin@researchmate.local`| Comma-separated list of admin email addresses |

---

### 4. Google Cloud Console Setup (Google Sign-In)

To enable **Continue with Google** authentication:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `ResearchMate-App`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type.
   - Enter App name (*ResearchMate*), User support email, and Developer contact email.
   - Click **Save and Continue**.
   - Under **Test users**, add your Google email address while in development mode.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select **Application type**: `Web application`.
   - Name: `ResearchMate Web Client`.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:3000`
     - `https://your-domain.com` (for production)
   - Click **Create**.
5. Copy the generated **Client ID** and set it in your `.env` file:
   ```env
   GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
   NEXT_PUBLIC_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
   ```

---

### 5. Database Migration & Seed Admin

```bash
# Run database migrations
alembic upgrade head

# Seed initial admin account
python backend/scripts/seed_admin.py
```
> **Default Admin Credentials**:  
> Email: `admin@researchmate.local`  
> Password: `AdminSecretPass123!`

---

### 6. Ingestion & Index Building

```bash
# Ingest papers from local directory into SQLite and render thumbnails
python backend/scripts/ingest.py

# Build dense FAISS vector index & sync FTS5 full-text index
python backend/scripts/build_index.py
```

---

### 7. Run the Application

#### Windows One-Click:
Double-click `run_all.bat` or run:
```cmd
.\run_all.bat
```

#### Manual Run:
```bash
# Terminal 1: Backend API (FastAPI)
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend Web App (Next.js)
cd frontend
npm run dev
```

Open your browser to [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing & Evaluation

### Run Test Suite (28 Tests)
```bash
pytest backend/tests -v
```

### Run Retrieval Benchmark (30 Benchmark Queries)
```bash
python backend/scripts/eval_retrieval.py
```
*Evaluates Recall@5, Recall@10, and MRR across BM25, Vector, Hybrid RRF, and CrossEncoder Rerank.*

### Run Extraction Grounding Evaluation
```bash
python backend/scripts/eval_extraction.py
```
*Validates 100% page grounding, verbatim numbers, and absence of hallucinated metrics.*

### Run Latency & Throughput Benchmark
```bash
python backend/scripts/measure_timings.py
```

---

## 🏛️ System Features & Design

- **Free No-LLM Extractive Mode**: Functions out-of-the-box without paid API keys. Delivers ranked evidence cards anchored to exact PDF pages.
- **Strict Grounding**: Every claim, metric, and citation links directly to a verifiable passage and page in the viewer.
- **Rule-Based Comparison Matrix**: Identifies benchmark compatibility between papers, isolating non-comparable claims with explicit reasons.
- **Dual-Store Persistence**: File-portable Corpus DB (SQLite FTS5 + FAISS) + concurrency-safe App DB (PostgreSQL / SQLite).
- **Design Tokens**: Styled to match `#3525CD` primary indigo, clean cards, and light/dark theme toggle.
