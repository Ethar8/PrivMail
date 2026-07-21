#!/bin/bash
# Zeigt die DNS-Einträge für DIESE Instanz.
# Wenn DKIM bereits erzeugt wurde (setup-dkim.sh), wird der echte TXT-Wert eingefügt.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

DOMAIN="${1:-<DEINE-DOMAIN>}"
IP="${2:-<DEINE-SERVER-IP>}"
VAULT_HOST="${3:-vault.${DOMAIN}}"
PHOTOS_HOST="${4:-photos.${DOMAIN}}"
SELECTOR="${5:-privmail}"

DKIM_LINE="(noch kein Schlüssel — zuerst: ./infrastructure/scripts/setup-dkim.sh ${DOMAIN} ${SELECTOR})"
PUB_FILE="${ROOT}/infrastructure/dkim/${SELECTOR}.public.txt"
if [[ -f "$PUB_FILE" ]]; then
  PUB=$(tr -d '\n' <"$PUB_FILE")
  DKIM_LINE="v=DKIM1; k=rsa; p=${PUB}"
fi

cat << EOF
╔═══════════════════════════════════════════════════════════════╗
║   DNS-Einträge für DEINE PrivMail Suite (${DOMAIN})
╚═══════════════════════════════════════════════════════════════╝

=== Pflicht für HTTPS / SSO ===

1) A/AAAA  ${DOMAIN}.           →  ${IP}
2) A/AAAA  ${VAULT_HOST}.       →  ${IP}
3) A/AAAA  ${PHOTOS_HOST}.      →  ${IP}

Danach:  ./infrastructure/scripts/setup-ssl.sh ${DOMAIN}

=== Pflicht für Mail-Zustellung ===

4) MX   ${DOMAIN}.  →  ${DOMAIN}.  (Priorität 10)
5) SPF  TXT @ → "v=spf1 mx a ip4:${IP} -all"
6) DKIM TXT ${SELECTOR}._domainkey → "${DKIM_LINE}"
7) DMARC TXT _dmarc → "v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}; pct=100"
8) PTR  ${IP} → ${DOMAIN}   (beim Hosting-Anbieter / IP-Owner)

=== Nach DNS ===

  ./scripts/prod-deploy-probe.sh
  Admin-UI → DNS-Check

Siehe docs/security.md, docs/firewall.md, docs/configuration.md
EOF
