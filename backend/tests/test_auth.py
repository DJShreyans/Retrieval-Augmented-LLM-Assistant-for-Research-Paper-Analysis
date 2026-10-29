import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import User

client = TestClient(app)

def test_auth_registration_and_login():
    test_email = "test_researcher_p3@university.edu"
    test_password = "SecurePassword123!"

    # Clean up test user if exists
    db = SessionLocal()
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    # 1. Register short password (should fail)
    res_short = client.post("/auth/register", json={
        "email": test_email,
        "password": "short",
        "full_name": "Test Short"
    })
    assert res_short.status_code == 400

    # 2. Register valid user
    res_reg = client.post("/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": "Dr. Test Researcher"
    })
    assert res_reg.status_code == 200
    user_data = res_reg.json()
    assert user_data["email"] == test_email
    assert "access_token" in res_reg.cookies

    # 3. Duplicate registration (should fail)
    res_dup = client.post("/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": "Dr. Test Duplicate"
    })
    assert res_dup.status_code == 400

    # 4. Login with bad password (should fail)
    res_bad = client.post("/auth/login", json={
        "email": test_email,
        "password": "WrongPassword!"
    })
    assert res_bad.status_code == 401

    # 5. Login with correct password (should succeed)
    res_login = client.post("/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == test_email

    # 6. Check authenticated /auth/me
    token = login_data["access_token"]
    res_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == test_email

    # 7. Check logout
    res_logout = client.post("/auth/logout")
    assert res_logout.status_code == 200
