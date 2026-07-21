#!/usr/bin/env bash
# Optionaler Full-Stack-E2E-Lauf (benötigt laufenden Docker-Daemon).
# Ohne Docker: backend/src/test/e2e/sso-suite.e2e.ts (IdP+PKCE, immer lauffähig).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "Docker nicht verfügbar – starte IdP-E2E ohne Compose…"
  cd backend
  exec node --require ts-node/register/transpile-only src/test/e2e/sso-suite.e2e.ts
fi

echo "Docker OK – Suite-Compose + IdP-E2E…"
./scripts/generate-secrets.sh
# Lokale Testdomain für Compose (kein öffentliches DNS nötig, wenn Hosts gesetzt)
if ! grep -q 'privmail.test' /etc/hosts 2>/dev/null; then
  echo "Hinweis: Für Browser-Tests ggf. eintragen:"
  echo "  127.0.0.1 privmail.test vault.privmail.test photos.privmail.test"
fi

cd backend
node --require ts-node/register/transpile-only src/test/e2e/sso-suite.e2e.ts
