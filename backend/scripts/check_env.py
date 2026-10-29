import sys
import os
import shutil
import sqlite3
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.config import settings

def run_environment_checks():
    checks = []

    print("=" * 65)
    print(" ResearchMate Environment & Hardware Compatibility Check")
    print("=" * 65)

    # 1. Python Version
    py_ver = sys.version_split = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if sys.version_info >= (3, 10):
        checks.append(("Python Version (>= 3.10)", True, f"v{py_ver}"))
    else:
        checks.append(("Python Version (>= 3.10)", False, f"v{py_ver} (Upgrade to 3.10+ required)"))

    # 2. PyTorch & CUDA / VRAM
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        if cuda_avail:
            device_name = torch.cuda.get_device_name(0)
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            checks.append(("PyTorch & CUDA Acceleration", True, f"GPU: {device_name} ({vram_gb:.1f} GB VRAM)"))
        else:
            checks.append(("PyTorch (CPU Fallback)", True, f"v{torch.__version__} - CUDA not active (CPU fallback ready)"))
    except ImportError as e:
        checks.append(("PyTorch", False, f"Not installed: {e}"))

    # 3. FAISS Vector Library
    try:
        import faiss
        checks.append(("FAISS Vector Index", True, f"faiss-cpu v{getattr(faiss, '__version__', 'ready')}"))
    except ImportError as e:
        checks.append(("FAISS Vector Index", False, f"Not installed: {e}"))

    # 4. PyMuPDF (fitz)
    try:
        import fitz
        checks.append(("PyMuPDF (fitz)", True, f"v{fitz.__version__}"))
    except ImportError as e:
        checks.append(("PyMuPDF (fitz)", False, f"Not installed: {e}"))

    # 5. SQLite FTS5 Virtual Table Support
    try:
        con = sqlite3.connect(":memory:")
        con.execute("CREATE VIRTUAL TABLE test_fts USING fts5(content);")
        con.execute("INSERT INTO test_fts(content) VALUES ('test research query');")
        rows = con.execute("SELECT * FROM test_fts WHERE test_fts MATCH 'research';").fetchall()
        con.close()
        if len(rows) > 0:
            checks.append(("SQLite FTS5 Support", True, "Enabled and functional"))
        else:
            checks.append(("SQLite FTS5 Support", False, "FTS5 query failed"))
    except Exception as e:
        checks.append(("SQLite FTS5 Support", False, f"Error: {e}"))

    # 6. Disk Space for Data
    try:
        data_path = root_dir / "data"
        data_path.mkdir(parents=True, exist_ok=True)
        total, used, free = shutil.disk_usage(data_path)
        free_gb = free / (1024 ** 3)
        if free_gb >= 2.0:
            checks.append(("Disk Space (Data volume)", True, f"{free_gb:.1f} GB free"))
        else:
            checks.append(("Disk Space (Data volume)", False, f"Low disk space: {free_gb:.1f} GB free (< 2 GB)"))
    except Exception as e:
        checks.append(("Disk Space Check", False, str(e)))

    # 7. Database Engine & Schema
    try:
        from backend.app.db import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_type = "SQLite (app.db)" if settings.DATABASE_URL.startswith("sqlite") else "PostgreSQL"
        checks.append(("App Database Connection", True, f"{db_type} -> {settings.DATABASE_URL}"))
    except Exception as e:
        checks.append(("App Database Connection", False, f"Failed: {e}"))

    # 8. PDF Source Verification
    if settings.PDF_SOURCE.lower() == "local":
        pdf_dir = Path(settings.PDF_DIR)
        if pdf_dir.exists():
            # Quick shallow/subfolder sample count
            sample_pdfs = list(pdf_dir.glob("*.pdf"))
            if not sample_pdfs:
                sample_pdfs = list(pdf_dir.glob("*/*.pdf"))
            checks.append(("PDF Source (Local)", True, f"Found '{pdf_dir}', ~{len(sample_pdfs)}+ PDFs discovered"))
        else:
            checks.append(("PDF Source (Local)", False, f"Directory '{pdf_dir}' not found"))
    elif settings.PDF_SOURCE.lower() == "r2":
        try:
            import boto3
            s3 = boto3.client(
                "s3",
                endpoint_url=settings.R2_ENDPOINT,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            )
            resp = s3.list_objects_v2(Bucket=settings.R2_BUCKET, Prefix=settings.R2_PREFIX or "", MaxKeys=5)
            keys = [obj["Key"] for obj in resp.get("Contents", [])]
            checks.append(("PDF Source (Cloudflare R2)", True, f"Connected to '{settings.R2_BUCKET}'. Keys sample: {keys[:5]}"))
        except Exception as e:
            checks.append(("PDF Source (Cloudflare R2)", False, f"R2 connection failed: {e}"))
    else:
        checks.append(("PDF Source", False, f"Unknown PDF_SOURCE '{settings.PDF_SOURCE}'"))

    # 9. LLM Provider Configuration
    provider = settings.LLM_PROVIDER.lower()
    if provider == "none":
        checks.append(("LLM Provider (Extractive Mode)", True, "LLM_PROVIDER=none (Extractive mode active)"))
    elif provider in ("openai", "anthropic", "gemini", "openai_compatible"):
        if settings.LLM_API_KEY:
            checks.append((f"LLM Provider ({provider})", True, f"Configured with model: {settings.LLM_MODEL or 'default'}"))
        else:
            checks.append((f"LLM Provider ({provider})", False, "Missing LLM_API_KEY in .env"))
    else:
        checks.append(("LLM Provider", False, f"Unknown provider: {provider}"))

    # Print Results Table
    print("\nStatus  | Component                           | Details")
    print("-" * 65)
    all_passed = True
    for name, status, details in checks:
        status_str = "[PASS]" if status else "[FAIL]"
        if not status:
            all_passed = False
        print(f"{status_str:<7} | {name:<35} | {details}")

    print("-" * 65)
    if all_passed:
        print("[SUCCESS] All environment requirements are satisfied!")
    else:
        print("[WARNING] One or more environment checks reported warnings or failures.")

    print("\n" + "=" * 65)
    print(" Windows Setup & CUDA GPU Acceleration Instructions")
    print("=" * 65)
    print("Your system has an NVIDIA GTX 1650 Ti GPU.")
    print("If you want CUDA acceleration for PyTorch (faster chunk embeddings):")
    print("  1. Ensure NVIDIA drivers are installed.")
    print("  2. Run:")
    print("     pip install torch --index-url https://download.pytorch.org/whl/cu121 --force-reinstall")
    print("Otherwise, ResearchMate will seamlessly fall back to CPU execution.")
    print("=" * 65 + "\n")

    return all_passed

if __name__ == "__main__":
    success = run_environment_checks()
    sys.exit(0 if success else 1)
