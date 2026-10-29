import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import User, Paper, Chat, Message
from backend.app.security import hash_password, create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_users():
    db = SessionLocal()
    # Ensure User A and User B exist
    user_a = db.query(User).filter(User.email == "user_a@test.com").first()
    if not user_a:
        user_a = User(
            email="user_a@test.com",
            hashed_password=hash_password("PassA12345!"),
            full_name="User Alpha",
            role="user",
            is_active=True
        )
        db.add(user_a)

    user_b = db.query(User).filter(User.email == "user_b@test.com").first()
    if not user_b:
        user_b = User(
            email="user_b@test.com",
            hashed_password=hash_password("PassB12345!"),
            full_name="User Beta",
            role="user",
            is_active=True
        )
        db.add(user_b)

    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    token_a = create_access_token({"sub": str(user_a.id), "email": user_a.email, "role": user_a.role})
    token_b = create_access_token({"sub": str(user_b.id), "email": user_b.email, "role": user_b.role})

    # Create a private paper belonging to User B
    private_paper = db.query(Paper).filter(Paper.storage_key == "papers/test_private_b.pdf").first()
    if not private_paper:
        private_paper = Paper(
            title="Private Research Document by User B",
            file_hash="dummy_private_hash_b_1234567890abcdef",
            storage_key="papers/test_private_b.pdf",
            page_count=5,
            has_text=True,
            visibility="private",
            owner_id=user_b.id,
            status="indexed"
        )
        db.add(private_paper)
        db.commit()
        db.refresh(private_paper)

    # Create a private chat belonging to User B
    chat_b = Chat(
        user_id=user_b.id,
        title="User B Secret Research Discussion"
    )
    db.add(chat_b)
    db.commit()
    db.refresh(chat_b)

    u_a_id = user_a.id
    u_b_id = user_b.id
    p_id = private_paper.id
    c_b_id = chat_b.id

    db.close()

    yield {
        "user_a_id": u_a_id,
        "token_a": token_a,
        "user_b_id": u_b_id,
        "token_b": token_b,
        "private_paper_id": p_id,
        "chat_b_id": c_b_id
    }

def test_unauthenticated_requests_rejected():
    """Verify endpoints requiring authentication reject unauthenticated requests."""
    # 1. /auth/me without token
    res = client.get("/auth/me")
    assert res.status_code == 401

    # 2. /settings without token
    res = client.get("/settings")
    assert res.status_code == 401

    # 3. /settings/reindex without token
    res = client.post("/settings/reindex")
    assert res.status_code == 401

def test_user_isolation_private_papers(setup_users):
    """Verify User A cannot access User B's private paper metadata, PDF, or summary."""
    data = setup_users
    headers_a = {"Authorization": f"Bearer {data['token_a']}"}
    headers_b = {"Authorization": f"Bearer {data['token_b']}"}
    paper_id = data["private_paper_id"]

    # 1. User B can access their own private paper
    res_b = client.get(f"/papers/{paper_id}", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["title"] == "Private Research Document by User B"

    # 2. User A cannot access User B's private paper detail (403 Forbidden)
    res_a = client.get(f"/papers/{paper_id}", headers=headers_a)
    assert res_a.status_code == 403

    # 3. User A cannot access User B's private PDF (403 Forbidden)
    res_pdf_a = client.get(f"/papers/{paper_id}/pdf", headers=headers_a)
    assert res_pdf_a.status_code == 403

    # 4. User A cannot access User B's private paper summary (403 Forbidden)
    res_sum_a = client.get(f"/papers/{paper_id}/summary", headers=headers_a)
    assert res_sum_a.status_code == 403

    # 5. User A's library listing does not include User B's private paper
    res_list_a = client.get("/papers?page_size=100", headers=headers_a)
    assert res_list_a.status_code == 200
    titles_a = [p["title"] for p in res_list_a.json()["papers"]]
    assert "Private Research Document by User B" not in titles_a

def test_user_isolation_chats(setup_users):
    """Verify User A cannot view or delete User B's chat history or messages."""
    data = setup_users
    headers_a = {"Authorization": f"Bearer {data['token_a']}"}
    headers_b = {"Authorization": f"Bearer {data['token_b']}"}
    chat_id = data["chat_b_id"]

    # 1. User B can view their chat
    res_b = client.get(f"/chat/{chat_id}", headers=headers_b)
    assert res_b.status_code == 200

    # 2. User A cannot view User B's chat (404 Not Found)
    res_a = client.get(f"/chat/{chat_id}", headers=headers_a)
    assert res_a.status_code == 404

    # 3. User A cannot delete User B's chat (404 Not Found)
    res_del_a = client.delete(f"/chat/{chat_id}", headers=headers_a)
    assert res_del_a.status_code == 404

    # 4. User B can delete their own chat
    res_del_b = client.delete(f"/chat/{chat_id}", headers=headers_b)
    assert res_del_b.status_code == 200

def test_invalid_google_token_rejected():
    """Verify invalid or forged Google tokens are rejected."""
    # Test with bogus credential
    response = client.post("/auth/google", json={"credential": "forged.header.payload.signature"})
    assert response.status_code in (400, 401, 500)  # depending on whether GOOGLE_CLIENT_ID is set
