import pytest
import json
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.rag import sanitize_citations

client = TestClient(app)

def test_citation_sanitization():
    # Max citation count is 3
    raw_text = "According to [1] and [2], the result is valid. However [4] is invalid and [99] does not exist."
    sanitized = sanitize_citations(raw_text, max_n=3)
    assert "[1]" in sanitized
    assert "[2]" in sanitized
    assert "[4]" not in sanitized
    assert "[99]" not in sanitized

def test_search_endpoint():
    payload = {
        "query": "learning",
        "top_k": 3
    }
    response = client.post("/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "learning"
    assert "results" in data
    assert len(data["results"]) > 0
    res0 = data["results"][0]
    assert "title" in res0
    assert "page_start" in res0
    assert "score" in res0

def test_chat_stream_endpoint():
    payload = {
        "message": "What is defensive boosting?",
        "scope": "library"
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    # Read SSE events
    body = response.text
    assert "data: " in body
    assert "done" in body
    assert "citations" in body

def test_chat_history_endpoint():
    response = client.get("/chat/history")
    assert response.status_code == 200
    data = response.json()
    assert "today" in data
    assert "yesterday" in data
    assert "last_7_days" in data
