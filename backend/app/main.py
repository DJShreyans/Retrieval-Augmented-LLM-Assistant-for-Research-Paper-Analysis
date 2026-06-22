import os
import json
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environmental variables from .env file
load_dotenv()

# Import local modules
from app.rag import (
    ingest_document, 
    query_vector_store, 
    delete_document_from_vector_store, 
    UPLOADS_PATH, 
    extract_text_from_pdf, 
    extract_text_from_docx, 
    extract_text_from_doc,
    ingest_url,
    collection
)
from app.llm import (
    generate_rag_answer, 
    generate_document_comparison, 
    generate_mind_map, 
    generate_rag_answer_stream,
    SUPPORTED_MODELS,
    get_nvidia_api_key,
    check_ollama_status
)

METADATA_FILE = os.path.join(os.path.dirname(UPLOADS_PATH), "documents_metadata.json")

def load_metadata() -> list:
    """Loads document inventory (files + URLs) from JSON. Initializes by scanning uploads/ if empty."""
    if not os.path.exists(METADATA_FILE):
        files = []
        if os.path.exists(UPLOADS_PATH):
            for file_name in os.listdir(UPLOADS_PATH):
                file_path = os.path.join(UPLOADS_PATH, file_name)
                if os.path.isfile(file_path):
                    stat_info = os.stat(file_path)
                    size_mb = round(stat_info.st_size / (1024 * 1024), 2)
                    creation_time = datetime.fromtimestamp(stat_info.st_ctime).strftime("%Y-%m-%d %H:%M:%S")
                    ext = os.path.splitext(file_name)[1].lower()
                    files.append({
                        "filename": file_name,
                        "size_mb": size_mb if size_mb > 0.01 else 0.01,
                        "uploaded_at": creation_time,
                        "type": ext[1:],
                        "source_type": "file"
                    })
        save_metadata(files)
        return files
        
    try:
        with open(METADATA_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_metadata(data: list):
    """Saves document inventory to JSON metadata file."""
    try:
        with open(METADATA_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error writing metadata file: {e}")

def get_document_full_text(doc_id: str) -> str:
    """Retrieves full text of a file or URL resource by checking metadata and loading from disk or ChromaDB."""
    metadata = load_metadata()
    doc_entry = next((item for item in metadata if item["filename"] == doc_id), None)
    
    if not doc_entry:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found in database.")
        
    if doc_entry.get("source_type") == "url" or doc_entry.get("type") == "url":
        # It's a website URL! Retrieve its chunks from ChromaDB and join them
        results = collection.get(where={"source": doc_id})
        if not results or not results["documents"]:
            return "No content cached for this website URL."
            
        # Sort chunks by chunk_index to restore natural reading order
        chunks_with_index = []
        for i in range(len(results["documents"])):
            meta = results["metadatas"][i]
            chunks_with_index.append({
                "index": meta.get("chunk_index", 0),
                "text": results["documents"][i]
            })
        chunks_with_index.sort(key=lambda x: x["index"])
        return " ".join([c["text"] for c in chunks_with_index])
        
    # It's a local file
    file_path = os.path.join(UPLOADS_PATH, doc_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document file not found on disk at: {doc_id}")
        
    ext = os.path.splitext(doc_id)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext == ".doc":
        return extract_text_from_doc(file_path)
    else:
         raise HTTPException(status_code=400, detail=f"Unsupported format '{ext}' for full-text extraction.")

app = FastAPI(
    title="ResearchMate API",
    description="Local RAG-based backend for document upload, vector storage, and Mistral QA.",
    version="1.0.0"
)

# Backend services do not need model preloading since we utilize cloud-hosted embeddings and ranking


# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits localhost:3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas for request payloads
class ChatRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None  # Optional list of filenames to filter by
    rerank: Optional[bool] = True
    model: Optional[str] = None

class CompareRequest(BaseModel):
    doc1_id: str
    doc2_id: str
    model: Optional[str] = None

class UrlRequest(BaseModel):
    url: str

@app.get("/")
def read_root():
    return {"message": "ResearchMate API is running successfully!", "status": "online"}

@app.get("/models")
def get_available_models():
    """
    Returns all supported models indicating which ones are available 
    based on API keys and local Ollama status.
    """
    nvidia_active = bool(get_nvidia_api_key())
    ollama_active = check_ollama_status()
    
    models_list = []
    for model_id, cfg in SUPPORTED_MODELS.items():
        available = False
        if cfg["provider"] == "nvidia":
            available = nvidia_active
        elif cfg["provider"] == "ollama":
            available = ollama_active
            
        friendly_name = model_id
        if model_id == "moonshotai/kimi-k2.6":
            friendly_name = "Kimi K2.6 (NVIDIA Cloud)"
        elif model_id == "meta/llama-3.3-70b-instruct":
            friendly_name = "Llama 3.3 70B (NVIDIA Cloud)"
        elif model_id == "ollama_local":
            friendly_name = "Ollama Local (Mistral)"
            
        models_list.append({
            "id": model_id,
            "name": friendly_name,
            "provider": cfg["provider"],
            "available": available
        })
        
    return {"models": models_list}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a PDF, DOCX, or DOC file, stores it locally, and indexes it into ChromaDB.
    """
    file_name = file.filename
    ext = os.path.splitext(file_name)[1].lower()
    
    if ext not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type '{ext}'. ResearchMate only supports .pdf, .docx, and .doc documents."
        )
        
    save_path = os.path.join(UPLOADS_PATH, file_name)
    
    # Save file locally
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file locally: {str(e)}")
        
    # Run ingestion pipeline (extract, chunk, embed, store)
    try:
        ingestion_results = ingest_document(file_name, save_path)
        
        # Save file metadata
        metadata = load_metadata()
        # Prevent duplicate entries in metadata
        metadata = [item for item in metadata if item["filename"] != file_name]
        
        stat_info = os.stat(save_path)
        size_mb = round(stat_info.st_size / (1024 * 1024), 2)
        creation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        metadata.append({
            "filename": file_name,
            "size_mb": size_mb if size_mb > 0.01 else 0.01,
            "uploaded_at": creation_time,
            "type": ext[1:],
            "source_type": "file"
        })
        save_metadata(metadata)
        
        return {
            "message": "File uploaded and ingested successfully!",
            "filename": file_name,
            "chunks_created": ingestion_results["num_chunks"],
            "character_count": ingestion_results["total_characters"]
        }
    except Exception as e:
        # If vector indexing fails, clean up the local file to avoid orphaned documents
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"RAG Ingestion pipeline failed: {str(e)}")

@app.post("/url")
def ingest_website_url(request: UrlRequest):
    """
    Ingests website URL content, extracts text body, chunks, embeds, 
    stores in ChromaDB, and indexes its resource reference.
    """
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
        
    metadata = load_metadata()
    if any(item["filename"] == url for item in metadata):
        raise HTTPException(status_code=400, detail="This URL is already ingested. Delete it to re-ingest.")
        
    try:
        res = ingest_url(url)
        
        # Calculate size approximation based on chars (1 char ≈ 1 byte)
        size_mb = round(res["total_characters"] / (1024 * 1024), 4)
        creation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        metadata.append({
            "filename": url,
            "size_mb": size_mb if size_mb > 0.01 else 0.01,
            "uploaded_at": creation_time,
            "type": "url",
            "source_type": "url",
            "title": res["title"]
        })
        save_metadata(metadata)
        
        return {
            "message": "Website scraped and ingested successfully!",
            "filename": url,
            "title": res["title"],
            "chunks_created": res["num_chunks"],
            "character_count": res["total_characters"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scrape and ingest website content: {str(e)}")

@app.get("/documents")
def list_documents():
    """
    Returns a unified list of files and scraped URLs registered in the metadata database.
    """
    files = load_metadata()
    # Sort files by newest uploaded first
    files.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return files

@app.delete("/documents/{filename:path}")
def delete_document(filename: str):
    """
    Deletes a document from the vector store and database. 
    Deletes files from disk if source is local.
    """
    metadata = load_metadata()
    doc_entry = next((item for item in metadata if item["filename"] == filename), None)
    
    if not doc_entry:
        raise HTTPException(status_code=404, detail="Document not registered in metadata database.")
        
    try:
        # 1. Remove from vector database
        delete_document_from_vector_store(filename)
        
        # 2. If it's a physical file, remove it from disk
        if doc_entry.get("source_type") == "file":
            file_path = os.path.join(UPLOADS_PATH, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                
        # 3. Remove from metadata list and save
        metadata = [item for item in metadata if item["filename"] != filename]
        save_metadata(metadata)
        
        return {"message": f"Resource '{filename}' successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@app.post("/chat")
def chat_with_documents(request: ChatRequest):
    """
    RAG Endpoint: Retrieves relevant context blocks and streams the synthesized answer.
    """
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
        
    # Retrieve relevant document segments from ChromaDB
    try:
        chunks = query_vector_store(query, file_filter=request.document_ids, top_k=4, rerank=request.rerank)
        
        def event_generator():
            try:
                for chunk in generate_rag_answer_stream(query, chunks, model=request.model):
                    if chunk["type"] == "metadata":
                        chunk["retrieved_context"] = chunks
                    yield f"data: {json.dumps(chunk)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
                
        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
        return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG search execution failed: {str(e)}")

@app.post("/compare")
def compare_documents(request: CompareRequest):
    """
    Structural comparison endpoint: Extracts text from both documents (files or URLs) and summarizes them in a table.
    """
    try:
        # Extract full text contents
        text1 = get_document_full_text(request.doc1_id)
        text2 = get_document_full_text(request.doc2_id)
        
        # Compare text using LLM or fallback heuristics
        comparison = generate_document_comparison(request.doc1_id, text1, request.doc2_id, text2, model=request.model)
        return comparison
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document comparison failed: {str(e)}")

class MindMapRequest(BaseModel):
    doc_id: str
    model: Optional[str] = None

@app.post("/mindmap")
def generate_doc_mind_map(request: MindMapRequest):
    """
    Mind Map endpoint: Retrieves the full text of a file or URL and extracts a concept tree.
    """
    try:
        # Retrieve full text contents
        text = get_document_full_text(request.doc_id)
        
        # Generate mind map JSON structure
        mindmap = generate_mind_map(request.doc_id, text, model=request.model)
        return mindmap
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mind map generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
