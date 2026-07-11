#!/bin/bash
# PrivMail – Wiederherstellung aus einem Backup
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE="docker compose"
docker compose version >/dev/null 2>&1 || COMPOSE="docker-compose"

[ -f .env ] && set -a && . ./.env && set +a

if [ -z "$1" ]; then
  echo "Verwendung: ./restore.sh <backup-verzeichnis>"
  echo "Verfügbare Backups:"
  ls -1 backups 2>/dev/null || echo "  (keine)"
  exit 1
fi

SRC="$1"

echo "♻️  Stelle Datenbank wieder her…"
$COMPOSE exec -T postgres psql -U "${DB_USER:-privmail}" privmail < "$SRC/privmail.sql"

if [ -f "$SRC/mail-data.tar.gz" ]; then
  echo "♻️  Stelle Mail-Daten wieder her…"
  tar xzf "$SRC/mail-data.tar.gz"
fi

echo "✅ Wiederherstellung abgeschlossen."
