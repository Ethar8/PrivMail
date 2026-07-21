#!/bin/bash
# TLS via Let's Encrypt für DOMAIN + VAULT_HOST + PHOTOS_HOST (aus .env).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env"

DOMAIN_ARG="${1:-}"
EMAIL="${2:-}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | sed 's/\r$//')
  set +a
fi

DOMAIN="${DOMAIN_ARG:-${DOMAIN:-}}"
if [ -z "$DOMAIN" ]; then
  echo "Verwendung: ./setup-ssl.sh <domain> [email]"
  echo "  oder DOMAIN/VAULT_HOST/PHOTOS_HOST in .env setzen"
  exit 1
fi

VAULT_HOST="${VAULT_HOST:-vault.${DOMAIN}}"
PHOTOS_HOST="${PHOTOS_HOST:-photos.${DOMAIN}}"
EMAIL="${EMAIL:-admin@$DOMAIN}"

if ! command -v certbot &>/dev/null; then
  echo "❌ certbot ist nicht installiert: https://certbot.eff.org/"
  exit 1
fi

SSL_DIR="$ROOT/infrastructure/nginx/ssl"
mkdir -p "$SSL_DIR"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"

echo "🔒 Zertifikat für:"
echo "   - $DOMAIN"
echo "   - $VAULT_HOST"
echo "   - $PHOTOS_HOST"

certbot certonly --standalone \
  -d "$DOMAIN" \
  -d "$VAULT_HOST" \
  -d "$PHOTOS_HOST" \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --keep-until-expiring \
  --expand

if [ -f "$LIVE_DIR/fullchain.pem" ] && [ -f "$LIVE_DIR/privkey.pem" ]; then
  cp -L "$LIVE_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
  cp -L "$LIVE_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
  echo "✅ Zertifikat nach $SSL_DIR kopiert"
else
  echo "❌ Certbot-Ausgabe nicht unter $LIVE_DIR"
  exit 1
fi

echo "✅ TLS eingerichtet. Nginx neu laden: docker compose exec nginx nginx -s reload"
