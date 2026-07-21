#!/usr/bin/env bash
# Rendert infrastructure/nginx/nginx.conf aus der Vorlage anhand .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
TEMPLATE="$ROOT/infrastructure/nginx/nginx.conf.template"
OUT="$ROOT/infrastructure/nginx/nginx.conf"

if [ ! -f "$TEMPLATE" ]; then
  echo "❌ Vorlage fehlt: $TEMPLATE"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  # Nur KEY=VALUE Zeilen laden (keine Export-Nebenwirkungen von Kommentaren)
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | sed 's/\r$//')
  set +a
fi

DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] || [[ "$DOMAIN" == *ihre-domain* ]]; then
  echo "❌ DOMAIN in $ENV_FILE ist nicht gesetzt oder noch ein Platzhalter."
  echo "   Zuerst: ./scripts/setup-wizard.sh"
  exit 1
fi

VAULT_HOST="${VAULT_HOST:-vault.${DOMAIN}}"
PHOTOS_HOST="${PHOTOS_HOST:-photos.${DOMAIN}}"

sed \
  -e "s/__DOMAIN__/${DOMAIN}/g" \
  -e "s/__VAULT_HOST__/${VAULT_HOST}/g" \
  -e "s/__PHOTOS_HOST__/${PHOTOS_HOST}/g" \
  "$TEMPLATE" >"$OUT"

echo "✅ nginx.conf erzeugt:"
echo "   server_name  $DOMAIN"
echo "   server_name  $VAULT_HOST"
echo "   server_name  $PHOTOS_HOST"
echo "   → $OUT"
