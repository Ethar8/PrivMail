#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════╗"
echo "║              🚀 PrivMail Installation                 ║"
echo "╚═══════════════════════════════════════════════════════╝"

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

if [ ! -f .env ]; then
    echo "📝 Erstelle .env-Datei..."
    cat > .env << EOF
DOMAIN=mail.ihre-domain.de
DB_USER=privmail
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+' | cut -c1-20)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
SMTP_PORT=2525
IMAP_PORT=2143
HTTP_PORT=8080
HTTPS_PORT=8443
API_PORT=3000
EOF
fi

mkdir -p data/{mail,queue,postgres,logs}

echo "🐳 Starte PrivMail..."
$COMPOSE up -d --build

sleep 10

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           ✅ PrivMail ist gestartet!                  ║"
echo "║                                                       ║"
echo "║  🌐 Web-UI: http://localhost:8080                     ║"
echo "║  🔒 HTTPS:  https://localhost:8443                    ║"
echo "║  📧 SMTP:   localhost:2525                            ║"
echo "║  📨 IMAP:   localhost:2143                            ║"
echo "║                                                       ║"
echo "║  🔑 Ersten Nutzer anlegen:                            ║"
echo "║  http://localhost:8080/setup                          ║"
echo "║                                                       ║"
echo "║  ⚠️  WICHTIG für Spam-Schutz:                         ║"
echo "║  1. SPF, DKIM, DMARC setzen                           ║"
echo "║  2. PTR-Record (Reverse-DNS) setzen                   ║"
echo "║  3. Siehe docs/security.md                            ║"
echo "╚═══════════════════════════════════════════════════════╝"
