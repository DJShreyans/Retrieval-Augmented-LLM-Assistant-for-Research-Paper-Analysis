import io
import time
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

pdf_path = r".\data-science\2512.08111v1.pdf"
with open(pdf_path, "rb") as f:
    pdf_bytes = f.read()

# 1. Upload
print("1. Uploading PDF...")
files = {"file": ("2512.08111v1.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
res = client.post("/papers/upload", files=files)
assert res.status_code == 200, res.text
draft = res.json()
print("Draft status:", draft["status"])
print("Draft title:", draft["title"])
print("Draft pages:", draft["page_count"])
print("Draft year:", draft["year"])

# 2. Confirm Upload
print("2. Confirming upload and indexing...")
confirm_payload = {
    "file_hash": draft["file_hash"],
    "title": draft["title"] or "Uploaded Evaluation Paper",
    "authors": draft.get("authors"),
    "abstract": draft.get("abstract"),
    "year": draft.get("year") or 2024,
    "visibility": "shared"
}
res_confirm = client.post("/papers/confirm", json=confirm_payload)
assert res_confirm.status_code == 200, res_confirm.text
c_data = res_confirm.json()
paper_id = c_data["paper_id"]
job_id = c_data["job_id"]
print(f"Confirmed: Paper ID={paper_id}, Job ID={job_id}")

# 3. Poll Job
print("3. Polling indexing progress...")
for i in range(30):
    j_res = client.get(f"/jobs/{job_id}")
    assert j_res.status_code == 200
    j_info = j_res.json()
    prog = j_info["progress"]
    stat = j_info["status"]
    print(f"[{i+1}s] Progress: {prog}%, Status: {stat}")
    if stat == "completed":
        break
    time.sleep(1)

# 4. Verify Paper Detail
res_paper = client.get(f"/papers/{paper_id}")
assert res_paper.status_code == 200
p_info = res_paper.json()
print("Paper Ready status:", p_info["status"])

# 5. Verify PDF serving
res_pdf = client.get(f"/papers/{paper_id}/pdf")
assert res_pdf.status_code == 200
print("PDF binary size bytes:", len(res_pdf.content))

# 6. Verify Summary
res_sum = client.get(f"/papers/{paper_id}/summary")
assert res_sum.status_code == 200
s_info = res_sum.json()
print("Contributions count:", len(s_info["key_contributions"]))
print("Top contribution quote:", s_info["key_contributions"][0]["quote"][:100])

# 7. Ask Chat about this paper
print("7. Querying chat with scope=paper...")
res_chat = client.post("/chat", json={
    "message": "What is the main contribution of this paper?",
    "scope": "paper",
    "paper_id": paper_id
})
assert res_chat.status_code == 200
print("Chat stream received successfully!")
print("\n>>> Phase 4 end-to-end verification PASSED successfully! <<<")
