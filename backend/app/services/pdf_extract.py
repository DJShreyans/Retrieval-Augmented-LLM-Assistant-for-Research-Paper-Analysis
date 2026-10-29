import re
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import fitz  # PyMuPDF
from backend.app.config import ROOT_DIR, settings

THUMBNAILS_DIR = ROOT_DIR / "data" / "thumbnails"
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

def compute_sha256(stream_or_path_or_bytes) -> str:
    hasher = hashlib.sha256()
    if isinstance(stream_or_path_or_bytes, bytes):
        hasher.update(stream_or_path_or_bytes)
    elif isinstance(stream_or_path_or_bytes, (str, Path)):
        with open(stream_or_path_or_bytes, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
    else:
        while chunk := stream_or_path_or_bytes.read(65536):
            hasher.update(chunk)
        if hasattr(stream_or_path_or_bytes, "seek"):
            stream_or_path_or_bytes.seek(0)
    return hasher.hexdigest()

def clean_text(text: str) -> str:
    # Normalize whitespaces and linebreaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def extract_pdf_data(doc: fitz.Document, filename: str = "") -> Dict[str, Any]:
    page_count = len(doc)
    pages_text: List[str] = []
    total_chars = 0
    pages_blocks: List[List[Dict[str, Any]]] = []

    for page_idx in range(page_count):
        page = doc[page_idx]
        # get blocks sorted top-to-bottom, left-to-right to handle two columns
        blocks = page.get_text("blocks", sort=True)
        page_str_parts = []
        p_blocks = []

        for b in blocks:
            # b: (x0, y0, x1, y1, text, block_no, block_type)
            if len(b) >= 7 and b[6] == 0:  # text block
                b_text = b[4].strip()
                if b_text:
                    page_str_parts.append(b_text)
                    p_blocks.append({
                        "bbox": (b[0], b[1], b[2], b[3]),
                        "text": b_text,
                        "page": page_idx + 1
                    })

        p_text = "\n\n".join(page_str_parts)
        pages_text.append(p_text)
        total_chars += len(p_text)
        pages_blocks.append(p_blocks)

    # Detect scanned or empty PDF
    avg_chars = total_chars / max(page_count, 1)
    has_text = True
    text_quality = "good"

    if total_chars < 150 or avg_chars < 40:
        has_text = False
        text_quality = "scanned"
    elif avg_chars < 150:
        text_quality = "poor"

    # Metadata extraction
    meta = doc.metadata or {}
    meta_title = (meta.get("title") or "").strip()
    meta_author = (meta.get("author") or "").strip()
    
    # Year extraction
    year = None
    creation_date = meta.get("creationDate") or ""
    m_year = re.search(r"(?:19|20)\d{2}", creation_date)
    if m_year:
        year = int(m_year.group(0))

    page1_text = pages_text[0] if pages_text else ""

    if not year and page1_text:
        m_page_year = re.search(r"\b(199\d|20[0-2]\d)\b", page1_text[:2000])
        if m_page_year:
            year = int(m_page_year.group(0))

    # Title detection heuristic
    title = ""
    # Try finding largest font on page 1
    if page_count > 0:
        p0 = doc[0]
        dict_data = p0.get_text("dict")
        max_size = 0.0
        best_title_lines = []

        for block in dict_data.get("blocks", []):
            if block.get("type") == 0:  # text
                for line in block.get("lines", []):
                    line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
                    if not line_text or len(line_text) < 3:
                        continue
                    # get max font size in span
                    line_max_size = max((span.get("size", 0.0) for span in line.get("spans", [])), default=0.0)
                    if line_max_size > max_size + 0.5:
                        max_size = line_max_size
                        best_title_lines = [line_text]
                    elif abs(line_max_size - max_size) <= 0.5 and max_size > 12.0:
                        best_title_lines.append(line_text)

        detected_title = " ".join(best_title_lines).strip()
        # Clean title
        detected_title = re.sub(r"\s+", " ", detected_title)
        if len(detected_title) > 8 and not re.match(r"^(arxiv|ieee|proceedings|journal|volume|page)\b", detected_title.lower()):
            title = detected_title

    # Fallback to metadata title or filename
    if not title:
        if meta_title and len(meta_title) > 6 and not meta_title.lower().endswith(".pdf"):
            title = meta_title
        elif filename:
            clean_fn = Path(filename).stem.replace("_", " ").replace("-", " ")
            title = re.sub(r"^\d+\s*", "", clean_fn).strip()
        else:
            title = "Untitled Paper"

    # Truncate overly long title
    title = title[:450]

    # Authors heuristic
    authors = meta_author
    if not authors and page1_text and title:
        # Search lines between title and Abstract
        title_idx = page1_text.lower().find(title[:30].lower())
        abs_idx = page1_text.lower().find("abstract")
        if title_idx != -1 and abs_idx != -1 and abs_idx > title_idx:
            sub = page1_text[title_idx + len(title[:30]):abs_idx].strip()
            lines = [l.strip() for l in sub.split("\n") if l.strip() and not re.search(r"@(gmail|email|edu|ac|org)", l)]
            if lines:
                authors = ", ".join(lines[:3])

    if not authors:
        authors = "Unknown Authors"
    authors = authors[:500]

    # Abstract heuristic
    abstract = ""
    for p_idx in range(min(page_count, 2)):
        txt = pages_text[p_idx]
        abs_match = re.search(r"\babstract\b[:\s\-\.]*", txt, re.IGNORECASE)
        if abs_match:
            start_pos = abs_match.end()
            # Find next section: Introduction, Keywords, 1., etc.
            end_match = re.search(r"\n\s*(?:(?:1[\.\s]+)?introduction|index terms|keywords)\b", txt[start_pos:], re.IGNORECASE)
            if end_match:
                abstract = txt[start_pos:start_pos + end_match.start()]
            else:
                abstract = txt[start_pos:start_pos + 2000]
            break

    abstract = clean_text(abstract)[:4000]

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "year": year,
        "page_count": page_count,
        "has_text": has_text,
        "text_quality": text_quality,
        "pages_text": pages_text,
        "pages_blocks": pages_blocks,
    }

def generate_thumbnail(doc: fitz.Document, paper_id: int) -> Optional[str]:
    """Generate page 1 thumbnail PNG and save to data/thumbnails/{paper_id}.png"""
    try:
        if len(doc) == 0:
            return None
        page = doc[0]
        pix = page.get_pixmap(dpi=100)
        target = THUMBNAILS_DIR / f"{paper_id}.png"
        pix.save(str(target))
        return str(target.relative_to(ROOT_DIR)).replace("\\", "/")
    except Exception as e:
        print(f"[Thumbnail Error] paper_id={paper_id}: {e}")
        return None
