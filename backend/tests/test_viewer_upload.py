import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import Paper, Job

client = TestClient(app)

def test_paper_pdf_and_summary_endpoints():
    db = SessionLocal()
    paper = db.query(Paper).first()
    assert paper is not None, "At least one paper should be indexed"
    paper_id = paper.id
    db.close()

    # 1. Test PDF binary serving
    res_pdf = client.get(f"/papers/{paper_id}/pdf")
    assert res_pdf.status_code == 200
    assert "application/pdf" in res_pdf.headers["content-type"]
    assert len(res_pdf.content) > 1000

    # 2. Test Summary GET
    res_sum = client.get(f"/papers/{paper_id}/summary")
    assert res_sum.status_code == 200
    summary_data = res_sum.json()
    assert "key_contributions" in summary_data
    assert "methodology" in summary_data
    assert "datasets" in summary_data
    assert "results" in summary_data
    assert "limitations" in summary_data
    # Verify quotes and page numbers
    assert len(summary_data["key_contributions"]) > 0
    contrib = summary_data["key_contributions"][0]
    assert "quote" in contrib
    assert "page" in contrib

    # 3. Test Summary POST (Regenerate)
    res_regen = client.post(f"/papers/{paper_id}/summary")
    assert res_regen.status_code == 200
    regen_data = res_regen.json()
    assert "key_contributions" in regen_data

    # 4. Test References GET
    res_refs = client.get(f"/papers/{paper_id}/references")
    assert res_refs.status_code == 200
    ref_data = res_refs.json()
    assert "references" in ref_data
    assert "count" in ref_data

def test_paper_upload_and_job_endpoints():
    db = SessionLocal()
    existing_paper = db.query(Paper).first()
    assert existing_paper is not None
    paper_id = existing_paper.id
    db.close()

    # Get actual PDF bytes from the existing paper
    res_pdf = client.get(f"/papers/{paper_id}/pdf")
    pdf_bytes = res_pdf.content

    # 1. Test duplicate upload detection
    files = {"file": ("test_duplicate.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_dup = client.post("/papers/upload", files=files)
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["status"] == "duplicate"
    assert dup_data["paper_id"] == paper_id

    # 2. Test job polling endpoint on a mock/created job
    db = SessionLocal()
    job = Job(type="test_job", status="running", progress=0.65)
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = job.id
    db.close()

    res_job = client.get(f"/jobs/{job_id}")
    assert res_job.status_code == 200
    job_info = res_job.json()
    assert job_info["id"] == job_id
    assert job_info["status"] == "running"
    assert job_info["progress"] == 65.0
