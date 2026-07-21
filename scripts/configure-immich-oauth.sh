#!/usr/bin/env bash
# Konfiguriert Immich-OAuth automatisch über PUT /api/system-config.
# Voraussetzung: Immich läuft, Admin-Account existiert (oder wird angelegt).
#
# Nutzung:
#   ./scripts/configure-immich-oauth.sh \
#     --immich-url https://photos.example.com \
#     --issuer https://mail.example.com \
#     --client-id immich \
#     --client-secret SECRET \
#     --admin-email admin@example.com \
#     --admin-password '...'
set -euo pipefail

IMMICH_URL=""
ISSUER=""
CLIENT_ID="immich"
CLIENT_SECRET=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ALLOW_INSECURE="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --immich-url) IMMICH_URL="$2"; shift 2 ;;
    --issuer) ISSUER="$2"; shift 2 ;;
    --client-id) CLIENT_ID="$2"; shift 2 ;;
    --client-secret) CLIENT_SECRET="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --allow-insecure) ALLOW_INSECURE="true"; shift ;;
    *) echo "Unbekanntes Argument: $1"; exit 1 ;;
  esac
done

if [ -z "$IMMICH_URL" ] || [ -z "$ISSUER" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "Pflicht: --immich-url --issuer --client-secret --admin-email --admin-password"
  exit 1
fi

IMMICH_URL="${IMMICH_URL%/}"
DISCOVERY="${ISSUER%/}/.well-known/openid-configuration"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

# Optional: CURL_EXTRA_ARGS='-k --resolve photos.example:443:127.0.0.1' for local E2E
# shellcheck disable=SC2086
CURL=(curl -sS ${CURL_EXTRA_ARGS:-})

echo "→ Immich erreichbar? $IMMICH_URL"
"${CURL[@]}" -sf "${IMMICH_URL}/api/server/ping" >/dev/null || "${CURL[@]}" -sf "${IMMICH_URL}/api/server-info/ping" >/dev/null || {
  echo "❌ Immich nicht erreichbar"
  exit 1
}

# Admin anlegen (ignorieren wenn schon vorhanden)
# shellcheck disable=SC2086
SIGNUP_CODE="$("${CURL[@]}" -o /tmp/immich-signup.json -w '%{http_code}' \
  -X POST "${IMMICH_URL}/api/auth/admin-sign-up" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"PrivMail Admin\"}" || true)"
echo "  admin-sign-up HTTP $SIGNUP_CODE"

# Login → Access Token
LOGIN_JSON="$("${CURL[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "${IMMICH_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")"
TOKEN="$(echo "$LOGIN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
if [ -z "$TOKEN" ]; then
  echo "❌ Immich-Login fehlgeschlagen: $LOGIN_JSON"
  exit 1
fi
echo "  ✓ Admin-Login OK"

# Aktuelle Config laden (PUT braucht volles Objekt)
CONFIG="$("${CURL[@]}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${IMMICH_URL}/api/system-config")"

# OAuth-Block per Node mergen (zuverlässiger als jq-only bei großen JSON)
export CONFIG DISCOVERY CLIENT_ID CLIENT_SECRET ALLOW_INSECURE IMMICH_URL
MERGED="$(node <<'NODE'
const cfg = JSON.parse(process.env.CONFIG);
cfg.oauth = {
  ...(cfg.oauth || {}),
  enabled: true,
  autoRegister: false,
  autoLaunch: false,
  buttonText: 'Mit PrivMail anmelden',
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerUrl: process.env.DISCOVERY,
  scope: 'openid profile email',
  signingAlgorithm: 'RS256',
  profileSigningAlgorithm: 'none',
  storageLabelClaim: 'preferred_username',
  storageQuotaClaim: 'immich_quota',
  roleClaim: '',
  defaultStorageQuota: null,
  timeout: 30000,
  tokenEndpointAuthMethod: 'client_secret_post',
  prompt: '',
  endSessionEndpoint: '',
  mobileOverrideEnabled: true,
  mobileRedirectUri: `${process.env.IMMICH_URL}/api/oauth/mobile-redirect`,
  allowInsecureRequests: process.env.ALLOW_INSECURE === 'true',
};
process.stdout.write(JSON.stringify(cfg));
NODE
)"

HTTP="$("${CURL[@]}" -o /tmp/immich-config-put.json -w '%{http_code}' \
  -X PUT "${IMMICH_URL}/api/system-config" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$MERGED")"

echo "  PUT /api/system-config → HTTP $HTTP"
if [ "$HTTP" != "200" ]; then
  echo "❌ Fehlgeschlagen:"
  cat /tmp/immich-config-put.json
  exit 1
fi

# Verifizieren
VERIFY="$("${CURL[@]}" -H "Authorization: Bearer ${TOKEN}" "${IMMICH_URL}/api/system-config")"
echo "$VERIFY" | node -e '
let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
  const o=JSON.parse(d).oauth;
  if(!o.enabled) { console.error("oauth.enabled != true"); process.exit(1); }
  if(o.autoRegister) { console.error("autoRegister muss false sein"); process.exit(1); }
  console.log("✅ Immich OAuth gesetzt:");
  console.log("   enabled=", o.enabled, "autoRegister=", o.autoRegister);
  console.log("   issuerUrl=", o.issuerUrl);
  console.log("   clientId=", o.clientId);
});
'
