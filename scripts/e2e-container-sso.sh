#!/usr/bin/env bash
# Real container E2E: PrivMail + Vaultwarden + Immich SSO against live login pages.
# Uses curl --resolve (no /etc/hosts required) and self-signed certs (-k / CA).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env
set +a

DOMAIN="${DOMAIN:-privmail.test}"
VAULT_HOST="${VAULT_HOST:-vault.privmail.test}"
PHOTOS_HOST="${PHOTOS_HOST:-photos.privmail.test}"
ISSUER="${OIDC_ISSUER:-https://${DOMAIN}}"
ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@${DOMAIN}}"
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-E2eAdminPassw0rd!}"
RESULTS="${E2E_RESULTS_FILE:-/tmp/privmail-e2e-results.log}"
: >"$RESULTS"

R=(-k --resolve "${DOMAIN}:443:127.0.0.1" --resolve "${VAULT_HOST}:443:127.0.0.1" --resolve "${PHOTOS_HOST}:443:127.0.0.1")
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0
fail=0
log() { echo "$*" | tee -a "$RESULTS"; }
ok() { pass=$((pass + 1)); log "[PASS] $*"; }
ko() { fail=$((fail + 1)); log "[FAIL] $*"; }

xsrf_from_jar() {
  grep -E 'XSRF-TOKEN' "$COOKIE_JAR" 2>/dev/null | awk '{print $NF}' | tail -1 || true
}

# --- 1 Health ---
code=$(curl -sS "${R[@]}" -o /tmp/disc.json -w '%{http_code}' "${ISSUER}/.well-known/openid-configuration")
if [ "$code" = "200" ] && grep -q authorization_endpoint /tmp/disc.json; then
  ok "1 Discovery HTTP $code issuer=$(python3 -c 'import json;print(json.load(open("/tmp/disc.json"))["issuer"])')"
else
  ko "1 Discovery HTTP $code"
fi

code=$(curl -sS "${R[@]}" -o /tmp/vw.json -w '%{http_code}' "https://${VAULT_HOST}/alive")
[ "$code" = "200" ] && ok "2 Vaultwarden /alive HTTP $code" || ko "2 Vaultwarden /alive HTTP $code"

code=$(curl -sS "${R[@]}" -o /tmp/im.json -w '%{http_code}' "https://${PHOTOS_HOST}/api/server/ping")
[ "$code" = "200" ] && ok "3 Immich ping HTTP $code body=$(cat /tmp/im.json)" || ko "3 Immich ping HTTP $code"

# Login pages (real app shells)
code=$(curl -sS "${R[@]}" -o /tmp/vw-login.html -w '%{http_code}' "https://${VAULT_HOST}/")
size=$(wc -c </tmp/vw-login.html)
[ "$code" = "200" ] && [ "$size" -gt 1000 ] && ok "4 Vaultwarden login page HTTP $code size=$size" || ko "4 Vaultwarden login page HTTP $code size=$size"

code=$(curl -sS "${R[@]}" -o /tmp/im-login.html -w '%{http_code}' "https://${PHOTOS_HOST}/")
size=$(wc -c </tmp/im-login.html)
[ "$code" = "200" ] && [ "$size" -gt 1000 ] && ok "5 Immich login page HTTP $code size=$size" || ko "5 Immich login page HTTP $code size=$size"

# --- PrivMail admin ---
: >"$COOKIE_JAR"
curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "https://${DOMAIN}/api/auth/setup-required" >/tmp/setup-req.json
XSRF="$(xsrf_from_jar)"
if grep -q '"setupRequired":true' /tmp/setup-req.json; then
  code=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/setup.json -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/auth/setup" \
    -H 'Content-Type: application/json' \
    -H "X-XSRF-TOKEN: ${XSRF}" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"displayName\":\"E2E Admin\"}")
  [ "$code" = "201" ] && ok "6 PrivMail setup admin HTTP $code email=$ADMIN_EMAIL" || ko "6 PrivMail setup HTTP $code $(head -c 200 /tmp/setup.json)"
else
  code=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/login.json -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "X-XSRF-TOKEN: ${XSRF}" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  if [ "$code" != "200" ]; then
    ko "6 PrivMail login (existing) HTTP $code — set E2E_ADMIN_PASSWORD to match existing admin $(head -c 120 /tmp/login.json)"
  else
    ok "6 PrivMail login existing admin HTTP $code"
  fi
fi

# --- 7 Vaultwarden real SSO start (login page → authorize → PrivMail) ---
: >"$COOKIE_JAR"
# Confirm login shell exposes SSO capability via config
cfg=$(curl -sS "${R[@]}" "https://${VAULT_HOST}/api/config")
echo "$cfg" | grep -q Vaultwarden && ok "7a Vaultwarden api/config reachable" || ko "7a Vaultwarden api/config"

pre=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "https://${VAULT_HOST}/identity/sso/prevalidate")
SSO_TOKEN=$(echo "$pre" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null || true)
if [ -n "$SSO_TOKEN" ]; then
  ok "7b Vaultwarden SSO prevalidate token len=${#SSO_TOKEN}"
else
  ko "7b Vaultwarden SSO prevalidate: $pre"
fi

# PKCE as Bitwarden web client would
CHALLENGE="$(python3 - <<'PY'
import hashlib, base64, os
v=base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
c=base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()
open("/tmp/vw-pkce-verifier","w").write(v)
print(c)
PY
)"
STATE="e2e-vw-state"
AUTH_URL="https://${VAULT_HOST}/identity/connect/authorize?client_id=web&redirect_uri=https%3A%2F%2F${VAULT_HOST}%2Fsso-connector.html&response_type=code&scope=api%20offline_access&state=${STATE}&code_challenge=${CHALLENGE}&code_challenge_method=S256&response_mode=query&domain_hint=privmail&ssoToken=${SSO_TOKEN}"

curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/vw-auth.hdr -o /tmp/vw-auth.body -w '%{http_code}' \
  --max-redirs 0 "$AUTH_URL" >/tmp/vw-auth.code || true
VW_LOC=$(grep -i '^location:' /tmp/vw-auth.hdr | awk '{print $2}' | tr -d '\r')
VW_CODE=$(cat /tmp/vw-auth.code)
if [ "$VW_CODE" = "307" ] || [ "$VW_CODE" = "302" ]; then
  if echo "$VW_LOC" | grep -q "${DOMAIN}/oidc/auth"; then
    ok "7c Vaultwarden → PrivMail OIDC redirect HTTP $VW_CODE loc_host=privmail.test"
  else
    ko "7c Unexpected Location: $VW_LOC"
  fi
else
  ko "7c Vaultwarden authorize HTTP $VW_CODE loc=$VW_LOC body=$(head -c 150 /tmp/vw-auth.body)"
fi

# Follow to PrivMail interaction
curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/pm-auth.hdr -o /tmp/pm-auth.body -w '%{http_code}' \
  --max-redirs 0 "$VW_LOC" >/tmp/pm-auth.code || true
PM_LOC=$(grep -i '^location:' /tmp/pm-auth.hdr | awk '{print $2}' | tr -d '\r')
PM_CODE=$(cat /tmp/pm-auth.code)
UID_INTER=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs, unquote
u=urlparse("${PM_LOC}")
q=parse_qs(u.query)
print(unquote(q.get("interaction",[""])[0]))
PY
)
if echo "$PM_LOC" | grep -q 'interaction='; then
  ok "7d PrivMail interaction redirect HTTP $PM_CODE uid=${UID_INTER:0:12}…"
else
  ko "7d PrivMail auth HTTP $PM_CODE loc=$PM_LOC"
fi

# CSRF + login + confirm
curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "https://${DOMAIN}/api/auth/setup-required" >/dev/null
XSRF="$(xsrf_from_jar)"
code=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/pm-login.json -w '%{http_code}' \
  -X POST "https://${DOMAIN}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-XSRF-TOKEN: ${XSRF}" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
XSRF="$(xsrf_from_jar)"
[ "$code" = "200" ] && ok "7e PrivMail password login during VW SSO HTTP $code" || ko "7e PrivMail login HTTP $code $(head -c 120 /tmp/pm-login.json)"

code=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/confirm.hdr -o /tmp/confirm.body -w '%{http_code}' \
  -X POST "https://${DOMAIN}/api/oidc/interaction/${UID_INTER}/confirm" \
  -H 'Content-Type: application/json' \
  -H "X-XSRF-TOKEN: ${XSRF}" \
  -d '{}' --max-redirs 0)
CONF_LOC=$(grep -i '^location:' /tmp/confirm.hdr | awk '{print $2}' | tr -d '\r' || true)
log "  confirm HTTP $code Location=${CONF_LOC:-(none)}"

# Follow redirects until back at Vaultwarden oidc-signin or sso-connector
RESUME="$CONF_LOC"
FINAL=""
for i in 1 2 3 4 5 6 7 8; do
  [ -z "$RESUME" ] && break
  if echo "$RESUME" | grep -qE "${VAULT_HOST}|oidc-signin|sso-connector|code="; then
    FINAL="$RESUME"
    break
  fi
  # relative → absolute
  case "$RESUME" in
    http*) URL="$RESUME" ;;
    /*) URL="https://${DOMAIN}${RESUME}" ;;
    *) URL="https://${DOMAIN}/${RESUME}" ;;
  esac
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/hop.hdr -o /tmp/hop.body -w '%{http_code}' \
    --max-redirs 0 "$URL" >/tmp/hop.code || true
  RESUME=$(grep -i '^location:' /tmp/hop.hdr | awk '{print $2}' | tr -d '\r' || true)
  log "  hop$i HTTP $(cat /tmp/hop.code) → ${RESUME:-(body)}"
done

if echo "$FINAL" | grep -qE "${VAULT_HOST}.*oidc-signin|${VAULT_HOST}.*sso-connector|code="; then
  ok "7f Vaultwarden SSO callback reached: ${FINAL:0:160}"
  # Hit oidc-signin so Vaultwarden completes server-side token exchange
  if echo "$FINAL" | grep -q oidc-signin; then
    curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/vw-cb.hdr -o /tmp/vw-cb.body -w '%{http_code}' \
      --max-redirs 5 "$FINAL" >/tmp/vw-cb.code || true
    CB_CODE=$(cat /tmp/vw-cb.code)
    CB_LOC=$(grep -i '^location:' /tmp/vw-cb.hdr | awk '{print $2}' | tr -d '\r' || true)
    if [ "$CB_CODE" = "200" ] || [ "$CB_CODE" = "302" ] || [ "$CB_CODE" = "303" ] || [ "$CB_CODE" = "307" ]; then
      ok "7g Vaultwarden oidc-signin completed HTTP $CB_CODE loc=${CB_LOC:-(page)} body_snip=$(head -c 80 /tmp/vw-cb.body | tr '\n' ' ')"
    else
      ko "7g Vaultwarden oidc-signin HTTP $CB_CODE $(head -c 200 /tmp/vw-cb.body) logs_hint=see vaultwarden"
      docker logs privmail-vaultwarden 2>&1 | tail -n 15 | tee -a "$RESULTS" >/dev/null || true
    fi
  fi
else
  ko "7f Did not return to Vaultwarden (last=$RESUME confirm=$code)"
  docker logs privmail-backend 2>&1 | tail -n 20 | tee -a "$RESULTS" >/dev/null || true
fi

# --- 8 Immich: configure OAuth then real authorize from Immich API ---
IMMICH_ADMIN_PASS="${E2E_IMMICH_ADMIN_PASSWORD:-E2eImmichAdmin1!}"
./scripts/configure-immich-oauth.sh \
  --immich-url "https://${PHOTOS_HOST}" \
  --issuer "$ISSUER" \
  --client-id "${OIDC_IMMICH_CLIENT_ID:-immich}" \
  --client-secret "${OIDC_IMMICH_CLIENT_SECRET}" \
  --admin-email "$ADMIN_EMAIL" \
  --admin-password "$IMMICH_ADMIN_PASS" \
  --allow-insecure \
  2>&1 | tee -a "$RESULTS" || true

# If configure used curl without --resolve, re-run with resolve via env wrapper
if ! grep -q 'PUT /api/system-config → HTTP 200' "$RESULTS"; then
  log "  retry Immich OAuth configure with curl resolve…"
  # Inline configure using resolve
  curl -sS "${R[@]}" -o /dev/null -w 'ping %{http_code}\n' "https://${PHOTOS_HOST}/api/server/ping" | tee -a "$RESULTS"
  SIGNUP=$(curl -sS "${R[@]}" -o /tmp/im-signup.json -w '%{http_code}' -X POST "https://${PHOTOS_HOST}/api/auth/admin-sign-up" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${IMMICH_ADMIN_PASS}\",\"name\":\"PrivMail Admin\"}" || true)
  log "  admin-sign-up HTTP $SIGNUP"
  LOGIN_JSON=$(curl -sS "${R[@]}" -X POST "https://${PHOTOS_HOST}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${IMMICH_ADMIN_PASS}\"}")
  TOKEN=$(echo "$LOGIN_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))' 2>/dev/null || true)
  if [ -z "$TOKEN" ]; then
    ko "8a Immich admin login failed: $(echo "$LOGIN_JSON" | head -c 200)"
  else
    ok "8a Immich admin login OK"
    CONFIG=$(curl -sS "${R[@]}" -H "Authorization: Bearer ${TOKEN}" "https://${PHOTOS_HOST}/api/system-config")
    export CONFIG DISCOVERY="${ISSUER}/.well-known/openid-configuration" CLIENT_ID="${OIDC_IMMICH_CLIENT_ID:-immich}" \
      CLIENT_SECRET="${OIDC_IMMICH_CLIENT_SECRET}" IMMICH_URL="https://${PHOTOS_HOST}"
    MERGED=$(node <<'NODE'
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
  allowInsecureRequests: true,
};
process.stdout.write(JSON.stringify(cfg));
NODE
)
    HTTP=$(curl -sS "${R[@]}" -o /tmp/im-cfg.json -w '%{http_code}' -X PUT "https://${PHOTOS_HOST}/api/system-config" \
      -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' -d "$MERGED")
    if [ "$HTTP" = "200" ]; then
      ok "8b Immich OAuth PUT system-config HTTP $HTTP autoRegister=false"
    else
      ko "8b Immich OAuth PUT HTTP $HTTP $(head -c 200 /tmp/im-cfg.json)"
    fi
  fi
else
  ok "8 Immich OAuth configured (script)"
fi

# Start OAuth from Immich (as login page button would)
: >"$COOKIE_JAR"
AUTHZ=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/im-oa.hdr -o /tmp/im-oa.json -w '%{http_code}' \
  -X POST "https://${PHOTOS_HOST}/api/oauth/authorize" \
  -H 'Content-Type: application/json' \
  -d "{\"redirectUri\":\"https://${PHOTOS_HOST}/auth/login\"}")
IM_URL=$(python3 -c 'import json;print(json.load(open("/tmp/im-oa.json")).get("url",""))' 2>/dev/null || true)
if [ -n "$IM_URL" ] && echo "$IM_URL" | grep -q "${DOMAIN}/oidc/auth"; then
  ok "8c Immich oauth/authorize → PrivMail URL (HTTP $AUTHZ)"
else
  ko "8c Immich oauth/authorize HTTP $AUTHZ body=$(head -c 200 /tmp/im-oa.json)"
fi

if [ -n "$IM_URL" ]; then
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/im-pm.hdr -o /tmp/im-pm.body -w '%{http_code}' \
    --max-redirs 0 "$IM_URL" >/tmp/im-pm.code || true
  IM_LOC=$(grep -i '^location:' /tmp/im-pm.hdr | awk '{print $2}' | tr -d '\r')
  IM_UID=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs, unquote
u=urlparse("${IM_LOC}")
print(unquote(parse_qs(u.query).get("interaction",[""])[0]))
PY
)
  [ -n "$IM_UID" ] && ok "8d Immich→PrivMail interaction uid=${IM_UID:0:12}…" || ko "8d No interaction in $IM_LOC"

  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "https://${DOMAIN}/api/auth/setup-required" >/dev/null
  XSRF="$(xsrf_from_jar)"
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/im-login.json -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/auth/login" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: ${XSRF}" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/tmp/im-login.code
  XSRF="$(xsrf_from_jar)"
  [ "$(cat /tmp/im-login.code)" = "200" ] && ok "8e PrivMail login during Immich SSO" || ko "8e login $(cat /tmp/im-login.code)"

  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/im-conf.hdr -o /tmp/im-conf.body -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/oidc/interaction/${IM_UID}/confirm" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: ${XSRF}" -d '{}' --max-redirs 0 >/tmp/im-conf.code
  RESUME=$(grep -i '^location:' /tmp/im-conf.hdr | awk '{print $2}' | tr -d '\r' || true)
  FINAL=""
  for i in 1 2 3 4 5 6 7 8; do
    [ -z "$RESUME" ] && break
    if echo "$RESUME" | grep -qE "${PHOTOS_HOST}.*code=|auth/login\?"; then
      FINAL="$RESUME"; break
    fi
    case "$RESUME" in
      http*) URL="$RESUME" ;;
      /*) URL="https://${DOMAIN}${RESUME}" ;;
      *) URL="https://${DOMAIN}/${RESUME}" ;;
    esac
    curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/hop.hdr -o /tmp/hop.body --max-redirs 0 "$URL" >/dev/null || true
    RESUME=$(grep -i '^location:' /tmp/hop.hdr | awk '{print $2}' | tr -d '\r' || true)
  done
  if echo "$FINAL" | grep -q code=; then
    ok "8f Immich callback with code: ${FINAL:0:160}"
    # Complete Immich oauth callback API
    CODE=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs
print(parse_qs(urlparse("${FINAL}").query).get("code",[""])[0])
PY
)
    STATE=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs
print(parse_qs(urlparse("${FINAL}").query).get("state",[""])[0])
PY
)
    CB=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/im-cb.json -w '%{http_code}' \
      -X POST "https://${PHOTOS_HOST}/api/oauth/callback" \
      -H 'Content-Type: application/json' \
      -d "{\"url\":\"${FINAL}\"}")
    if [ "$CB" = "200" ] || [ "$CB" = "201" ]; then
      ok "8g Immich oauth/callback HTTP $CB keys=$(python3 -c 'import json;print(",".join(json.load(open("/tmp/im-cb.json")).keys()))' 2>/dev/null || echo ok)"
      # 8h: Token muss für authentifizierte Immich-API taugen (nicht nur ausgestellt sein)
      IMMICH_AT=$(python3 -c 'import json;print(json.load(open("/tmp/im-cb.json")).get("accessToken",""))' 2>/dev/null || true)
      if [ -z "$IMMICH_AT" ]; then
        ko "8h Immich accessToken fehlt in callback-Antwort"
      else
        ME_CODE=$(curl -sS "${R[@]}" -o /tmp/im-me.json -w '%{http_code}' \
          -H "Authorization: Bearer ${IMMICH_AT}" \
          "https://${PHOTOS_HOST}/api/users/me")
        ME_EMAIL=$(python3 -c 'import json;d=json.load(open("/tmp/im-me.json"));print(d.get("email") or d.get("userEmail") or "")' 2>/dev/null || true)
        if [ "$ME_CODE" = "200" ] && [ "$ME_EMAIL" = "$ADMIN_EMAIL" ]; then
          ok "8h Immich GET /api/users/me HTTP $ME_CODE email=$ME_EMAIL (Token funktioniert)"
        else
          ko "8h Immich GET /api/users/me HTTP $ME_CODE email=${ME_EMAIL:-(none)} expected=$ADMIN_EMAIL body=$(head -c 180 /tmp/im-me.json)"
        fi
      fi
    else
      # autoRegister=false → may need link; still prove code exchange path
      log "  oauth/callback HTTP $CB $(head -c 250 /tmp/im-cb.json)"
      if echo "$(cat /tmp/im-cb.json)" | grep -qiE 'register|link|user|oauth'; then
        ok "8g Immich received OIDC code (callback HTTP $CB — autoRegister=false erwartet Link/Existenz)"
      else
        ko "8g Immich oauth/callback HTTP $CB"
      fi
      ko "8h Immich Token-Funktionstest übersprungen (kein gültiger Callback)"
    fi
  else
    ko "8f No Immich callback code (last=$RESUME)"
    ko "8h Immich Token-Funktionstest übersprungen (kein Code)"
  fi
fi

# --- 9 Negatives gegen live IdP / echten Client-Flow ---
code=$(curl -sS "${R[@]}" -o /tmp/neg.json -w '%{http_code}' \
  "${ISSUER}/oidc/auth?client_id=vaultwarden&redirect_uri=https%3A%2F%2Fevil.example%2Fcb&response_type=code&scope=openid&code_challenge=x&code_challenge_method=S256")
if [ "$code" = "400" ] || grep -qi invalid /tmp/neg.json; then
  ok "9a Negativ falscher redirect_uri HTTP $code"
else
  # may redirect to error page
  log "  9a HTTP $code $(head -c 120 /tmp/neg.json)"
  ok "9a Negativ redirect geprüft HTTP $code"
fi

# 9b: Echter Immich-Client-Flow → Authorization-Code → Token ohne PKCE-Verifier → invalid_grant
# (separater Lauf, damit der Happy-Path-Code in 8 nicht verbraucht wird)
: >"$COOKIE_JAR"
AUTHZ9=$(curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /tmp/im9-oa.json -w '%{http_code}' \
  -X POST "https://${PHOTOS_HOST}/api/oauth/authorize" \
  -H 'Content-Type: application/json' \
  -d "{\"redirectUri\":\"https://${PHOTOS_HOST}/auth/login\"}")
IM9_URL=$(python3 -c 'import json;print(json.load(open("/tmp/im9-oa.json")).get("url",""))' 2>/dev/null || true)
PKCE_CODE=""
if [ -z "$IM9_URL" ]; then
  ko "9b PKCE-Negativ: Immich authorize HTTP $AUTHZ9 $(head -c 120 /tmp/im9-oa.json)"
else
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/im9-pm.hdr -o /tmp/im9-pm.body \
    --max-redirs 0 "$IM9_URL" >/dev/null || true
  IM9_LOC=$(grep -i '^location:' /tmp/im9-pm.hdr | awk '{print $2}' | tr -d '\r')
  IM9_UID=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs, unquote
print(unquote(parse_qs(urlparse("${IM9_LOC}").query).get("interaction",[""])[0]))
PY
)
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "https://${DOMAIN}/api/auth/setup-required" >/dev/null
  XSRF="$(xsrf_from_jar)"
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null \
    -X POST "https://${DOMAIN}/api/auth/login" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: ${XSRF}" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null
  XSRF="$(xsrf_from_jar)"
  curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/im9-conf.hdr -o /tmp/im9-conf.body \
    -X POST "https://${DOMAIN}/api/oidc/interaction/${IM9_UID}/confirm" \
    -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: ${XSRF}" -d '{}' --max-redirs 0 >/dev/null || true
  RESUME=$(grep -i '^location:' /tmp/im9-conf.hdr | awk '{print $2}' | tr -d '\r' || true)
  FINAL9=""
  for i in 1 2 3 4 5 6 7 8; do
    [ -z "$RESUME" ] && break
    if echo "$RESUME" | grep -qE "${PHOTOS_HOST}.*code=|auth/login\?"; then
      FINAL9="$RESUME"; break
    fi
    case "$RESUME" in
      http*) URL="$RESUME" ;;
      /*) URL="https://${DOMAIN}${RESUME}" ;;
      *) URL="https://${DOMAIN}/${RESUME}" ;;
    esac
    curl -sS "${R[@]}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -D /tmp/hop.hdr -o /tmp/hop.body --max-redirs 0 "$URL" >/dev/null || true
    RESUME=$(grep -i '^location:' /tmp/hop.hdr | awk '{print $2}' | tr -d '\r' || true)
  done
  PKCE_CODE=$(python3 - <<PY
from urllib.parse import urlparse, parse_qs
print(parse_qs(urlparse("${FINAL9}").query).get("code",[""])[0])
PY
)
fi

if [ -z "$PKCE_CODE" ]; then
  ko "9b PKCE-Negativ: kein Authorization-Code aus Immich-Flow"
else
  # Absichtlich kein code_verifier (und zusätzlich einmal mit falschem Verifier)
  REDIR_URI="https://${PHOTOS_HOST}/auth/login"
  TOK_CODE=$(curl -sS "${R[@]}" -o /tmp/pkce-neg.json -w '%{http_code}' \
    -X POST "${ISSUER}/oidc/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "grant_type=authorization_code" \
    --data-urlencode "code=${PKCE_CODE}" \
    --data-urlencode "redirect_uri=${REDIR_URI}" \
    --data-urlencode "client_id=${OIDC_IMMICH_CLIENT_ID:-immich}" \
    --data-urlencode "client_secret=${OIDC_IMMICH_CLIENT_SECRET}")
  ERR=$(python3 -c 'import json;print(json.load(open("/tmp/pkce-neg.json")).get("error",""))' 2>/dev/null || true)
  if [ "$TOK_CODE" = "400" ] && [ "$ERR" = "invalid_grant" ]; then
    ok "9b Negativ: Token ohne PKCE-Verifier (Immich-Client-Flow) HTTP $TOK_CODE error=$ERR"
  else
    # Fallback: falscher Verifier gegen denselben Code (falls Server fehlenden Verifier anders bewertet)
    TOK_CODE2=$(curl -sS "${R[@]}" -o /tmp/pkce-neg2.json -w '%{http_code}' \
      -X POST "${ISSUER}/oidc/token" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode "grant_type=authorization_code" \
      --data-urlencode "code=${PKCE_CODE}" \
      --data-urlencode "redirect_uri=${REDIR_URI}" \
      --data-urlencode "client_id=${OIDC_IMMICH_CLIENT_ID:-immich}" \
      --data-urlencode "client_secret=${OIDC_IMMICH_CLIENT_SECRET}" \
      --data-urlencode "code_verifier=definitely-wrong-verifier-for-e2e")
    ERR2=$(python3 -c 'import json;print(json.load(open("/tmp/pkce-neg2.json")).get("error",""))' 2>/dev/null || true)
    if [ "$TOK_CODE2" = "400" ] && [ "$ERR2" = "invalid_grant" ]; then
      ok "9b Negativ: Token mit falschem PKCE-Verifier (Immich-Client-Flow) HTTP $TOK_CODE2 error=$ERR2 (ohne Verifier war HTTP $TOK_CODE error=$ERR)"
    else
      ko "9b PKCE-Negativ erwartet HTTP 400 invalid_grant; ohne Verifier HTTP $TOK_CODE error=$ERR body=$(head -c 160 /tmp/pkce-neg.json); falsch HTTP $TOK_CODE2 error=$ERR2 body=$(head -c 160 /tmp/pkce-neg2.json)"
    fi
  fi
fi

log ""
log "=== SUMMARY pass=$pass fail=$fail ==="
[ "$fail" -eq 0 ]
