import os
from dotenv import load_dotenv
load_dotenv()
import json
import requests

# Default configuration
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
OLLAMA_API_URL = "http://localhost:11434/api/chat"

def get_mistral_api_key() -> str:
    """Retrieves the Mistral API Key from environment variables."""
    return os.environ.get("MISTRAL_API_KEY", "").strip()

def check_ollama_status() -> bool:
    """Checks if Ollama is running locally on port 11434."""
    try:
        response = requests.get("http://localhost:11434", timeout=1)
        return response.status_code == 200
    except requests.RequestException:
        return False

def generate_rag_answer(question: str, retrieved_chunks: list[dict]) -> dict:
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

    # Try Mistral Cloud API
    api_key = get_mistral_api_key()
    print("API KEY FOUND:", bool(api_key))
    print("API KEY VALUE:", api_key[:10] if api_key else "NONE")
    if api_key:
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1
            }
            response = requests.post(MISTRAL_API_URL, headers=headers, json=payload, timeout=20)
            if response.status_code == 200:
                answer = response.json()["choices"][0]["message"]["content"]
                return {
                    "answer": answer,
                    "citations": citations,
                    "mode": "mistral_cloud"
                }
            else:
                print(f"Mistral API returned error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error calling Mistral Cloud API: {e}")

    # Try Local Ollama (Mistral)
    if check_ollama_status():
        try:
            payload = {
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "options": {
                    "temperature": 0.1
                },
                "stream": False
            }
            response = requests.post(OLLAMA_API_URL, json=payload, timeout=25)
            if response.status_code == 200:
                answer = response.json()["message"]["content"]
                return {
                    "answer": answer,
                    "citations": citations,
                    "mode": "ollama_local"
                }
        except Exception as e:
            print(f"Error calling local Ollama: {e}")

    # Python Heuristic Synthesizer Fallback (Zero network dependencies)
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


def generate_document_comparison(doc1_name: str, doc1_text: str, doc2_name: str, doc2_text: str) -> dict:
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

    api_key = get_mistral_api_key()
    
    # 1. Try Mistral Cloud
    if api_key:
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "mistral-small-latest",
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1
            }
            response = requests.post(MISTRAL_API_URL, headers=headers, json=payload, timeout=25)
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                # Clean up any potential markdown wraps (e.g. ```json ... ```)
                content = content.replace("```json", "").replace("```", "").strip()
                result_json = json.loads(content)
                result_json["mode"] = "mistral_cloud"
                return result_json
            else:
                print(f"Mistral Comparison API returned error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error comparing documents via Mistral Cloud: {e}")

    # 2. Try Local Ollama
    if check_ollama_status():
        try:
            payload = {
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": system_prompt + " Reply ONLY in valid raw JSON. Do not include markdown codeblocks."},
                    {"role": "user", "content": user_prompt}
                ],
                "options": {
                    "temperature": 0.1
                },
                "stream": False
            }
            response = requests.post(OLLAMA_API_URL, json=payload, timeout=30)
            if response.status_code == 200:
                content = response.json()["message"]["content"]
                # Clean up any potential markdown wraps
                content = content.replace("```json", "").replace("```", "").strip()
                result_json = json.loads(content)
                result_json["mode"] = "ollama_local"
                return result_json
        except Exception as e:
            print(f"Error comparing documents via local Ollama: {e}")

    # 3. Fallback Heuristic Comparison
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

def generate_mind_map(doc_name: str, doc_text: str) -> dict:
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

    api_key = get_mistral_api_key()

    # 1. Try Mistral Cloud
    if api_key:
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "mistral-small-latest",
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2
            }
            response = requests.post(MISTRAL_API_URL, headers=headers, json=payload, timeout=25)
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                content = content.replace("```json", "").replace("```", "").strip()
                result_json = json.loads(content)
                result_json["mode"] = "mistral_cloud"
                return result_json
            else:
                print(f"Mistral Mindmap API returned error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error generating mindmap via Mistral Cloud: {e}")

    # 2. Try Local Ollama
    if check_ollama_status():
        try:
            payload = {
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": system_prompt + " Reply ONLY in valid raw JSON. Do not include markdown codeblocks."},
                    {"role": "user", "content": user_prompt}
                ],
                "options": {
                    "temperature": 0.2
                },
                "stream": False
            }
            response = requests.post(OLLAMA_API_URL, json=payload, timeout=30)
            if response.status_code == 200:
                content = response.json()["message"]["content"]
                content = content.replace("```json", "").replace("```", "").strip()
                result_json = json.loads(content)
                result_json["mode"] = "ollama_local"
                return result_json
        except Exception as e:
            print(f"Error generating mindmap via Ollama: {e}")

    # 3. Heuristic Fallback
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
