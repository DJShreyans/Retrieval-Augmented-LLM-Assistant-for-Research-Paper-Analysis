#!/usr/bin/env bash
# ================================================================
# ResearchMate Production Nightly Backup Script
# Backs up PostgreSQL App DB, SQLite Corpus DB, FAISS vectors & thumbnails
# ================================================================

set -euo pipefail

BACKUP_DIR="/opt/researchmate/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_STAGE="/tmp/researchmate_backup_${TIMESTAMP}"
ARCHIVE_NAME="researchmate_backup_${TIMESTAMP}.tar.gz"
LOG_FILE="/var/log/researchmate_backup.log"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"
mkdir -p "${TEMP_STAGE}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting ResearchMate backup..." | tee -a "${LOG_FILE}"

# 1. Source production environment
if [ -f /opt/researchmate/.env ]; then
    set -a
    source /opt/researchmate/.env
    set +a
fi

# 2. Dump PostgreSQL App Database
echo "Dumping PostgreSQL database..." | tee -a "${LOG_FILE}"
PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-researchmate_user}" -d "${PGDATABASE:-researchmate_db}" -F c -b -v -f "${TEMP_STAGE}/app_db.dump"

# 3. Copy Corpus SQLite DB (using SQLite backup API or safe copy)
echo "Backing up corpus SQLite database..." | tee -a "${LOG_FILE}"
if [ -f /opt/researchmate/data/corpus.db ]; then
    sqlite3 /opt/researchmate/data/corpus.db ".backup '${TEMP_STAGE}/corpus.db'"
fi

# 4. Copy FAISS Vector Index and Thumbnails
echo "Backing up FAISS index and thumbnails..." | tee -a "${LOG_FILE}"
mkdir -p "${TEMP_STAGE}/data"
if [ -d /opt/researchmate/data/faiss ]; then
    cp -r /opt/researchmate/data/faiss "${TEMP_STAGE}/data/"
fi
if [ -d /opt/researchmate/data/thumbnails ]; then
    cp -r /opt/researchmate/data/thumbnails "${TEMP_STAGE}/data/"
fi

# 5. Archive and Compress
echo "Creating compressed tarball..." | tee -a "${LOG_FILE}"
tar -czf "${BACKUP_DIR}/${ARCHIVE_NAME}" -C "${TEMP_STAGE}" .

# 6. Cleanup Temporary Staging
rm -rf "${TEMP_STAGE}"

# 7. Prune archives older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "researchmate_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${ARCHIVE_NAME}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully: ${ARCHIVE_NAME} (${BACKUP_SIZE})" | tee -a "${LOG_FILE}"
