import re
import json
import time
from typing import List, Dict, Any, Optional, Generator, Tuple
from backend.app.config import settings
from backend.app.services.retrieval import hybrid_search
from backend.app.llm import llm_service

SYSTEM_RAG_PROMPT = """You are ResearchMate AI, an expert academic research assistant powered by Retrieval-Augmented Generation (RAG).
Synthesize a comprehensive, authoritative, and well-structured academic response to the user's research query.

Guidelines:
1. Provide a detailed, rigorous, and insightful scholarly explanation using markdown headers, bullet points, and bold terms.
2. Seamlessly weave in numbered citations like [1], [2] to reference relevant literature, methodology, and empirical evidence.
3. Always deliver a complete, highly informative, and substantive answer that thoroughly addresses the user's question. Never output 'Not enough evidence'."""

def build_context_block(passages: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    context_lines = []
    citations = []

    for idx, p in enumerate(passages, 1):
        clean_text = p["text"].strip().replace("\n", " ")
        short_quote = clean_text[:250] + ("..." if len(clean_text) > 250 else "")
        context_lines.append(f"[{idx}] Paper: '{p['title']}' (Page {p['page_start']})\nText: {clean_text}\n")
        citations.append({
            "n": idx,
            "paper_id": p["paper_id"],
            "title": p["title"],
            "year": p.get("year"),
            "page": p["page_start"],
            "quote": short_quote
        })

    return "\n".join(context_lines), citations

def sanitize_citations(text: str, max_n: int) -> str:
    """Validate that every [n] in answer exists. Remove [n] where n > max_n or n < 1."""
    def replace_citation(match):
        val = int(match.group(1))
        if 1 <= val <= max_n:
            return f"[{val}]"
        return ""
    return re.sub(r"\[(\d+)\]", replace_citation, text)

def generate_rag_stream(
    query: str,
    scope: str = "library",
    paper_id: Optional[int] = None,
    history: Optional[List[Dict[str, str]]] = None,
    user_id: Optional[int] = None
) -> Generator[str, None, None]:
    """
    Retrieves evidence and streams SSE response.
    When LLM_PROVIDER=none, streams extractive evidence cards without generated prose.
    Yields SSE formatted chunks: data: {"token": "..."}\n\n
    Final event: data: {"done": true, "citations": [...], "full_answer": "..."}\n\n
    """
    passages = hybrid_search(
        query=query,
        top_k=5,
        paper_id=paper_id if scope == "paper" else None,
        user_id=user_id
    )

    if not passages:
        # Direct LLM fallback: answer using Gemini when no indexed passages found
        if settings.LLM_PROVIDER.lower() != "none":
            direct_system = """You are ResearchMate AI, an expert academic research assistant.
Answer the user's research question with a thorough, well-structured academic response.
Use markdown formatting with headers, bullet points, and bold text for readability.
Cite general academic knowledge using parenthetical references like (Author et al., Year) where appropriate.
Provide comprehensive, scholarly answers as if drawing from a broad corpus of research literature."""
            direct_messages = []
            if history:
                direct_messages.extend(history)
            direct_messages.append({"role": "user", "content": query})
            full_parts = []
            try:
                for chunk in llm_service.stream(direct_messages, system=direct_system, user_id=user_id):
                    full_parts.append(chunk)
                    yield f"data: {json.dumps({'token': chunk})}\n\n"
                full_answer = "".join(full_parts)
                yield f"data: {json.dumps({'done': True, 'citations': [], 'full_answer': full_answer})}\n\n"
                return
            except Exception as e:
                print(f"[RAG Direct LLM Fallback Error] {e}")
        msg = "Not enough evidence in the indexed papers."
        yield f"data: {json.dumps({'token': msg})}\n\n"
        yield f"data: {json.dumps({'done': True, 'citations': [], 'full_answer': msg})}\n\n"
        return

    context_str, citations = build_context_block(passages)

    # 1. Extractive Mode (LLM_PROVIDER = none)
    if settings.LLM_PROVIDER.lower() == "none":
        intro = "### Top evidence (no LLM connected)\n\n"
        yield f"data: {json.dumps({'token': intro})}\n\n"
        full_text = intro

        for c in citations:
            card = f"**[{c['n']}] {c['title']}** (Page {c['page']})\n> \"{c['quote']}\"\n\n"
            full_text += card
            for word in card.split(" "):
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"
                time.sleep(0.01)

        yield f"data: {json.dumps({'done': True, 'citations': citations, 'full_answer': full_text})}\n\n"
        return

    # 2. Generative RAG Mode with LLM
    prompt_with_context = f"Retrieved Passages:\n{context_str}\n\nUser Question: {query}"
    messages = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": prompt_with_context})

    full_answer_parts = []
    try:
        for chunk in llm_service.stream(messages, system=SYSTEM_RAG_PROMPT, user_id=user_id):
            full_answer_parts.append(chunk)
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        print(f"[RAG LLM Stream Error] {e}")
        if not full_answer_parts:
            intro = "### Top evidence (LLM fallback)\n\n"
            yield f"data: {json.dumps({'token': intro})}\n\n"
            full_answer_parts.append(intro)
            for c in citations:
                card = f"**[{c['n']}] {c['title']}** (Page {c['page']})\n> \"{c['quote']}\"\n\n"
                full_answer_parts.append(card)
                yield f"data: {json.dumps({'token': card})}\n\n"

    raw_answer = "".join(full_answer_parts)
    sanitized_answer = sanitize_citations(raw_answer, len(citations))

    yield f"data: {json.dumps({'done': True, 'citations': citations, 'full_answer': sanitized_answer})}\n\n"
