#!/bin/bash
# PrivMail – zeigt die benötigten DNS-Einträge für einen Mailserver an.
set -e

DOMAIN="${1:-ihre-domain.de}"
IP="${2:-<server-ip>}"
SELECTOR="${3:-privmail}"

cat << EOF
╔═══════════════════════════════════════════════════════════════╗
║   DNS-Einträge für PrivMail (Domain: $DOMAIN)
╚═══════════════════════════════════════════════════════════════╝

1) MX-Record
   $DOMAIN.            IN  MX   10 mail.$DOMAIN.

2) A-Record
   mail.$DOMAIN.       IN  A    $IP

3) SPF (TXT)
   $DOMAIN.            IN  TXT  "v=spf1 mx a ip4:$IP -all"

4) DKIM (TXT)
   ${SELECTOR}._domainkey.$DOMAIN.  IN  TXT  "v=DKIM1; k=rsa; p=<public-key>"

5) DMARC (TXT)
   _dmarc.$DOMAIN.     IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"

6) PTR / Reverse-DNS
   $IP  ->  mail.$DOMAIN

Weitere Details: docs/security.md
EOF
