# ResearchMate Production Deployment Guide

This guide provides exact, copy-paste instructions to deploy **ResearchMate** onto a single Linux VPS (Ubuntu 22.04 or 24.04 LTS, at least 4 GB RAM, 2+ CPU cores, 50+ GB SSD) under your custom domain with automatic HTTPS.

---

## ⚠️ Architectural Warning: What NOT To Do

> [!CAUTION]
> **DO NOT host the backend on serverless platforms (e.g., Vercel Functions, AWS Lambda, or Render free tier ephemeral containers).**
> 
> **Why?**
> 1. **Persistent Local State**: ResearchMate relies on high-speed local disk reads for the SQLite corpus store (`data/corpus.db`) and the FAISS vector index (`data/faiss/index.faiss`). Serverless environments have ephemeral filesystems that discard state on every cold start.
> 2. **In-Memory Embedding Model**: The embedding model (`BAAI/bge-small-en-v1.5`) is loaded into memory to achieve sub-50ms hybrid search latencies. Serverless cold starts would re-initialize PyTorch on every invocation, causing unacceptable 10–25 second response delays or out-of-memory errors.
> 3. **Dual-Store Model**: Relational user data lives in PostgreSQL, while the read-mostly document index lives as files on the local VPS SSD.

---

## Step 1: DNS, Firewall & Server Hardening

### 1. Configure DNS
In your DNS registrar (Cloudflare, Namecheap, Route 53, etc.), create an **A Record**:
- **Type**: `A`
- **Name**: `@` (or subdomain, e.g., `researchmate`)
- **Target**: `<YOUR_VPS_PUBLIC_IP>`
- **TTL**: Auto / 300 seconds

### 2. Connect to VPS & Create Dedicated User
```bash
ssh root@<YOUR_VPS_PUBLIC_IP>

# Create a non-root application user
adduser --disabled-password --gecos "" researchmate
usermod -aG sudo researchmate

# Copy root SSH keys to the researchmate user
mkdir -p /home/researchmate/.ssh
cp ~/.ssh/authorized_keys /home/researchmate/.ssh/
chown -R researchmate:researchmate /home/researchmate/.ssh
chmod 700 /home/researchmate/.ssh
chmod 600 /home/researchmate/.ssh/authorized_keys

# Switch to the new user
su - researchmate
```

### 3. Configure UFW Firewall (80, 443, 22 Only)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Let's Encrypt challenge)
sudo ufw allow 443/tcp   # HTTPS (Encrypted traffic)
sudo ufw --force enable
sudo ufw status verbose
```

---

## Step 2: System Dependencies, Node.js & PostgreSQL

### 1. Update Packages & Install System Tools
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential sqlite3 libsqlite3-dev python3.11 python3.11-venv python3.11-dev
```

### 2. Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version # Verify v20+
```

### 3. Install & Configure PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and application user
sudo -u postgres psql << EOF
CREATE DATABASE researchmate_db;
CREATE USER researchmate_user WITH ENCRYPTED PASSWORD 'ReplaceWithStrongDBPassword!';
GRANT ALL PRIVILEGES ON DATABASE researchmate_db TO researchmate_user;
ALTER DATABASE researchmate_db OWNER TO researchmate_user;
\c researchmate_db
GRANT ALL ON SCHEMA public TO researchmate_user;
EOF
```

---

## Step 3: Application Codebase & CPU-Only PyTorch

### 1. Clone Repository into `/opt/researchmate`
```bash
sudo mkdir -p /opt/researchmate
sudo chown -R researchmate:researchmate /opt/researchmate
cd /opt/researchmate

# Clone your project repository
git clone https://github.com/your-username/researchmate.git .
```

### 2. Create Python Virtual Environment & Install CPU PyTorch
```bash
python3.11 -m venv venv
source venv/bin/activate

# Install CPU-only PyTorch wheels (avoids ~4 GB of CUDA packages on CPU VPS)
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 3. Install Frontend Dependencies & Build Bundle
```bash
cd /opt/researchmate/frontend
npm install
npm run build
cd /opt/researchmate
```

---

## Step 4: Transfer Pre-Built Index from Laptop

Because embedding thousands of chunks is already complete on your local machine, copy the SQLite corpus, FAISS vectors, and thumbnails directly to the server:

**Run this on your local laptop (PowerShell):**
```powershell
# From d:\R2 on your local machine:
scp -r data/corpus.db researchmate@<YOUR_VPS_PUBLIC_IP>:/opt/researchmate/data/
scp -r data/faiss researchmate@<YOUR_VPS_PUBLIC_IP>:/opt/researchmate/data/
scp -r data/thumbnails researchmate@<YOUR_VPS_PUBLIC_IP>:/opt/researchmate/data/
```

**Back on the VPS:**
```bash
sudo chown -R researchmate:researchmate /opt/researchmate/data
chmod -R 755 /opt/researchmate/data
```

### Run Migrations & Seed Admin
```bash
cd /opt/researchmate
source venv/bin/activate

# Run Alembic migrations against PostgreSQL
alembic upgrade head

# Seed the initial admin account
python backend/scripts/seed_admin.py
```

---

## Step 5: Production Environment Configuration (`.env`)

Create `/opt/researchmate/.env` with strict permissions:
```bash
chmod 600 /opt/researchmate/.env
nano /opt/researchmate/.env
```

Paste the following production configuration (replace values accordingly):
```env
# ================================================================
# ResearchMate Production Environment Configuration
# ================================================================

# Application Mode & URLs
DEBUG=false
PUBLIC_BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
COOKIE_DOMAIN=your-domain.com
COOKIE_SECURE=true

# Database (PostgreSQL Production Store)
DATABASE_URL=postgresql://researchmate_user:ReplaceWithStrongDBPassword!@127.0.0.1:5432/researchmate_db
PGHOST=127.0.0.1
PGUSER=researchmate_user
PGDATABASE=researchmate_db
POSTGRES_PASSWORD=ReplaceWithStrongDBPassword!

# Security & Sessions
JWT_SECRET=generate_with_openssl_rand_hex_32_here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14
ADMIN_EMAILS=admin@your-domain.com

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# LLM Provider Configuration (none = 100% free local extractive mode)
LLM_PROVIDER=none
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=
GEMINI_API_KEY=

# Retrieval Engine Settings
USE_RERANKER=false
EMBEDDING_DEVICE=cpu
RRF_K=60

# Corpus File Locations
CORPUS_DB_PATH=/opt/researchmate/data/corpus.db
FAISS_INDEX_PATH=/opt/researchmate/data/faiss/index.faiss
PDF_SOURCE=local
PDF_DIR=/opt/researchmate/data/papers
```

> **Generate a strong JWT Secret:**  
> Run `openssl rand -hex 32` and paste into `JWT_SECRET`.

---

## Step 6: Systemd Services Setup

Install the pre-configured systemd service units for the backend and frontend:

```bash
# 1. Copy service files to systemd directory
sudo cp /opt/researchmate/deploy/researchmate-backend.service /etc/systemd/system/
sudo cp /opt/researchmate/deploy/researchmate-frontend.service /etc/systemd/system/

# 2. Reload systemd daemon
sudo systemctl daemon-reload

# 3. Enable services to start automatically on system boot
sudo systemctl enable researchmate-backend
sudo systemctl enable researchmate-frontend

# 4. Start both services
sudo systemctl start researchmate-backend
sudo systemctl start researchmate-frontend

# 5. Check status
sudo systemctl status researchmate-backend --no-pager
sudo systemctl status researchmate-frontend --no-pager
```

---

## Step 7: Caddy Reverse Proxy & Automatic HTTPS

Caddy provides automatic zero-configuration TLS certificate issuance via Let's Encrypt / ZeroSSL, automatic certificate renewals, and same-origin reverse proxy routing.

### 1. Install Caddy
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 2. Configure Caddyfile
Edit `/opt/researchmate/deploy/Caddyfile` and replace `your-domain.com` with your actual domain:
```bash
nano /opt/researchmate/deploy/Caddyfile
```

Copy it into place and reload Caddy:
```bash
sudo cp /opt/researchmate/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 3. Verify Same-Origin Setup
With Caddy configured:
- `https://your-domain.com` $\rightarrow$ Next.js SSR / Static Frontend (port 3000)
- `https://your-domain.com/api/*` $\rightarrow$ FastAPI Backend (port 8000, `/api` prefix stripped)
- **Result**: Zero CORS issues, cookies delivered seamlessly across all endpoints under `SameSite=Lax; Secure; HttpOnly`.

---

## Step 8: Update Google Cloud Console OAuth

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Edit your **OAuth 2.0 Web Application Client**.
3. Under **Authorized JavaScript origins**, add:
   - `https://your-domain.com`
4. Under **Authorized redirect URIs** (if applicable), add:
   - `https://your-domain.com`
5. Save changes.

---

## Step 9: Automated Nightly Backups & Restore Test

### 1. Set Up Nightly Cron Job
Make backup scripts executable:
```bash
chmod +x /opt/researchmate/deploy/backup.sh
chmod +x /opt/researchmate/deploy/restore.sh
```

Add a root cron job to run nightly at 3:00 AM UTC:
```bash
sudo crontab -e
```
Add the following line:
```cron
0 3 * * * /opt/researchmate/deploy/backup.sh >> /var/log/researchmate_backup.log 2>&1
```

### 2. Test Backup Execution
Run manual test backup:
```bash
sudo /opt/researchmate/deploy/backup.sh
ls -lh /opt/researchmate/backups/
```

### 3. Test Disaster Recovery Restore
Verify backup integrity using the restore test script:
```bash
LATEST_BACKUP=$(ls -t /opt/researchmate/backups/*.tar.gz | head -n 1)
sudo /opt/researchmate/deploy/restore.sh "$LATEST_BACKUP"
```

---

## Step 10: Final Verification Checklist

- [ ] Open `https://your-domain.com` in an incognito window from a separate device.
- [ ] Confirm automatic HTTPS certificate pad lock (A+ TLS configuration).
- [ ] Sign in using admin credentials (`admin@your-domain.com`).
- [ ] Sign in using Google OAuth ("Continue with Google").
- [ ] Browse Library: thumbnails render and tag filters function.
- [ ] Open Paper Viewer: split-screen PDF renders with citation bookmarks.
- [ ] Ask a chat question: streaming response with inline `[n]` citations returns within 1 second.
- [ ] Check system telemetry on `/settings`.
- [ ] Confirm health check returns 200 OK:
  ```bash
  curl -I https://your-domain.com/api/health
  # HTTP/2 200
  ```
