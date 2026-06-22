import os
from dotenv import load_dotenv
load_dotenv()
import json
import requests
import re

# Create a global requests session to reuse TCP connections
session = requests.Session()

def extract_json_block(text: str) -> str:
    """Extracts the first valid JSON block containing { } from the response text."""
    try:
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    return text.strip()

# Default configuration
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
OLLAMA_API_URL = "http://localhost:11434/api/chat"

def get_nvidia_api_key() -> str:
    """Retrieves the NVIDIA API Key from environment variables."""
    return os.environ.get("NVIDIA_API_KEY", "").strip()

def check_ollama_status() -> bool:
    """Checks if Ollama is running locally on port 11434."""
    try:
        response = session.get("http://localhost:11434", timeout=1)
        return response.status_code == 200
    except requests.RequestException:
        return False

# Supported models configuration
SUPPORTED_MODELS = {
    "moonshotai/kimi-k2.6": {
        "provider": "nvidia",
        "model": "moonshotai/kimi-k2.6",
        "api_url": "https://integrate.api.nvidia.com/v1/chat/completions",
        "temperature": 1.0,
        "top_p": 1.0,
        "max_tokens": 16384
    },
    "meta/llama-3.3-70b-instruct": {
        "provider": "nvidia",
        "model": "meta/llama-3.3-70b-instruct",
        "api_url": "https://integrate.api.nvidia.com/v1/chat/completions",
        "temperature": 0.1,
        "top_p": 1.0,
        "max_tokens": 4096
    },
    "ollama_local": {
        "provider": "ollama",
        "model": "mistral-small-latest",
        "api_url": "http://localhost:11434/api/chat",
        "temperature": 0.1,
        "top_p": 1.0,
        "max_tokens": 4096
    }
}

def resolve_model(requested_model: str = None) -> tuple[str, dict]:
    """
    Resolves the model to use. If requested_model is provided and available, uses it.
    Otherwise, automatically selects the best available cloud or local model.
    Returns (model_id, config_dict).
    """
    nvidia_key = get_nvidia_api_key()
    
    # 1. If a specific model was requested, check if we can run it
    if requested_model and requested_model in SUPPORTED_MODELS:
        cfg = SUPPORTED_MODELS[requested_model]
        if cfg["provider"] == "nvidia" and nvidia_key:
            return requested_model, cfg
        elif cfg["provider"] == "ollama" and check_ollama_status():
            return requested_model, cfg
            
    # 2. Auto-select default model based on key availability
    if nvidia_key:
        return "moonshotai/kimi-k2.6", SUPPORTED_MODELS["moonshotai/kimi-k2.6"]
    elif check_ollama_status():
        return "ollama_local", SUPPORTED_MODELS["ollama_local"]
        
    return "offline_fallback", {}

def generate_rag_answer(question: str, retrieved_chunks: list[dict], model: str = None) -> dict:
    """
    Generates a grounded answer based strictly on retrieved chunks.
    Automatically handles Mistral Cloud, Local Ollama, or Python Heuristic fallback.
    """
    if not retrieved_chunks:
        return {
            "answer": "No relevant document chunks were found. Please upload documents first and ensure they are active.",
            "citations": [],
            "mode": "no_context"
        }

    # Format the context and build a citation index map
    context_str = ""
    citations = []
    seen_sources = {}
    
    for idx, chunk in enumerate(retrieved_chunks):
        source = chunk["source"]
        if source not in seen_sources:
            seen_sources[source] = len(seen_sources) + 1
            citations.append({
                "index": seen_sources[source],
                "filename": source
            })
            
        citation_num = seen_sources[source]
        context_str += f"[Ref {citation_num}] (From {source}): {chunk['content']}\n\n"

    # Define system instructions to enforce strict grounding
    system_prompt = (
        "You are ResearchMate, a precise research assistant. "
        "Answer the user's question based strictly on the retrieved document context below. "
        "Do not use any external knowledge. If the context does not contain enough information "
        "to answer, politely state that you cannot find the answer in the provided documents.\n\n"
        "Cite the sources in your answer using bracketed numbers matching the reference numbers, e.g. [1], [2]. "
        "Include citations directly in your sentences when mentioning facts retrieved from a specific document."
    )

    user_prompt = f"Retrieved Context:\n{context_str}\nQuestion: {question}"

    model_id, cfg = resolve_model(model)
    
    if model_id == "offline_fallback":
        return run_local_synthesizer(question, retrieved_chunks, citations)
        
    # Set up keys and headers
    if cfg["provider"] == "nvidia":
        api_key = get_nvidia_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": cfg.get("max_tokens", 4096),
            "temperature": cfg.get("temperature", 0.1),
            "top_p": cfg.get("top_p", 1.0)
        }
        api_mode = "nvidia_cloud"
        api_url = cfg["api_url"]
    elif cfg["provider"] == "ollama":
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "options": {
                "temperature": cfg.get("temperature", 0.1)
            },
            "stream": False
        }
        api_mode = "ollama_local"
        api_url = cfg["api_url"]
        
    # Now call the resolved API
    try:
        if cfg["provider"] == "ollama":
            response = session.post(api_url, json=payload, timeout=25)
            if response.status_code == 200:
                answer = response.json()["message"]["content"]
                return {
                    "answer": answer,
                    "citations": citations,
                    "mode": api_mode
                }
        else:
            response = session.post(api_url, headers=headers, json=payload, timeout=60)
            if response.status_code == 200:
                answer = response.json()["choices"][0]["message"]["content"]
                return {
                    "answer": answer,
                    "citations": citations,
                    "mode": api_mode
                }
            else:
                print(f"Cloud API returned error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error calling model {model_id}: {e}")
        
    # Fallback
    if check_ollama_status() and model_id != "ollama_local":
        return generate_rag_answer(question, retrieved_chunks, model="ollama_local")
        
    return run_local_synthesizer(question, retrieved_chunks, citations)


def run_local_synthesizer(question: str, retrieved_chunks: list[dict], citations: list[dict]) -> dict:
    """
    A highly robust local semantic extraction system.
    Extracts matching sentences directly from retrieved text blocks to form a coherent response.
    """
    question_words = set(w.lower() for w in question.split() if len(w) > 3)
    matched_sentences = []
    
    # Simple lookup of references
    ref_map = {c["filename"]: c["index"] for c in citations}
    
    for chunk in retrieved_chunks:
        source = chunk["source"]
        ref_num = ref_map[source]
        
        # Split chunk into sentences
        sentences = [s.strip() for s in chunk["content"].split(".") if s.strip()]
        for sentence in sentences:
            sentence_words = set(w.lower() for w in sentence.split() if len(w) > 3)
            # Calculate word overlap
            overlap = sentence_words.intersection(question_words)
            if overlap:
                # Store sentence with overlap count and source
                matched_sentences.append({
                    "sentence": sentence,
                    "overlap": len(overlap),
                    "ref": ref_num
                })

    # Sort matched sentences by relevance
    matched_sentences.sort(key=lambda x: x["overlap"], reverse=True)
    
    # Build a summary response
    selected_sentences = []
    seen_texts = set()
    
    # Pick top relevant sentences (up to 4 to form a paragraph)
    for ms in matched_sentences[:4]:
        text = ms["sentence"]
        if text.lower() not in seen_texts:
            seen_texts.add(text.lower())
            selected_sentences.append(f"{text} [{ms['ref']}].")
            
    if selected_sentences:
        answer_body = " ".join(selected_sentences)
        answer = (
            f"Based on the retrieved context, here is the relevant synthesized extract:\n\n"
            f"{answer_body}\n\n"
            f"⚠️ **Note**: ResearchMate is running in *Local Offline Mode*. To enable fully synthesized "
            f"AI answers, please set your `MISTRAL_API_KEY` environment variable or start a local Ollama instance."
        )
    else:
        # Fallback if no matching words were found in sentences
        top_chunk = retrieved_chunks[0]
        ref_num = ref_map[top_chunk["source"]]
        answer = (
            f"I retrieved relevant sections, but no direct sentence matched the terms in your question exactly. "
            f"Here is a key reference retrieved from the document:\n\n"
            f"\"{top_chunk['content'][:350]}...\" [{ref_num}]\n\n"
            f"⚠️ **Note**: ResearchMate is running in *Local Offline Mode*. To enable full AI reasoning, "
            f"please set your `MISTRAL_API_KEY` or start local Ollama."
        )

    return {
        "answer": answer,
        "citations": citations,
        "mode": "offline_fallback"
    }


def generate_rag_answer_stream(question: str, retrieved_chunks: list[dict], model: str = None):
    """
    Generates a grounded answer based strictly on retrieved chunks, yielding chunks progressively.
    Automatically handles Mistral Cloud, Local Ollama, or Python Heuristic fallback.
    """
    if not retrieved_chunks:
        yield {"type": "metadata", "citations": [], "mode": "no_context"}
        yield {"type": "chunk", "content": "No relevant document chunks were found. Please upload documents first and ensure they are active."}
        return

    # Format the context and build a citation index map
    context_str = ""
    citations = []
    seen_sources = {}
    
    for idx, chunk in enumerate(retrieved_chunks):
        source = chunk["source"]
        if source not in seen_sources:
            seen_sources[source] = len(seen_sources) + 1
            citations.append({
                "index": seen_sources[source],
                "filename": source
            })
            
        citation_num = seen_sources[source]
        context_str += f"[Ref {citation_num}] (From {source}): {chunk['content']}\n\n"

    # Define system instructions to enforce strict grounding
    system_prompt = (
        "You are ResearchMate, a precise research assistant. "
        "Answer the user's question based strictly on the retrieved document context below. "
        "Do not use any external knowledge. If the context does not contain enough information "
        "to answer, politely state that you cannot find the answer in the provided documents.\n\n"
        "Cite the sources in your answer using bracketed numbers matching the reference numbers, e.g. [1], [2]. "
        "Include citations directly in your sentences when mentioning facts retrieved from a specific document."
    )

    user_prompt = f"Retrieved Context:\n{context_str}\nQuestion: {question}"

    model_id, cfg = resolve_model(model)
    
    if model_id == "offline_fallback":
        res = run_local_synthesizer(question, retrieved_chunks, citations)
        yield {"type": "metadata", "citations": citations, "mode": "offline_fallback", "model": "offline_fallback"}
        yield {"type": "chunk", "content": res["answer"]}
        return
        
    # Set up keys and headers
    if cfg["provider"] == "nvidia":
        api_key = get_nvidia_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": cfg.get("max_tokens", 4096),
            "temperature": cfg.get("temperature", 0.1),
            "top_p": cfg.get("top_p", 1.0),
            "stream": True
        }
        api_mode = "nvidia_cloud"
        api_url = cfg["api_url"]
    elif cfg["provider"] == "ollama":
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "options": {
                "temperature": cfg.get("temperature", 0.1)
            },
            "stream": True
        }
        api_mode = "ollama_local"
        api_url = cfg["api_url"]

    yield {"type": "metadata", "citations": citations, "mode": api_mode, "model": model_id}

    try:
        if cfg["provider"] == "ollama":
            response = session.post(api_url, json=payload, stream=True, timeout=25)
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        try:
                            chunk_data = json.loads(line.decode('utf-8'))
                            content = chunk_data.get("message", {}).get("content", "")
                            if content:
                                yield {"type": "chunk", "content": content}
                        except Exception as e:
                            print(f"Error parsing Ollama stream: {e}")
                return
        else:
            response = session.post(api_url, headers=headers, json=payload, stream=True, timeout=60)
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8').strip()
                        if decoded_line.startswith("data: "):
                            data_str = decoded_line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk_data = json.loads(data_str)
                                delta = chunk_data.get("choices", [{}])[0].get("delta", {})
                                if "content" in delta:
                                    yield {"type": "chunk", "content": delta["content"]}
                            except Exception as e:
                                print(f"Error parsing Cloud SSE: {e}")
                return
            else:
                print(f"Cloud API returned error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error calling Cloud API: {e}")

    # Fallback to Local Ollama
    if check_ollama_status() and model_id != "ollama_local":
        yield from generate_rag_answer_stream(question, retrieved_chunks, model="ollama_local")
    else:
        # Fallback to local synthesizer
        res = run_local_synthesizer(question, retrieved_chunks, citations)
        yield {"type": "chunk", "content": res["answer"]}



def generate_document_comparison(doc1_name: str, doc1_text: str, doc2_name: str, doc2_text: str, model: str = None) -> dict:
    """
    Generates a structured comparative analysis table for two documents across:
    Objectives, Methodology, Datasets, and Conclusions.
    """
    # System instructions for comparison
    system_prompt = (
        "You are a professional research analysis bot. "
        "Compare the two documents provided and output a structured comparative JSON response. "
        "The JSON MUST match the following structure exactly:\n"
        "{\n"
        "  \"objectives\": {\"doc1\": \"Objectives of doc 1\", \"doc2\": \"Objectives of doc 2\"},\n"
        "  \"methodology\": {\"doc1\": \"Methodology of doc 1\", \"doc2\": \"Methodology of doc 2\"},\n"
        "  \"datasets\": {\"doc1\": \"Datasets used in doc 1\", \"doc2\": \"Datasets used in doc 2\"},\n"
        "  \"conclusions\": {\"doc1\": \"Conclusions of doc 1\", \"doc2\": \"Conclusions of doc 2\"}\n"
        "}"
    )

    # Use first 3000 words from each doc to fit prompt limitations
    doc1_excerpt = " ".join(doc1_text.split()[:2000])
    doc2_excerpt = " ".join(doc2_text.split()[:2000])

    user_prompt = (
        f"Document 1 ({doc1_name}):\n{doc1_excerpt}\n\n"
        f"Document 2 ({doc2_name}):\n{doc2_excerpt}\n\n"
        f"Generate the comparison table JSON."
    )

    model_id, cfg = resolve_model(model)
    
    if model_id == "offline_fallback":
        return run_local_comparison_synthesizer(doc1_name, doc1_text, doc2_name, doc2_text)

    # Set up headers and payloads
    if cfg["provider"] == "nvidia":
        api_key = get_nvidia_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": cfg["model"],
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": cfg.get("max_tokens", 4096),
            "temperature": cfg.get("temperature", 0.1),
            "top_p": cfg.get("top_p", 1.0)
        }
        api_mode = "nvidia_cloud"
        api_url = cfg["api_url"]
    elif cfg["provider"] == "ollama":
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt + " Reply ONLY in valid raw JSON. Do not include markdown codeblocks."},
                {"role": "user", "content": user_prompt}
            ],
            "options": {
                "temperature": cfg.get("temperature", 0.1)
            },
            "stream": False
        }
        api_mode = "ollama_local"
        api_url = cfg["api_url"]

    try:
        if cfg["provider"] == "ollama":
            response = session.post(api_url, json=payload, timeout=30)
        else:
            response = session.post(api_url, headers=headers, json=payload, timeout=60)
            
        if response.status_code == 200:
            if cfg["provider"] == "ollama":
                content = response.json()["message"]["content"]
            else:
                content = response.json()["choices"][0]["message"]["content"]
            json_str = extract_json_block(content)
            result_json = json.loads(json_str)
            result_json["mode"] = api_mode
            result_json["model"] = model_id
            return result_json
        else:
            print(f"Cloud Comparison API returned error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error comparing documents via Cloud API: {e}")

    # Fallback to local Ollama or heuristics
    if check_ollama_status() and model_id != "ollama_local":
        return generate_document_comparison(doc1_name, doc1_text, doc2_name, doc2_text, model="ollama_local")
    return run_local_comparison_synthesizer(doc1_name, doc1_text, doc2_name, doc2_text)


def run_local_comparison_synthesizer(doc1_name: str, doc1_text: str, doc2_name: str, doc2_text: str) -> dict:
    """Generates an elegant local extraction summary for document comparisons."""
    
    def extract_field_info(text: str, keywords: list[str]) -> str:
        sentences = [s.strip() for s in text.split(".") if s.strip()]
        matches = []
        for s in sentences:
            if any(kw in s.lower() for kw in keywords):
                matches.append(s)
                if len(matches) >= 2:
                    break
        if matches:
            return ". ".join(matches) + "."
        return "Not explicitly stated. Reference document text to analyze further."

    return {
        "objectives": {
            "doc1": extract_field_info(doc1_text, ["objective", "goal", "aim", "purpose", "introduce", "we propose"]),
            "doc2": extract_field_info(doc2_text, ["objective", "goal", "aim", "purpose", "introduce", "we propose"])
        },
        "methodology": {
            "doc1": extract_field_info(doc1_text, ["method", "architecture", "algorithm", "approach", "framework", "evaluate"]),
            "doc2": extract_field_info(doc2_text, ["method", "architecture", "algorithm", "approach", "framework", "evaluate"])
        },
        "datasets": {
            "doc1": extract_field_info(doc1_text, ["dataset", "data", "corpus", "benchmark", "train", "test"]),
            "doc2": extract_field_info(doc2_text, ["dataset", "data", "corpus", "benchmark", "train", "test"])
        },
        "conclusions": {
            "doc1": extract_field_info(doc1_text, ["conclude", "summary", "future work", "results", "improve"]),
            "doc2": extract_field_info(doc2_text, ["conclude", "summary", "future work", "results", "improve"])
        },
        "mode": "offline_fallback"
    }

def generate_mind_map(doc_name: str, doc_text: str, model: str = None) -> dict:
    """
    Generates a hierarchical mind map structure for a document across main concepts.
    Returns a JSON tree structure.
    """
    system_prompt = (
        "You are a scientific visualizer. Read the document excerpt and produce a hierarchical mind map "
        "of its core ideas, structure, and findings. "
        "Your output MUST be a valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"name\": \"Core Document Title\",\n"
        "  \"children\": [\n"
        "    {\n"
        "      \"name\": \"Main Branch 1 (e.g. Key Objectives)\",\n"
        "      \"children\": [\n"
        "        { \"name\": \"Sub-detail 1.1\", \"children\": [] },\n"
        "        { \"name\": \"Sub-detail 1.2\", \"children\": [] }\n"
        "      ]\n"
        "    },\n"
        "    {\n"
        "      \"name\": \"Main Branch 2 (e.g. Methodology)\",\n"
        "      \"children\": [\n"
        "        { \"name\": \"Sub-detail 2.1\", \"children\": [] }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Keep the depth to 3 levels max. Keep node names brief and conversational (1-6 words). "
        "Return ONLY the raw JSON object. Do not enclose in markdown blocks."
    )

    doc_excerpt = " ".join(doc_text.split()[:2500])
    user_prompt = f"Document ({doc_name}):\n{doc_excerpt}\n\nGenerate the conceptual mind map JSON."

    model_id, cfg = resolve_model(model)
    
    if model_id == "offline_fallback":
        return run_local_mind_map_synthesizer(doc_name, doc_text)

    # Set up headers and payloads
    if cfg["provider"] == "nvidia":
        api_key = get_nvidia_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": cfg["model"],
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": cfg.get("max_tokens", 4096),
            "temperature": cfg.get("temperature", 0.2),
            "top_p": cfg.get("top_p", 1.0)
        }
        api_mode = "nvidia_cloud"
        api_url = cfg["api_url"]
    elif cfg["provider"] == "ollama":
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system_prompt + " Reply ONLY in valid raw JSON. Do not include markdown codeblocks."},
                {"role": "user", "content": user_prompt}
            ],
            "options": {
                "temperature": cfg.get("temperature", 0.2)
            },
            "stream": False
        }
        api_mode = "ollama_local"
        api_url = cfg["api_url"]

    try:
        if cfg["provider"] == "ollama":
            response = session.post(api_url, json=payload, timeout=30)
        else:
            response = session.post(api_url, headers=headers, json=payload, timeout=60)
            
        if response.status_code == 200:
            if cfg["provider"] == "ollama":
                content = response.json()["message"]["content"]
            else:
                content = response.json()["choices"][0]["message"]["content"]
            json_str = extract_json_block(content)
            result_json = json.loads(json_str)
            result_json["mode"] = api_mode
            result_json["model"] = model_id
            return result_json
        else:
            print(f"Cloud Mindmap API returned error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error generating mindmap: {e}")

    # Fallback to local Ollama or heuristics
    if check_ollama_status() and model_id != "ollama_local":
        return generate_mind_map(doc_name, doc_text, model="ollama_local")
    return run_local_mind_map_synthesizer(doc_name, doc_text)


def run_local_mind_map_synthesizer(doc_name: str, doc_text: str) -> dict:
    """Generates an elegant local concept extraction tree for offline mind maps."""
    
    def get_summary_sentences(text: str, keywords: list[str]) -> list:
        sentences = [s.strip() for s in text.split(".") if s.strip()]
        matches = []
        for s in sentences:
            if any(kw in s.lower() for kw in keywords):
                # Clean up and limit length
                clean_s = s.replace("\n", " ").strip()
                if len(clean_s) > 80:
                    clean_s = clean_s[:77] + "..."
                matches.append({"name": clean_s, "children": []})
                if len(matches) >= 3:
                    break
        return matches

    # Build branches
    obj_nodes = get_summary_sentences(doc_text, ["objective", "goal", "aim", "purpose", "introduce", "we propose"])
    meth_nodes = get_summary_sentences(doc_text, ["method", "architecture", "algorithm", "approach", "framework", "evaluate"])
    res_nodes = get_summary_sentences(doc_text, ["conclude", "summary", "results", "improve", "dataset", "accuracy"])

    # Provide defaults if not found
    if not obj_nodes:
        obj_nodes = [{"name": "Analyze core document problem definition.", "children": []}]
    if not meth_nodes:
        meth_nodes = [{"name": "Review experimental methodology frameworks.", "children": []}]
    if not res_nodes:
        res_nodes = [{"name": "Evaluate findings, parameters, and outcomes.", "children": []}]

    title = doc_name
    if len(title) > 35:
        title = title[:32] + "..."

    return {
        "name": title,
        "children": [
            {
                "name": "Core Objectives",
                "children": obj_nodes
            },
            {
                "name": "Scientific Methods",
                "children": meth_nodes
            },
            {
                "name": "Primary Findings",
                "children": res_nodes
            }
        ],
        "mode": "offline_fallback"
    }
