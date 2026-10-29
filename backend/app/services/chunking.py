import re
from typing import List, Dict, Any, Optional

# Regex for common academic paper section headings
SECTION_HEADER_REGEX = re.compile(
    r"^(?:(?:\d{1,2}[\.\s]+)?(?:introduction|related\s+work|background|methodology|methods?|"
    r"proposed\s+approach|architecture|experiments?|experimental\s+setup|results?|discussion|"
    r"limitations|conclusion|future\s+work|acknowledgements?|references|bibliography))\b",
    re.IGNORECASE
)

def estimate_tokens(text: str) -> int:
    """Fast approximation of token count based on whitespace and punctuation."""
    words = len(text.split())
    # Typically 1 word ~ 1.3 tokens in scientific/technical English
    return int(words * 1.3)

def chunk_pages(
    pages_text: List[str],
    min_tokens: int = 300,
    max_tokens: int = 500,
    overlap_tokens: int = 50
) -> List[Dict[str, Any]]:
    """
    Splits pages into paragraphs, then groups into chunks of 300-500 tokens with 50-token overlap.
    Detects section headings and flags reference-list chunks.
    """
    chunks: List[Dict[str, Any]] = []
    current_section = "Introduction"
    in_references = False

    buffer_paras: List[str] = []
    buffer_tokens = 0
    buffer_page_start = 1
    current_page = 1

    for page_idx, page_raw in enumerate(pages_text):
        current_page = page_idx + 1
        paras = [p.strip() for p in page_raw.split("\n\n") if p.strip()]

        for para in paras:
            first_line = para.split("\n")[0].strip()

            # Check if this paragraph starts a new section
            if len(first_line) < 80 and SECTION_HEADER_REGEX.match(first_line):
                current_section = first_line[:60]
                if re.search(r"\b(references|bibliography)\b", current_section, re.IGNORECASE):
                    in_references = True

            para_tokens = estimate_tokens(para)

            # If adding this para exceeds max_tokens and we already have enough tokens
            if buffer_tokens + para_tokens > max_tokens and buffer_tokens >= min_tokens:
                chunk_text = "\n\n".join(buffer_paras).strip()
                chunks.append({
                    "text": chunk_text,
                    "page_start": buffer_page_start,
                    "page_end": current_page,
                    "section_hint": current_section,
                    "n_tokens": buffer_tokens,
                    "is_reference": in_references or bool(re.search(r"^\s*\[\d+\]", chunk_text))
                })

                # Compute overlap for the next chunk
                overlap_paras = []
                overlap_count = 0
                for p in reversed(buffer_paras):
                    p_toks = estimate_tokens(p)
                    if overlap_count + p_toks <= overlap_tokens:
                        overlap_paras.insert(0, p)
                        overlap_count += p_toks
                    else:
                        break

                buffer_paras = overlap_paras + [para]
                buffer_tokens = overlap_count + para_tokens
                buffer_page_start = current_page
            else:
                if not buffer_paras:
                    buffer_page_start = current_page
                buffer_paras.append(para)
                buffer_tokens += para_tokens

    # Flush remaining text
    if buffer_paras:
        chunk_text = "\n\n".join(buffer_paras).strip()
        if len(chunk_text) > 30:
            chunks.append({
                "text": chunk_text,
                "page_start": buffer_page_start,
                "page_end": current_page,
                "section_hint": current_section,
                "n_tokens": buffer_tokens,
                "is_reference": in_references or bool(re.search(r"^\s*\[\d+\]", chunk_text))
            })

    return chunks

def chunk_document(pages: Any, **kwargs) -> List[Dict[str, Any]]:
    """Accepts either list of page strings or list of page dicts and returns chunks."""
    if isinstance(pages, list) and pages and isinstance(pages[0], dict):
        pages_text = [p.get("text", "") for p in pages]
    else:
        pages_text = pages
    return chunk_pages(pages_text, **kwargs)
