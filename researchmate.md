# ResearchMate: Build Specification for Claude Code (v2)

You are a senior full-stack + ML engineer. Build **ResearchMate**, an AI research assistant for scientific papers, on my Windows laptop. Read this whole file and the design images in `/design` before writing any code.

Work in phases. After each phase: run it, show me the exact commands to run it, list what you tested and what you could NOT test, then stop and wait for me to say "next". Never start the next phase on your own.

---

## v2 decisions (these override anything below that conflicts)

1. **Order of work:** get a working **backend + frontend running locally first** (Phases 0-6). Deployment to my domain is **Phase 8**, done only after the app works locally.
2. **The LLM is not decided yet.** The whole app must run with `LLM_PROVIDER=none` (extractive mode, see section 2b). Features that need an LLM (summaries, insights, comparison extraction, lit review, gaps, ideas, cluster naming) must be **fully coded and tested with a mock LLM**, and in the UI show a clear "Connect an LLM in Settings" state until a key is set. Providers to support: `openai`, `anthropic`, `gemini`, and `openai_compatible` (custom `LLM_BASE_URL`, which covers Groq, OpenRouter, Together and local Ollama).
3. **Yes, we need a database.** Use two stores (section 2c).
4. **Auth: Google Sign-In plus email/password.** Details in section 2d. This replaces the old "no OAuth" rule.
5. **Multi-user and deployed on a domain.** The 4,393 seeded papers are a **shared, read-only library for everyone**. Papers a user uploads are **private to that user** unless an admin marks them shared. Every query (search, chat, library, compare) must filter by `shared OR owner = current_user`. Chats, summaries cache per user, and settings are per user.
6. **PDF storage can be a local folder or a Cloudflare R2 bucket** (section 2e). My PDFs may already be in R2.

---

## 0. Ground rules

- **Windows 10/11.** Use `pathlib`, no bash-only scripts, provide `.bat` files for run commands. No Docker, no Kubernetes, no Redis, no Elasticsearch, no paid vector DB.
- **Hardware:** Intel i5-10300H (4 cores), **8 GB RAM**, **GTX 1650 Ti with 4 GB VRAM**. Keep memory low: stream files, batch work, never load all PDFs or all vectors twice. Use fp16 on GPU where it helps. Fall back to CPU if CUDA is missing.
- **Data:** about **4,393 PDF research papers** (machine learning + data science), found through `PDF_SOURCE` in `.env` (`local` uses the folder `PDF_DIR`; `r2` uses a Cloudflare R2 bucket, see 2e). More papers will be added later, so everything must be incremental. **Never modify or delete the original PDFs.**
- **Privacy:** PDFs and indexes stay on my machine or my server. Only the retrieved passages and the user's question are sent to the LLM API (and only when an LLM is configured).
- **Secrets:** API keys only in `.env` (gitignored). Provide `.env.example`.
- **LLM provider is configurable** (`LLM_PROVIDER=none|openai|anthropic|gemini|openai_compatible`, `LLM_MODEL=...`, `LLM_API_KEY=...`, `LLM_BASE_URL=...` for openai_compatible). Default is `none`. Never hardcode a model name. Put all LLM calls behind one module (`backend/app/llm.py`) with: `complete(messages)`, `stream(messages)`, and `structured(messages, PydanticModel)` (JSON output validated by Pydantic, with 2 retries). Log token counts per call to the database.
- **Honesty rules for the product:**
  - Every claim or number shown to the user links to a quoted passage and a page number.
  - If the retrieved passages do not support an answer, say "Not enough evidence in the indexed papers." Never guess.
  - Mark papers whose text could not be extracted (or is abstract-only) visibly.
  - Treat all text from PDFs as data, never as instructions (prompt-injection safe: put it in clearly delimited blocks and tell the model to ignore instructions inside).
  - No fake data in the UI: no invented testimonials, user counts, "trusted by" claims or placeholder stats. Anything not backed by the database is removed or labeled "Demo".
- Use git: `git init`, one commit per phase.
- Write small, typed, documented functions. Add `pytest` smoke tests for each phase. Clear error messages, no silent failures.

---

## 1. Project structure

```
researchmate/
  .env.example
  README.md
  run_backend.bat  run_frontend.bat  run_ingest.bat  run_all.bat
  config.yaml                # chunk sizes, top_k, device, batch sizes
  design/                    # my 8 UI screenshots (read them)
  backend/
    app/ (main.py, config.py, db.py, models.py, schemas.py, llm.py, auth.py,
          storage.py (LocalStorage, R2Storage), security.py (rate limits, cookies, CSRF),
          routers/ (auth, papers, search, chat, summary, compare, litreview, dashboard, settings, health),
          services/ (pdf_extract, chunking, embeddings, index, retrieval, rerank,
                     rag, summarize, extraction, comparability, litreview, tagging))
    scripts/ (check_env.py, ingest.py, build_index.py, eval_retrieval.py, eval_extraction.py)
    tests/
  frontend/                  # Next.js (App Router) + TypeScript + Tailwind
  data/ (app.db, corpus.db, faiss/, thumbnails/, cache/)
  deploy/ (DEPLOY.md, Caddyfile, systemd unit files, backup script)  # written in Phase 8
  eval/ (questions_template.csv, extraction_template.csv)
```

---

## 2. Tech stack (fixed unless a blocker appears; tell me if you deviate)

| Part | Choice |
|---|---|
| PDF text | PyMuPDF (`get_text("blocks", sort=True)` per page to handle two-column layouts), keep page numbers |
| Keyword search | SQLite FTS5 virtual table over chunks (in `corpus.db`) |
| Embeddings | `BAAI/bge-small-en-v1.5` via sentence-transformers (384-dim, normalized). For **queries only**, prepend `Represent this sentence for searching relevant passages: ` |
| Vector index | FAISS `IndexFlatIP` (faiss-cpu) on normalized vectors, saved to disk, incremental add. About 175k chunks fits easily in RAM. |
| Fusion | Reciprocal Rank Fusion (k=60) of BM25 and vector results |
| Reranker | `BAAI/bge-reranker-v2-m3` as an **optional** cross-encoder (flag `USE_RERANKER`), fp16, rerank the top 40 down to 8 |
| Backend | FastAPI, Pydantic v2, Uvicorn, background tasks (no Celery) |
| Auth | **Google Sign-In** (Google Identity Services on the frontend, ID token verified on the backend with `google-auth`) plus email/password (bcrypt used directly). Sessions in HttpOnly cookies. See 2d. |
| Databases | **App store:** SQLAlchemy 2 + Alembic, `DATABASE_URL` (SQLite in dev, **PostgreSQL in production**). **Corpus store:** SQLite `corpus.db` with FTS5 + FAISS files. See 2c. |
| PDF storage | `storage.py` interface with `LocalStorage` and `R2Storage` (boto3, S3-compatible). See 2e. |
| Frontend | Next.js + TypeScript + Tailwind, `react-pdf` (pdf.js) for the viewer (client-side only, dynamic import with `ssr:false`), SSE for streaming chat |
| Charts (later) | Recharts |

## 2b. No-LLM (extractive) mode, `LLM_PROVIDER=none`

| Feature | Behaviour without an LLM |
|---|---|
| Chat / ask | Return the top ranked passages as numbered evidence cards (paper, page, quote) under the heading "Top evidence (no LLM connected)". No generated prose. |
| Search | Fully works (hybrid + optional rerank). |
| Summary | First sentences of the abstract plus detected section headings, labeled "Extractive, no LLM". |
| Cluster/tag names | Top TF-IDF terms of each cluster. |
| Comparison, Lit Review, Gaps, Ideas, Insights | Disabled with a clear message and a link to Settings. Code is complete and tested against a **mock LLM** that returns fixed valid JSON/text. |

Settings page: a "Connect an LLM" form (provider, model, base URL, key) that tests the connection and saves to the server `.env`/secret store. The key is never returned to the browser.

## 2c. Database design (answer: yes, two stores)

| Store | Contents | Dev | Production |
|---|---|---|---|
| **App store** | users, sessions/refresh tokens, chats, messages, user libraries/collections, uploads and jobs, summaries and extractions cache, `llm_calls`, settings | SQLite `data/app.db` | **PostgreSQL** (`DATABASE_URL`) |
| **Corpus store** | papers, chunks, FTS5 index, FAISS vectors | SQLite `data/corpus.db` + `data/faiss/` | Same files on the server disk (read-mostly) |

Why: users and chats need safe concurrent writes (PostgreSQL). FTS5 + FAISS are simple and fast for about 175k chunks and ship as files, so the index I build on my laptop can be copied to the server.
Rules: write app-store code with portable SQLAlchemy (no SQLite-only SQL), use **Alembic migrations from Phase 0**, add indexes on every foreign key and filter column, and use a single-writer lock plus a job queue table for corpus writes (uploads). Provide a seed script (admin user from `ADMIN_EMAILS`, shared corpus flag) and a backup script (copy `corpus.db` + `faiss/`, `pg_dump` for the app store).
Papers table needs: `visibility` (`shared`|`private`), `owner_id` nullable, `storage_key` (path or R2 object key).

## 2d. Authentication and security

- **Google Sign-In flow:** the frontend shows Google's button and receives an ID token (`credential`); it posts it to `POST /auth/google`. The backend verifies it with `google.oauth2.id_token.verify_oauth2_token(token, Request(), GOOGLE_CLIENT_ID)`, requires `email_verified`, upserts the user by `google_sub` (unique) and email, then creates a session. The client secret is not needed for this flow.
- **Sessions:** short-lived access JWT (about 30 min) and a refresh token (stored hashed in the DB, about 14 days, rotated on use), both in **HttpOnly, Secure, SameSite=Lax cookies**. Add CSRF protection for state-changing requests (Origin check plus a double-submit token). Provide `/auth/me`, `/auth/refresh`, `/auth/logout`.
- **Email/password:** bcrypt, minimum password length, login rate limit, generic error messages. Email verification and password reset are optional; mark them as TODO in docs if skipped.
- **Roles:** `user`, `admin` (admin = emails in `ADMIN_EMAILS`).
- **Protection:** every API route requires auth except `/health`, the landing page and the auth routes. Rate limit chat, search, upload and login per user/IP. Validate uploads (extension, size at most 50 MB, `%PDF-` magic bytes), never trust file names, store under generated keys.
- **Config keys:** `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `COOKIE_DOMAIN`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`, `DATABASE_URL`, `PUBLIC_BASE_URL`.
- **README must include Google Cloud Console steps:** create a project, configure the OAuth consent screen (External; add test users while in testing), create an OAuth client ID of type **Web application**, authorized JavaScript origins `http://localhost:3000` and `https://<my-domain>`.
- **Tests:** unauthenticated requests are rejected; user A cannot read user B's private papers, chats or summaries; an invalid or wrong-audience Google token is rejected.

## 2e. PDF storage (local or Cloudflare R2)

`storage.py` exposes `list_keys(prefix)`, `open(key)` (stream), `exists(key)`, `put(key, file)`, and `get_range(key, start, end)`.
- `PDF_SOURCE=local`: `PDF_DIR` folder.
- `PDF_SOURCE=r2`: `R2_ENDPOINT`, `R2_BUCKET`, `R2_PREFIX`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` via boto3. Ingestion **streams one object at a time to a temp file**, extracts, deletes the temp file. Never download the whole bucket at once (limited disk and RAM).
- **Serving PDFs to the viewer:** `GET /papers/{id}/pdf` is authenticated, checks visibility, and streams the file with **HTTP Range support** so pdf.js can load pages lazily. Do not make the bucket public.
- Thumbnails and extracted text are generated at ingest time and stored locally, so the app never re-reads PDFs just to list the library.

---

## 3. Design to reproduce (look at `/design/*.png`)

Match my screenshots closely: a clean, modern, indigo-accent app.

- **Tokens (read approximate values from the images):** primary indigo (about `#3525CD`), very light lavender page/sidebar backgrounds, near-black text, green accent for the AI avatar and "High relevance" chips, pale-indigo chips, rounded cards with thin borders. Body font Inter; small monospace font for labels/chips/buttons. Support the dark-mode toggle shown in the top bar (CSS variables).
- **App shell:** left sidebar with logo "ResearchMate / AI Research Assistant", a primary **New Analysis** button, nav: Dashboard, My Library, Upload, Chat, Comparison, Lit Review, Research Gaps, Ideas, Settings; bottom: Support, Account. Top bar: global search ("Search papers, chats, insights..."), bell, dark-mode toggle, avatar.
- **Screens:**
  1. **Landing**: hero ("Understand Research Papers in Minutes, Not Hours"), feature cards (Upload PDFs, Smart Summaries, Q&A Chat, Compare Papers, Literature Reviews, Research Gaps). **Remove** "Trusted by 10,000+ researchers", the GPT-4 Turbo badge and any fake claims.
  2. **Login** and **Sign-up**: email/password plus a working **Continue with Google** button. **Remove** the fake testimonial and the GitHub button.
  3. **Dashboard**: welcome banner (real user name), stat cards from the database (papers in library, questions asked, reviews generated, tokens used from the llm log), quick actions, recent chats, recent papers, "Suggested for you" (nearest-neighbor papers to the user's recently opened ones, via embeddings).
  4. **My Library**: card grid + list toggle, sort (date added, title, year), tag filter, pagination, search. Cards show a **real thumbnail of page 1** (render with PyMuPDF, cache in `data/thumbnails`), title, authors, topic tags, added date, file-type badge.
  5. **Upload**: drag-and-drop PDF (max 50 MB), upload queue with progress, then a **metadata review form** (title, authors, abstract, year, tags, confidence badge) with Save to Library / Discard. Saving triggers background indexing; show status.
  6. **Paper viewer**: left = PDF (zoom, page nav, search, download); right = tabs **Summary** (Key Contributions, Methodology, Limitations cards, Regenerate, Copy Summary), **Chat** (scoped to this paper), **Key Insights**, **References**.
  7. **Chat**: three columns (sidebar, chat history grouped Today / Yesterday / Last 7 days, conversation). Suggested-question chips, streamed answers with markdown, **inline citation chips [1] [2]** that open a side panel showing the source paper, page and quoted passage with a button to jump to that page in the PDF viewer, typing indicator, attach button, footer note "AI can make mistakes. Verify important information with citations."
  - **Required addition (not in my mockups):** a scope toggle on Chat: **This paper | All papers (library)**. Library-wide Q&A is the core feature. Also show a global **search results** view (papers + best passages) with filters for year and tag.
  8. **Comparison**, **Lit Review**, **Research Gaps**, **Ideas**: not shown in my images; design them in the same style (specs below).

---

## 4. Data model (SQLite)

`users`, `papers` (id, title, authors, abstract, year, file_path, file_hash, page_count, has_text, text_quality, source, added_at, user_id nullable for shared library, status), `chunks` (id, paper_id, page_start, page_end, section_hint, text, n_tokens), `chunks_fts` (FTS5), `tags`, `paper_tags`, `chats`, `messages` (with citations JSON), `summaries` (paper_id, json, model, created_at), `extractions` (paper_id, json, model, created_at), `llm_calls` (purpose, model, prompt_tokens, completion_tokens, latency_ms, created_at), `jobs` (type, status, progress, error). Embedding vectors live in FAISS; keep `chunk_id` to FAISS row mapping.

---

## 5. Phases

### Phase 0: Scaffold and environment check
- Create the structure, `requirements.txt`, `.env.example` (every key from sections 2b-2e, with `LLM_PROVIDER=none` and `PDF_SOURCE=local` as defaults), `config.yaml`, DB models, Alembic setup and first migration, seed script, `scripts/check_env.py` that prints: Python version, torch + CUDA availability and VRAM, faiss, PyMuPDF, SQLite FTS5 support, free disk space where data is stored, which `DATABASE_URL` type is active, `PDF_SOURCE` and whether R2 credentials work (list 5 keys), and whether an LLM is configured (`none` is a valid pass). Provide Windows install steps (including how to install the CUDA build of PyTorch).
- **Done when:** `check_env.py` runs and shows a clear pass/fail list.

### Phase 1: Ingestion and indexing
1. `scripts/ingest.py`: walk the PDF source (local folder or R2 prefix, via `storage.py`); skip files already ingested (by SHA-256 hash); multiprocessing (max 3 workers) with progress bar; extract text per page; detect scanned or empty PDFs (very low text per page) and mark `has_text=false` instead of crashing; never stop on a bad file.
2. Metadata: PDF metadata first, then heuristics (title = largest-font text on page 1; abstract = text after "Abstract"; year from PDF metadata or text; authors from the lines under the title). Mark low-confidence fields. Deduplicate by hash and normalized title.
3. Chunking: 300–500 tokens, 50 overlap, split on paragraphs, drop reference-list chunks from retrieval (flag them `is_reference=true`), keep `page_start/page_end` and a `section_hint` if a heading was detected.
4. `scripts/build_index.py`: embed chunks in batches (batch size from config, fp16 on GPU), add to FAISS incrementally, fill FTS5. Resumable. Print timing for the first 1,000 chunks and an ETA for the whole set before continuing.
5. `services/tagging.py`: embed abstracts, KMeans (k about 15–25), name each cluster with one LLM call (3 words), store as tags (used by the Library filter).
6. Print a quality report: papers found / ok / no-text / failed (with reasons), total pages, total chunks, average chunks per paper, 10 random papers with parsed title and abstract for me to eyeball.
- **Test first on 100 PDFs**, show me the report, then run all 4,393.
- **Done when:** the report is printed and a CLI query returns sensible chunks.

### Phase 2: Search, RAG, and cited chat API
- `POST /search` (query, filters year/tag, top_k): BM25 + vector, RRF, optional rerank. Return papers with best passages, page numbers, scores.
- `POST /chat` (scope = `paper` | `library`, optional `paper_id`, message history; **with `LLM_PROVIDER=none` return the extractive evidence cards from 2b**): retrieve, build a context block of numbered passages, call the LLM with strict grounding rules: answer only from the numbered passages, cite as `[n]`, say "Not enough evidence in the indexed papers." when unsupported. Stream with SSE. The final event returns `citations: [{n, paper_id, title, year, page, quote}]`. Validate that every `[n]` in the answer exists; remove invalid ones.
- Chat history endpoints (list grouped by day, get, delete).
- `scripts/eval_retrieval.py`: reads `eval/questions.csv` (question, expected_paper_id, expected_page) and reports Recall@5, Recall@10, MRR for BM25-only, vector-only, hybrid, hybrid+rerank. Provide a template and **generate 30 draft questions from random papers' abstracts** that I will review by hand.
- **Done when:** I can run a CLI chat that answers 5 test questions with correct page citations and prints the eval table.

### Phase 3: Frontend shell + Library + Chat
- Next.js app with the design tokens, app shell, **auth pages wired to the API (Google Sign-In, email/password, logout, protected routes, session refresh)**, dark mode. The first time a user lands, show the shared library; private uploads appear only for their owner.
- Library (real data, thumbnails, tag filter, sort, pagination) and Chat (history, streaming, citation chips + source panel, This paper / All papers toggle, global search view).
- **Done when:** I can sign in with Google and with email/password, browse the library and ask questions with page citations in the browser (extractive mode is fine), and the auth tests pass.

### Phase 4: Paper viewer, Summary/Insights, Upload
- Viewer with `react-pdf`; clicking a citation opens the PDF at that page and highlights the quote if possible.
- `GET/POST /papers/{id}/summary`: structured output (key contributions, methodology, datasets, results, limitations) each with a supporting quote and page. Cache in DB, Regenerate button, Copy button.
- Key Insights tab: claims, datasets, metrics, future work with quotes. References tab: parse the reference section with a heuristic (split entries), mark as "parsed, may be imperfect"; optional LLM cleanup.
- Upload flow: save file, extract metadata draft, show review form, on Save run chunk, embed and index in a background task with a job status endpoint the UI polls. Show duplicates clearly ("already in library").
- **Done when:** I can upload a new PDF, edit its metadata, see it indexed, and ask questions about it within a minute or two.

### Phase 5: Comparison (main differentiator)
- UI: pick 2–6 papers (or "use papers from my last search"), choose aspects (method, dataset, metric, result, limitations).
- `services/extraction.py`: for each paper, find passages with the retriever (results/experiments sections first), then call the LLM with a Pydantic schema returning records: `{method, task, dataset, metric, value, unit, conditions{hardware, model_size, train_data, shots, other}, source{page, quote}}`. Use `null` for anything not stated. **Never invent or convert numbers.** Cache in `extractions`.
- `services/comparability.py` (rule-based): group records by `(task, dataset, metric, unit)`; two records are comparable only when these match and the listed conditions do not conflict; otherwise put them in a **"Not directly comparable"** section with the reason (different dataset, unit, hardware, and so on). Percent vs fraction is normalized only when explicitly written as such.
- UI: side-by-side table with a source-quote tooltip per cell, comparability badges, CSV export.
- `scripts/eval_extraction.py`: sample 30 records and a CSV template for me to hand-check values; compute field accuracy.
- **Done when:** comparing 3 papers shows a table where every number opens its quote, and mismatched metrics are flagged.

### Phase 6: Dashboard, Lit Review, Settings, polish
- Dashboard with real stats and "Suggested for you".
- **Lit Review:** user gives a topic; plan 3–6 sub-questions (LLM), retrieve per sub-question, dedupe, then write a structured review (Introduction, Themes, Conflicting findings, Limitations of this review) with `[n]` citations and a **coverage log** (queries run, passages retrieved, papers used, any abstract-only or no-text papers). Run as a background job, show progress, allow Copy and Markdown download.
- **Research Gaps:** from per-paper "limitations / future work" extractions, cluster and list candidate gaps clearly labeled **"hypotheses for expert review"** with supporting quotes. Keep it simple.
- **Ideas:** a small page that turns a selected gap into a suggested study outline, labeled as AI-generated suggestions.
- Settings: show active model, key status (never show the key), embedding model, library stats, re-index button.
- Error states, empty states, loading skeletons, keyboard focus, responsive layout.

### Phase 7: Evaluation, docs, demo
- Run both eval scripts on my hand-checked files and write `docs/RESULTS.md` with the tables (retrieval variants, extraction accuracy, timings: extraction, embedding per 1,000 chunks, query latency).
- `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md` (honest), `docs/SCALING.md` (what changes at 50k and 1M papers, using measured timings), `README.md` with setup in under 15 minutes.
- `docs/DEMO_SCRIPT.md`: 8 demo questions that work well on this corpus, plus a 5-minute demo flow.
- `run_all.bat` that starts the backend and frontend.
- Security tests from 2d pass.

### Phase 8: Deploy to my domain (only after the app works locally)
- Write `deploy/DEPLOY.md` with exact, copy-paste steps for a **single Linux VPS** (Ubuntu, at least 4 GB RAM, with disk for `data/`) and my domain:
  1. DNS A record to the server, firewall (80/443/22 only), non-root user.
  2. Install Python, Node, PostgreSQL (or point `DATABASE_URL` at a managed Postgres), **CPU-only PyTorch** wheels.
  3. Copy the index built on my laptop (`corpus.db`, `faiss/`, `thumbnails/`) to the server with `rsync`/`scp`; run Alembic migrations; seed the admin.
  4. Run FastAPI (Uvicorn) and `next start` as **systemd services** with env files (no secrets in git).
  5. **Caddy** reverse proxy with automatic HTTPS: `https://<domain>` to the frontend and `/api/*` to FastAPI, so everything is **same-origin** (no CORS or cross-site cookie problems). Include the Caddyfile.
  6. Add the production origin to the Google OAuth client; set `COOKIE_DOMAIN`, `ALLOWED_ORIGINS`, `PUBLIC_BASE_URL`.
  7. Production defaults: `USE_RERANKER=false` unless the server has enough RAM, query embedding on CPU, rate limits on, debug off, HSTS and secure headers, log rotation, `/health` endpoint, nightly backup script and a restore test.
- Explain what **not** to do: do not host the backend on a serverless platform without a persistent disk, because it needs the FAISS/SQLite files and the embedding model in memory.
- **Done when:** I can open my domain over HTTPS, sign in with Google, search, and chat from another device.

---

## 6. Quality bar

- Every phase has a short test plan and a smoke test that passes before you report back.
- Long jobs show progress and can resume.
- No hardcoded paths or model names. All settings in `.env` or `config.yaml`.
- Log LLM calls and cache identical requests.
- When blocked or when a requirement is ambiguous, ask me one concise question instead of guessing.

## 7. Start

Read this file and the images in `/design`. Print a plan of at most 30 lines, then begin **Phase 0** immediately. Stop after Phase 0 and report. Remember: backend and frontend first, locally, with `LLM_PROVIDER=none`; deployment (Phase 8) comes last.