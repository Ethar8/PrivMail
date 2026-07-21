#!/usr/bin/env bash
# Bereitet lokale E2E-Umgebung vor (Domain, Secrets, Self-Signed, nginx).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOMAIN="${E2E_DOMAIN:-privmail.test}"
VAULT_HOST="${E2E_VAULT_HOST:-vault.privmail.test}"
PHOTOS_HOST="${E2E_PHOTOS_HOST:-photos.privmail.test}"

chmod +x scripts/*.sh infrastructure/scripts/*.sh 2>/dev/null || true

./scripts/setup-wizard.sh \
  --domain "$DOMAIN" \
  --vault-host "$VAULT_HOST" \
  --photos-host "$PHOTOS_HOST" \
  --admin-email "admin@${DOMAIN}" \
  --yes

# Self-signed mit SAN für alle drei Hosts (Produktion nutzt certbot)
SSL_DIR=infrastructure/nginx/ssl
mkdir -p "$SSL_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/CN=${DOMAIN}/O=PrivMail-E2E" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:${VAULT_HOST},DNS:${PHOTOS_HOST}" 2>/dev/null \
  || openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=${DOMAIN}"

./scripts/render-nginx.sh

# Hosts-Einträge (best effort)
HOSTS_LINE="127.0.0.1 ${DOMAIN} ${VAULT_HOST} ${PHOTOS_HOST}"
if grep -q "privmail.test" /etc/hosts 2>/dev/null; then
  echo "· /etc/hosts enthält bereits privmail.test"
else
  if command -v sudo >/dev/null && sudo -n true 2>/dev/null; then
    echo "$HOSTS_LINE" | sudo tee -a /etc/hosts >/dev/null
    echo "✓ /etc/hosts ergänzt"
  else
    echo "⚠️  Bitte manuell in /etc/hosts: $HOSTS_LINE"
    echo "   (Tests nutzen zusätzlich curl --resolve)"
  fi
fi

echo "✅ E2E-Vorbereitung fertig (DOMAIN=$DOMAIN)"
