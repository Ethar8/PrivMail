#!/usr/bin/env bash
# Host-Firewall für PrivMail (ufw). Idempotent; blockiert alles außer benötigten Ports.
# Nutzung: sudo ./infrastructure/scripts/setup-firewall.sh
# Optional: SSH_PORT=2222 ALLOW_SSH=yes ./infrastructure/scripts/setup-firewall.sh
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Bitte als root ausführen: sudo $0"
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw nicht installiert. Unter Debian/Ubuntu: apt install ufw"
  exit 1
fi

SMTP_PORT="${SMTP_PORT:-2525}"
IMAP_PORT="${IMAP_PORT:-2143}"
SSH_PORT="${SSH_PORT:-22}"
ALLOW_SSH="${ALLOW_SSH:-yes}"

echo "→ ufw: Default deny incoming / allow outgoing"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing

# Öffentlich für die Suite (siehe docs/firewall.md)
ufw allow 80/tcp comment 'PrivMail HTTP→HTTPS redirect'
ufw allow 443/tcp comment 'PrivMail HTTPS (Nginx)'
ufw allow "${SMTP_PORT}/tcp" comment 'PrivMail SMTP (Submission)'
ufw allow "${IMAP_PORT}/tcp" comment 'PrivMail IMAP'

if [[ "${ALLOW_SSH}" == "yes" ]]; then
  ufw allow "${SSH_PORT}/tcp" comment 'SSH administration'
fi

ufw --force enable
echo "✓ Firewall aktiv"
ufw status numbered
echo
echo "Hinweis: Docker kann eigene iptables-Regeln setzen (DOCKER-USER)."
echo "Interne Compose-Dienste (Postgres, Redis, Immich-ML) haben keine Host-ports:"
echo "und bleiben nur im Docker-Netz erreichbar."
