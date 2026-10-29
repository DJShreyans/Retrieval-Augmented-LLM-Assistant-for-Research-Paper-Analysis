import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import bcrypt
from backend.app.config import settings
from backend.app.db import SessionLocal
from backend.app.models import User

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def seed():
    db = SessionLocal()
    try:
        admin_emails = settings.admin_emails_list
        if not admin_emails:
            admin_emails = ["admin@example.com"]

        for email in admin_emails:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                default_password = "AdminPassword123!"
                hashed = hash_password(default_password)
                user = User(
                    email=email,
                    hashed_password=hashed,
                    full_name="System Administrator",
                    role="admin",
                    is_active=True
                )
                db.add(user)
                db.commit()
                print(f"[Seed] Created admin user: {email} with default password: {default_password}")
            else:
                if user.role != "admin":
                    user.role = "admin"
                    db.commit()
                    print(f"[Seed] Updated existing user {email} to admin role.")
                else:
                    print(f"[Seed] Admin user {email} already exists.")
        print("[Seed] Seeding completed successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
