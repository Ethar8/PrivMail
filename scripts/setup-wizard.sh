#!/usr/bin/env bash
# Interaktiver / nicht-interaktiver Setup-Wizard für beliebige Betreiber.
# Schreibt .env, generiert Secrets, rendert nginx.conf — keine fest verdrahtete Domain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
NONINTERACTIVE=0
DOMAIN_ARG=""
VAULT_ARG=""
PHOTOS_ARG=""
ADMIN_EMAIL_ARG=""

usage() {
  cat <<EOF
Verwendung: ./scripts/setup-wizard.sh [Optionen]

  --domain <host>         Primäre PrivMail-Domain (z. B. mail.example.org)
  --vault-host <host>     Vaultwarden-Hostname (Default: vault.<domain>)
  --photos-host <host>    Immich-Hostname (Default: photos.<domain>)
  --admin-email <email>   Hinweis für späteren Admin (nur in .env als Kommentar/Hint)
  --yes                   Nicht-interaktiv (alle Pflichtwerte per Flag)
  -h, --help              Hilfe

Beispiel:
  ./scripts/setup-wizard.sh --domain mail.example.org --yes
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN_ARG="$2"; shift 2 ;;
    --vault-host) VAULT_ARG="$2"; shift 2 ;;
    --photos-host) PHOTOS_ARG="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL_ARG="$2"; shift 2 ;;
    --yes) NONINTERACTIVE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unbekannt: $1"; usage; exit 1 ;;
  esac
done

ask() {
  local prompt="$1"
  local default="${2:-}"
  local val=""
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " val || true
    echo "${val:-$default}"
  else
    read -r -p "$prompt: " val || true
    echo "$val"
  fi
}

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         PrivMail Suite – Setup für deinen Server         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Jeder Betreiber betreibt eine eigene, unabhängige Instanz."
echo "Trage DEINE Domain ein (nicht die eines anderen Betreibers)."
echo ""

if [ "$NONINTERACTIVE" = "1" ]; then
  DOMAIN="$DOMAIN_ARG"
  if [ -z "$DOMAIN" ]; then
    echo "❌ --yes erfordert --domain"
    exit 1
  fi
  VAULT_HOST="${VAULT_ARG:-vault.${DOMAIN}}"
  PHOTOS_HOST="${PHOTOS_ARG:-photos.${DOMAIN}}"
  ADMIN_EMAIL_HINT="${ADMIN_EMAIL_ARG:-}"
else
  DOMAIN="${DOMAIN_ARG:-$(ask "Primäre Domain (PrivMail / OIDC-Issuer)" "")}"
  if [ -z "$DOMAIN" ]; then
    echo "❌ Domain ist Pflicht."
    exit 1
  fi
  VAULT_HOST="${VAULT_ARG:-$(ask "Vaultwarden-Hostname" "vault.${DOMAIN}")}"
  PHOTOS_HOST="${PHOTOS_ARG:-$(ask "Immich-Hostname" "photos.${DOMAIN}")}"
  ADMIN_EMAIL_HINT="${ADMIN_EMAIL_ARG:-$(ask "Admin-E-Mail (nur Hinweis, Konto später unter /setup)" "")}"
fi

DOMAIN="$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | sed 's/^https\?:\/\///;s/\/$//')"
VAULT_HOST="$(echo "$VAULT_HOST" | tr '[:upper:]' '[:lower:]' | sed 's/^https\?:\/\///;s/\/$//')"
PHOTOS_HOST="$(echo "$PHOTOS_HOST" | tr '[:upper:]' '[:lower:]' | sed 's/^https\?:\/\///;s/\/$//')"

if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "❌ Ungültige Domain: $DOMAIN"
  exit 1
fi

mkdir -p "$ROOT/data" "$ROOT/infrastructure/nginx/ssl"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

ensure_kv() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >>"$ENV_FILE"
  fi
}

ensure_kv DOMAIN "$DOMAIN"
ensure_kv VAULT_HOST "$VAULT_HOST"
ensure_kv PHOTOS_HOST "$PHOTOS_HOST"
ensure_kv OIDC_ISSUER "https://${DOMAIN}"
ensure_kv VAULTWARDEN_URL "https://${VAULT_HOST}"
ensure_kv IMMICH_URL "https://${PHOTOS_HOST}"
ensure_kv CORS_ORIGINS "https://${DOMAIN},https://${VAULT_HOST},https://${PHOTOS_HOST}"
ensure_kv NEXT_PUBLIC_MAIL_URL "https://${DOMAIN}"
ensure_kv NEXT_PUBLIC_VAULT_URL "https://${VAULT_HOST}"
ensure_kv NEXT_PUBLIC_PHOTOS_URL "https://${PHOTOS_HOST}"
ensure_kv NODE_ENV "production"

if [ -n "$ADMIN_EMAIL_HINT" ]; then
  ensure_kv SETUP_ADMIN_EMAIL_HINT "$ADMIN_EMAIL_HINT"
fi

chmod +x "$ROOT/scripts/generate-secrets.sh" "$ROOT/scripts/render-nginx.sh" 2>/dev/null || true
"$ROOT/scripts/generate-secrets.sh" "$ENV_FILE"
# Domain/Hosts nach generate-secrets erneut setzen (falls Platzhalter-Logik)
ensure_kv DOMAIN "$DOMAIN"
ensure_kv VAULT_HOST "$VAULT_HOST"
ensure_kv PHOTOS_HOST "$PHOTOS_HOST"
ensure_kv OIDC_ISSUER "https://${DOMAIN}"
ensure_kv CORS_ORIGINS "https://${DOMAIN},https://${VAULT_HOST},https://${PHOTOS_HOST}"
ensure_kv VAULTWARDEN_URL "https://${VAULT_HOST}"
ensure_kv IMMICH_URL "https://${PHOTOS_HOST}"
ensure_kv NEXT_PUBLIC_MAIL_URL "https://${DOMAIN}"
ensure_kv NEXT_PUBLIC_VAULT_URL "https://${VAULT_HOST}"
ensure_kv NEXT_PUBLIC_PHOTOS_URL "https://${PHOTOS_HOST}"

"$ROOT/scripts/render-nginx.sh" "$ENV_FILE"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Konfiguration gespeichert                               ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Domain:       $DOMAIN"
echo "║  Vaultwarden:  $VAULT_HOST"
echo "║  Immich:       $PHOTOS_HOST"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "DNS (bei DEINEM Domain-Anbieter setzen):"
echo "  A/AAAA   $DOMAIN          → <DEINE-SERVER-IP>"
echo "  A/AAAA   $VAULT_HOST      → <DEINE-SERVER-IP>"
echo "  A/AAAA   $PHOTOS_HOST     → <DEINE-SERVER-IP>"
echo ""
echo "Danach:"
echo "  ./install.sh            # oder: docker compose up -d --build"
echo "  ./infrastructure/scripts/setup-ssl.sh $DOMAIN"
echo "  https://$DOMAIN/setup   # Admin-Konto anlegen"
echo ""
echo "Hinweis: DNS musst du selbst setzen — kein Tool kann das ohne"
echo "Zugang zu deinem Registrar erledigen."
