#!/bin/bash
# Backs up the PrivMail PostgreSQL database and mail data into ./backups.
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="backups/$STAMP"
mkdir -p "$DEST"

COMPOSE="docker compose"
docker compose version >/dev/null 2>&1 || COMPOSE="docker-compose"

echo "📦 Sichere PostgreSQL-Datenbank…"
$COMPOSE exec -T postgres pg_dump -U "${DB_USER:-privmail}" privmail > "$DEST/privmail.sql"

echo "📦 Sichere Mail-Daten…"
tar czf "$DEST/mail-data.tar.gz" data/mail data/queue 2>/dev/null || true

echo "✅ Backup abgeschlossen: $DEST"
