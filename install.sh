#!/bin/bash
set -euo pipefail

echo "╔═══════════════════════════════════════════════════════╗"
echo "║              🚀 PrivMail Suite Installation           ║"
echo "╚═══════════════════════════════════════════════════════╝"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
    echo "❌ Docker ist nicht installiert. Bitte Docker installieren."
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "❌ Docker läuft nicht. Bitte Docker starten."
    exit 1
fi

COMPOSE="docker compose"
if ! docker compose version &>/dev/null; then
    if command -v docker-compose &>/dev/null; then
        COMPOSE="docker-compose"
    else
        echo "❌ docker compose nicht gefunden."
        exit 1
    fi
fi

chmod +x scripts/*.sh infrastructure/scripts/*.sh 2>/dev/null || true

needs_wizard=0
if [ ! -f .env ]; then
  needs_wizard=1
elif ! grep -qE '^DOMAIN=' .env; then
  needs_wizard=1
elif grep -qE '^DOMAIN=(localhost|.*ihre-domain|<DEINE)' .env; then
  needs_wizard=1
fi

if [ "${1:-}" != "" ]; then
  WIZ_ARGS=(--domain "$1" --yes)
  [ "${2:-}" != "" ] && WIZ_ARGS+=(--vault-host "$2")
  [ "${3:-}" != "" ] && WIZ_ARGS+=(--photos-host "$3")
  ./scripts/setup-wizard.sh "${WIZ_ARGS[@]}"
elif [ "$needs_wizard" = "1" ]; then
  echo "Kein gültiges DOMAIN in .env — starte Setup-Wizard…"
  ./scripts/setup-wizard.sh
else
  echo "🔐 Secrets ergänzen + Nginx rendern…"
  ./scripts/generate-secrets.sh
  ./scripts/render-nginx.sh
fi

DOMAIN="$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2-)"
VAULT_HOST="$(grep -E '^VAULT_HOST=' .env | head -1 | cut -d= -f2- || true)"
PHOTOS_HOST="$(grep -E '^PHOTOS_HOST=' .env | head -1 | cut -d= -f2- || true)"
VAULT_HOST="${VAULT_HOST:-vault.${DOMAIN}}"
PHOTOS_HOST="${PHOTOS_HOST:-photos.${DOMAIN}}"

mkdir -p data/{mail,queue,postgres,logs,vaultwarden,immich/library,immich/postgres}
mkdir -p infrastructure/nginx/ssl

if [ ! -f infrastructure/nginx/ssl/fullchain.pem ]; then
  echo "🔏 Temporäres Self-Signed-Zertifikat (bis DNS + setup-ssl.sh)…"
  if openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout infrastructure/nginx/ssl/privkey.pem \
    -out infrastructure/nginx/ssl/fullchain.pem \
    -subj "/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN},DNS:${VAULT_HOST},DNS:${PHOTOS_HOST}" 2>/dev/null; then
    :
  else
    openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
      -keyout infrastructure/nginx/ssl/privkey.pem \
      -out infrastructure/nginx/ssl/fullchain.pem \
      -subj "/CN=${DOMAIN}"
  fi
fi

if [ ! -f infrastructure/nginx/nginx.conf ]; then
  ./scripts/render-nginx.sh
fi

echo "🐳 Starte PrivMail Suite…"
$COMPOSE up -d --build

echo "⏳ Warte auf Backend…"
for _i in $(seq 1 60); do
  if $COMPOSE exec -T backend wget -q -O- http://127.0.0.1:3000/health >/dev/null 2>&1 \
    || $COMPOSE exec -T backend curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
    echo "  ✓ Backend healthy (Migrationen laufen beim Start)"
    break
  fi
  sleep 2
done

# Outbound-DKIM (Schlüssel lokal; DNS-TXT musst du selbst setzen)
if [ ! -f infrastructure/dkim/privmail.private.pem ]; then
  echo "🔏 Erzeuge DKIM-Schlüssel…"
  ./infrastructure/scripts/setup-dkim.sh "$DOMAIN" || true
fi

./infrastructure/scripts/setup-dns.sh "$DOMAIN" "<DEINE-SERVER-IP>" "$VAULT_HOST" "$PHOTOS_HOST"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  ✅ Installation gestartet                            ║"
echo "║  Noch von DIR: DNS setzen, dann setup-ssl.sh          ║"
echo "║  DKIM-TXT: infrastructure/dkim/privmail.dns.txt       ║"
echo "║  Probe: DOMAIN=${DOMAIN} ./scripts/prod-deploy-probe.sh ║"
echo "║  Admin: https://${DOMAIN}/setup                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
