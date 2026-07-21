#!/usr/bin/env bash
# Erzeugt lokale CA + Serverzertifikat für E2E (Container vertrauen der CA).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSL="$ROOT/infrastructure/nginx/ssl"
mkdir -p "$SSL"
DOMAIN="${E2E_DOMAIN:-privmail.test}"
VAULT="${E2E_VAULT_HOST:-vault.privmail.test}"
PHOTOS="${E2E_PHOTOS_HOST:-photos.privmail.test}"

# CA
openssl genrsa -out "$SSL/e2e-ca.key" 2048 2>/dev/null
openssl req -x509 -new -nodes -key "$SSL/e2e-ca.key" -sha256 -days 365 \
  -out "$SSL/e2e-ca.crt" -subj "/CN=PrivMail-E2E-CA/O=PrivMail-E2E" 2>/dev/null

# Server key + CSR
openssl genrsa -out "$SSL/privkey.pem" 2048 2>/dev/null
cat >"$SSL/e2e-san.cnf" <<EOF
[req]
distinguished_name=req_dn
req_extensions=v3_req
prompt=no
[req_dn]
CN=${DOMAIN}
O=PrivMail-E2E
[v3_req]
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt
[alt]
DNS.1=${DOMAIN}
DNS.2=${VAULT}
DNS.3=${PHOTOS}
EOF
openssl req -new -key "$SSL/privkey.pem" -out "$SSL/e2e-server.csr" -config "$SSL/e2e-san.cnf" 2>/dev/null
openssl x509 -req -in "$SSL/e2e-server.csr" -CA "$SSL/e2e-ca.crt" -CAkey "$SSL/e2e-ca.key" \
  -CAcreateserial -out "$SSL/fullchain.pem" -days 30 -sha256 -extfile "$SSL/e2e-san.cnf" -extensions v3_req 2>/dev/null

# fullchain = server + CA (manche Clients wollen beides)
cat "$SSL/fullchain.pem" "$SSL/e2e-ca.crt" >"$SSL/fullchain-with-ca.pem"
cp "$SSL/fullchain-with-ca.pem" "$SSL/fullchain.pem"

echo "✅ E2E-CA + Serverzertifikat in $SSL"
