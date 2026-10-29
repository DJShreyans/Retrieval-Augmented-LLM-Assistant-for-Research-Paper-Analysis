#!/usr/bin/env bash
# ================================================================
# ResearchMate Disaster Recovery / Restore Script
# Restores PostgreSQL App DB, SQLite Corpus DB, FAISS vectors & thumbnails
# Usage: ./restore.sh /opt/researchmate/backups/researchmate_backup_YYYYMMDD_HHMMSS.tar.gz
# ================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_archive.tar.gz>"
    exit 1
fi

ARCHIVE_PATH="$1"
if [ ! -f "${ARCHIVE_PATH}" ]; then
    echo "Error: Backup file not found at ${ARCHIVE_PATH}"
    exit 1
fi

TEMP_RESTORE="/tmp/researchmate_restore_$(date +%s)"
mkdir -p "${TEMP_RESTORE}"

echo "Extracting backup archive..."
tar -xzf "${ARCHIVE_PATH}" -C "${TEMP_RESTORE}"

# Source environment
if [ -f /opt/researchmate/.env ]; then
    set -a
    source /opt/researchmate/.env
    set +a
fi

echo "Stopping services..."
systemctl stop researchmate-frontend researchmate-backend || true

echo "Restoring PostgreSQL database..."
if [ -f "${TEMP_RESTORE}/app_db.dump" ]; then
    PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_restore -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-researchmate_user}" -d "${PGDATABASE:-researchmate_db}" --clean --if-exists "${TEMP_RESTORE}/app_db.dump" || true
fi

echo "Restoring SQLite corpus and FAISS index..."
if [ -f "${TEMP_RESTORE}/corpus.db" ]; then
    cp "${TEMP_RESTORE}/corpus.db" /opt/researchmate/data/corpus.db
fi
if [ -d "${TEMP_RESTORE}/data/faiss" ]; then
    cp -r "${TEMP_RESTORE}/data/faiss" /opt/researchmate/data/
fi
if [ -d "${TEMP_RESTORE}/data/thumbnails" ]; then
    cp -r "${TEMP_RESTORE}/data/thumbnails" /opt/researchmate/data/
fi

# Ensure correct file permissions
chown -R researchmate:researchmate /opt/researchmate/data

echo "Restarting services..."
systemctl start researchmate-backend researchmate-frontend

echo "Cleaning up temporary files..."
rm -rf "${TEMP_RESTORE}"

echo "Restore complete! Verifying health endpoint..."
sleep 3
curl -s http://127.0.0.1:8000/health | grep '"status":"ok"' && echo "Backend is healthy!" || echo "Check backend logs: journalctl -u researchmate-backend -n 50"
