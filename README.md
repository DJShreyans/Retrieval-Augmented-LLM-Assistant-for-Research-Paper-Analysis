# Retrieval-Augmented LLM Assistant for Research Paper Analysis (ResearchMate 🚀)

Retrieval-Augmented LLM Assistant for Research Paper Analysis combines semantic search with large language models to deliver accurate, context-aware insights from academic papers. It reduces hallucinations by retrieving relevant content and enables efficient summarization, Q&A, and knowledge extraction.

*Developed as a Final Year Project and open-sourced for researchers.*

---

## Key Features

1. **Document Ingestion Manager**: Drag-and-drop PDF and Word documents (supporting `.docx` and legacy `.doc` formats), saving them to local disk and vectorizing them into ChromaDB in real-time. Includes synchronized file and vector deletions.
2. **Website URL Scraping**: Feed custom website URLs (such as `https://vit.edu.in/`) to ingest their text content into the RAG model pipeline.
3. **AI Chat Workspace**: A ChatGPT-style workspace. Chat with all documents or toggle checkboxes to focus queries on specific papers/urls. Every answer links back to exact retrieved context snippets via dynamic citations.
4. **Multi-Document Comparison Matrix**: Compare documents side-by-side. The RAG pipeline automatically generates an objectives, methodology, datasets, and conclusions comparison grid.
5. **Interactive Mind Map Generator**: Visualizes a hierarchical concept map of a document or website's key themes, structures, and relationships using AI.
6. **Tri-Tier LLM Intelligence Layer (Highly Optimized)**:
   - **NVIDIA Cloud (Kimi K2.6 / Llama 3.3)**: Connects to NVIDIA NIM endpoints with full grounding prompts. Highly optimized with HTTP connection pooling (`requests.Session`) and zero-buffering Server-Sent Events (SSE).
   - **Ollama Local**: Routes through your local Ollama Mistral model offline. Optimized with lazy health pings to prevent timeout delays when the service is offline.
   - **Offline Fallback Synthesizer**: Runs a smart heuristic text extraction engine in pure Python out-of-the-box, ensuring a fully functional demo without needing any external accounts, API keys, or active internet!

---

## Directory Structure

```
ResearchMate/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint & endpoints (/upload, /documents, /chat, /compare, /mindmap)
│   │   ├── rag.py             # PyMuPDF/docx/doc parsing, website scraping, local ChromaDB setup
│   │   └── llm.py             # NVIDIA Cloud (Kimi/Llama), Ollama Local, and Offline Fallback synthesizers
│   ├── data/
│   │   ├── chromadb/          # Persistent local database files
│   │   └── uploads/           # Physical uploaded research documents
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── app/
│   │   ├── page.js            # Dashboard (Telemetry, metrics, recent uploads)
│   │   ├── upload/page.js     # Drag-and-drop document & website uploader
│   │   ├── chat/page.js       # Context-linked RAG Chat with expand citations
│   │   ├── compare/page.js    # Side-by-side Comparative Matrix
│   │   ├── mindmap/page.js    # Interactive SVG hierarchical mind mapper
│   │   ├── globals.css        # Tailwind and dark aesthetic declarations
│   │   └── layout.js          # Next.js structural layout
│   ├── components/
│   │   └── Sidebar.js         # Navigation pane & reactive backend health check
│   ├── tailwind.config.js     # Tailwind setup
│   └── package.json           # Next.js 15 dev scripts and dependencies
│
├── run_backend.bat            # One-click Windows backend launcher
└── run_frontend.bat           # One-click Windows frontend launcher
```

---

## System Requirements

- **Python**: v3.10+ (Your system is running **v3.12.5** ✅)
- **Node.js**: v18+ (Required to run the Next.js dev server on port 3000)

---

## Quick Start (One-Click Launchers)

We have provided two Windows batch scripts to make starting ResearchMate effortless:

### 1. Start the Backend API (Port 8000)
Double-click `run_backend.bat` in the root of the project.
This batch script will:
- Check for Python and create a local virtual environment (`.venv`) if it doesn't exist.
- Activate the virtual environment.
- Upgrade `pip` and install all required libraries from `backend/requirements.txt`.
- Start the FastAPI server using `uvicorn` on `http://127.0.0.1:8000`.

### 2. Start the Frontend Application (Port 3000)
Double-click `run_frontend.bat` in the root of the project.
This batch script will:
- Check for Node.js.
- Run `npm install` to download Next.js 15, React, Tailwind CSS, and Lucide React.
- Boot the Next.js development server on `http://localhost:3000`.

---

## Manual Installation Guide

If you prefer starting the services manually, follow these instructions:

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the Next.js developer environment:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Configuring the LLM Engine

ResearchMate automatically detects how to answer queries. You can choose any of these methods:

### Option A: NVIDIA Cloud API (Highly Recommended)
Configure the `NVIDIA_API_KEY` environment variable in your `backend/.env` file:
```env
NVIDIA_API_KEY=nvapi-...
```
Alternatively, set it before booting the backend:
- **Windows Command Prompt**:
  ```cmd
  set NVIDIA_API_KEY=your_key_here
  run_backend.bat
  ```
- **PowerShell**:
  ```powershell
  $env:NVIDIA_API_KEY="your_key_here"
  .\run_backend.bat
  ```

### Option B: Local Ollama (100% Offline)
1. Download and install [Ollama](https://ollama.com/).
2. Pull the local Mistral model configured in the application:
   ```bash
   ollama pull mistral-small-latest
   ```
3. Keep Ollama running. ResearchMate will detect it and route queries automatically!

### Option C: Instant Heuristic Fallback (No Setup Required)
If you have no API keys or local Ollama models installed, **do not worry!** ResearchMate's unique fallback synthesizer will automatically run, retrieving the exact chunks from ChromaDB and extracting matching facts in real-time, allowing you to show off a fully functional document RAG demo out-of-the-box.
