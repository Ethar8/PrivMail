#!/usr/bin/env bash
# Erzeugt DKIM-Schlüsselpaar für ausgehende PrivMail-Signierung und druckt den DNS-TXT.
# Nutzung:
#   ./infrastructure/scripts/setup-dkim.sh [domain] [selector]
# Schreibt:
#   infrastructure/dkim/privmail.private.pem
#   infrastructure/dkim/privmail.public.txt   (DNS-fähiger p=-Wert)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DOMAIN="${1:-}"
SELECTOR="${2:-privmail}"
DKIM_DIR="${ROOT}/infrastructure/dkim"
mkdir -p "$DKIM_DIR"
PRIV="${DKIM_DIR}/${SELECTOR}.private.pem"
PUB_TXT="${DKIM_DIR}/${SELECTOR}.public.txt"
DNS_SNIPPET="${DKIM_DIR}/${SELECTOR}.dns.txt"

if [[ -f "$PRIV" ]]; then
  echo "⚠️  Schlüssel existiert bereits: $PRIV"
  echo "   Zum Neu erzeugen: Datei löschen und Skript erneut ausführen."
else
  openssl genrsa -out "$PRIV" 2048 2>/dev/null
  chmod 600 "$PRIV"
  echo "✓ Privater Schlüssel: $PRIV"
fi

# Öffentlichen Schlüssel aus PEM extrahieren (Base64 ohne Header, eine Zeile)
PUB_B64=$(openssl rsa -in "$PRIV" -pubout -outform DER 2>/dev/null | openssl base64 -A)
echo "$PUB_B64" >"$PUB_TXT"

DNS_NAME="${SELECTOR}._domainkey.${DOMAIN:-YOUR_DOMAIN}"
DNS_VALUE="v=DKIM1; k=rsa; p=${PUB_B64}"

cat >"$DNS_SNIPPET" <<EOF
# DKIM DNS-Record (TXT)
# Name:  ${DNS_NAME}
# Wert:  ${DNS_VALUE}

${DNS_NAME}.  IN  TXT  "${DNS_VALUE}"
EOF

# .env ergänzen (wenn vorhanden und noch kein DKIM_PRIVATE_KEY_PATH)
if [[ -f "$ROOT/.env" ]]; then
  if ! grep -q '^DKIM_PRIVATE_KEY_PATH=' "$ROOT/.env" 2>/dev/null; then
    {
      echo ""
      echo "DKIM_SELECTOR=${SELECTOR}"
      echo "DKIM_PRIVATE_KEY_PATH=/etc/privmail/dkim/${SELECTOR}.private.pem"
    } >>"$ROOT/.env"
    echo "✓ .env um DKIM_* ergänzt"
  fi
fi

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DKIM bereit – nächsten TXT-Record beim DNS-Anbieter setzen ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo
echo "  Name:  ${SELECTOR}._domainkey.${DOMAIN:-<DEINE-DOMAIN>}"
echo "  Typ:   TXT"
echo "  Wert:  v=DKIM1; k=rsa; p=${PUB_B64:0:40}…"
echo
echo "Vollständiger Record: $DNS_SNIPPET"
echo
echo "Docker: Volume mount in docker-compose.yml:"
echo "  ./infrastructure/dkim:/etc/privmail/dkim:ro"
echo "Env: DKIM_PRIVATE_KEY_PATH=/etc/privmail/dkim/${SELECTOR}.private.pem"
echo "     DKIM_SELECTOR=${SELECTOR}"
echo
echo "Prüfen: Admin → DNS-Check oder ./scripts/prod-deploy-probe.sh"
