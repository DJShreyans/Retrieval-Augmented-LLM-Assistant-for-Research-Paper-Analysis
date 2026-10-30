#!/usr/bin/env bash
# ================================================================
# ResearchMate Remote Server Deployment Script
# Executed automatically via GitHub Actions CI/CD on git push
# ================================================================

set -euo pipefail

APP_DIR="/opt/researchmate"
BRANCH="main"

echo "================================================================"
echo "🚀 Starting ResearchMate Automated Deployment: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

cd "${APP_DIR}"

# 1. Stash any local file alterations (if any) and pull latest commits
echo "[1/6] Pulling latest code from branch ${BRANCH}..."
git fetch origin ${BRANCH}
git reset --hard "origin/${BRANCH}"

# 2. Update Python virtual environment if dependencies changed
echo "[2/6] Checking backend dependencies..."
source "${APP_DIR}/venv/bin/activate"
pip install --upgrade pip --quiet
pip install -r "${APP_DIR}/backend/requirements.txt" --quiet

# 3. Apply database migrations
echo "[3/6] Running Alembic database migrations..."
alembic upgrade head

# 4. Build Frontend Next.js production bundle
echo "[4/6] Building Next.js production frontend..."
cd "${APP_DIR}/frontend"
npm install --silent
npm run build
cd "${APP_DIR}"

# 5. Restart services with systemd
echo "[5/6] Restarting systemd services..."
sudo systemctl restart researchmate-backend
sudo systemctl restart researchmate-frontend
sudo systemctl reload caddy

# 6. Verify health check
echo "[6/6] Verifying backend health..."
sleep 4
if curl -sf http://127.0.0.1:8000/health > /dev/null; then
    echo "✅ Health check PASSED! ResearchMate is live and healthy."
else
    echo "❌ Health check FAILED! Checking backend logs:"
    journalctl -u researchmate-backend -n 30 --no-pager
    exit 1
fi

echo "================================================================"
echo "🎉 Deployment successfully completed at $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
