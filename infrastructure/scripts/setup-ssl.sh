#!/bin/bash
# PrivMail – TLS-Zertifikate via Let's Encrypt (certbot) einrichten.
set -e

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Verwendung: ./setup-ssl.sh <domain>"
  exit 1
fi

if ! command -v certbot &>/dev/null; then
  echo "❌ certbot ist nicht installiert."
  echo "📥 Installieren: https://certbot.eff.org/"
  exit 1
fi

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/ssl"
mkdir -p "$SSL_DIR"

echo "🔒 Fordere Zertifikat für $DOMAIN an…"
certbot certonly --standalone -d "$DOMAIN" \
  --non-interactive --agree-tos \
  --email "admin@$DOMAIN" \
  --cert-path "$SSL_DIR/fullchain.pem" \
  --key-path "$SSL_DIR/privkey.pem"

echo "✅ Zertifikat eingerichtet. Bitte nginx neu laden."
