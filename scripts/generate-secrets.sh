#!/usr/bin/env bash
# PrivMail – generiert fehlende Secrets und leitet CORS/App-URLs aus DOMAIN + Hosts ab.
# Idempotent: vorhandene starke Werte werden nicht überschrieben.
# Secrets werden NIE als feste Beispielwerte in der Doku vorgeschlagen — nur hier erzeugt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"

rand() {
  openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48
}

is_placeholder() {
  local v="${1:-}"
  case "$v" in
    ''|change-me*|changeme*|your-*|TODO*|todo*|*ihre-domain*) return 0 ;;
  esac
  case "$v" in
    *DEINE-DOMAIN*|*DEINE-SERVER*) return 0 ;;
  esac
  if [[ "$v" == \<DEINE-* ]]; then return 0; fi
  return 1
}

ensure_kv() {
  local key="$1"
  local value="$2"
  local force="${3:-0}"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local current
    current="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [ "$force" = "1" ] || is_placeholder "$current"; then
      local tmp
      tmp="$(mktemp)"
      awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" >"$tmp"
      mv "$tmp" "$ENV_FILE"
      echo "  ✓ $key aktualisiert"
    else
      echo "  · $key belassen (bereits gesetzt)"
    fi
  else
    echo "${key}=${value}" >>"$ENV_FILE"
    echo "  ✓ $key hinzugefügt"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ENV_FILE"
    echo "📝 .env aus .env.example angelegt: $ENV_FILE"
  else
    touch "$ENV_FILE"
    echo "📝 leere .env angelegt: $ENV_FILE"
  fi
fi

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if is_placeholder "${DOMAIN:-}"; then
  DOMAIN="${PRIVMAIL_DOMAIN:-}"
  if [ -z "$DOMAIN" ]; then
    echo "⚠️  DOMAIN fehlt — bitte zuerst ./scripts/setup-wizard.sh ausführen."
    DOMAIN="localhost"
  fi
  ensure_kv DOMAIN "$DOMAIN"
else
  echo "  · DOMAIN=$DOMAIN"
fi

VAULT_HOST="$(grep -E '^VAULT_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
PHOTOS_HOST="$(grep -E '^PHOTOS_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if is_placeholder "${VAULT_HOST:-}"; then VAULT_HOST="vault.${DOMAIN}"; fi
if is_placeholder "${PHOTOS_HOST:-}"; then PHOTOS_HOST="photos.${DOMAIN}"; fi
ensure_kv VAULT_HOST "$VAULT_HOST"
ensure_kv PHOTOS_HOST "$PHOTOS_HOST"

echo "🔐 Generiere/ergänze Secrets in $ENV_FILE …"
ensure_kv DB_USER "${DB_USER:-privmail}"
ensure_kv DB_PASSWORD "$(rand)"
ensure_kv JWT_SECRET "$(rand)"
ensure_kv SESSION_SECRET "$(rand)"
ensure_kv OIDC_VAULTWARDEN_CLIENT_ID "vaultwarden"
ensure_kv OIDC_VAULTWARDEN_CLIENT_SECRET "$(rand)"
ensure_kv OIDC_IMMICH_CLIENT_ID "immich"
ensure_kv OIDC_IMMICH_CLIENT_SECRET "$(rand)"
ensure_kv IMMICH_DB_PASSWORD "$(rand | cut -c1-32)"
ensure_kv VAULTWARDEN_ADMIN_TOKEN "$(rand)"

# Abgeleitete URLs (aus Betreiber-Hosts, nicht hardcodiert)
ensure_kv OIDC_ISSUER "https://${DOMAIN}" 1
CORS="https://${DOMAIN},https://${VAULT_HOST},https://${PHOTOS_HOST}"
ensure_kv CORS_ORIGINS "$CORS" 1
ensure_kv VAULTWARDEN_URL "https://${VAULT_HOST}" 1
ensure_kv IMMICH_URL "https://${PHOTOS_HOST}" 1
ensure_kv NEXT_PUBLIC_MAIL_URL "https://${DOMAIN}" 1
ensure_kv NEXT_PUBLIC_VAULT_URL "https://${VAULT_HOST}" 1
ensure_kv NEXT_PUBLIC_PHOTOS_URL "https://${PHOTOS_HOST}" 1
ensure_kv IMMICH_VERSION "v3"
ensure_kv IMMICH_UPLOAD_LOCATION "./data/immich/library"
ensure_kv IMMICH_DB_DATA_LOCATION "./data/immich/postgres"

echo "✅ Secrets/CORS fertig. CORS_ORIGINS=$CORS"
