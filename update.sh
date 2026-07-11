#!/bin/bash
# PrivMail – Update auf die neueste Version
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE="docker compose"
docker compose version >/dev/null 2>&1 || COMPOSE="docker-compose"

echo "🔄 Hole neueste Änderungen…"
if [ -d .git ]; then
  git pull --ff-only
fi

echo "🧱 Baue Container neu…"
$COMPOSE build

echo "🚀 Starte aktualisierte Dienste…"
$COMPOSE up -d

echo "✅ Update abgeschlossen."
