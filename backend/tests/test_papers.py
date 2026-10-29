import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_papers_endpoints():
    # 1. Fetch tags
    res_tags = client.get("/papers/tags")
    assert res_tags.status_code == 200
    tags = res_tags.json()
    assert isinstance(tags, list)
    assert len(tags) > 0

    # 2. Fetch papers page 1
    res_papers = client.get("/papers?page=1&page_size=10&sort_by=newest")
    assert res_papers.status_code == 200
    data = res_papers.json()
    assert data["total"] > 0
    assert len(data["papers"]) > 0
    assert data["page"] == 1
    first_paper = data["papers"][0]
    assert "title" in first_paper
    assert "thumbnail_url" in first_paper

    # 3. Fetch paper detail
    paper_id = first_paper["id"]
    res_detail = client.get(f"/papers/{paper_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == paper_id
    assert detail["title"] == first_paper["title"]

    # 4. Fetch thumbnail
    res_thumb = client.get(f"/thumbnails/{paper_id}.png")
    assert res_thumb.status_code == 200
    assert res_thumb.headers["content-type"] == "image/png"

    # 5. Search papers
    res_search = client.get("/papers?search=attention")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert "papers" in search_data
