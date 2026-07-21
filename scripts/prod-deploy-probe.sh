#!/usr/bin/env bash
# Produktions-Deploy-Probe: prüft, ob eine laufende PrivMail-Instanz release-tauglich ist.
# Lokal (E2E): DOMAIN=privmail.test CURL_EXTRA_ARGS='-k --resolve …' ./scripts/prod-deploy-probe.sh
# Produktion:  DOMAIN=mail.example.com ./scripts/prod-deploy-probe.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" && -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi
DOMAIN="${DOMAIN:?DOMAIN setzen oder in .env hinterlegen}"
VAULT_HOST="${VAULT_HOST:-vault.${DOMAIN}}"
PHOTOS_HOST="${PHOTOS_HOST:-photos.${DOMAIN}}"
ISSUER="${OIDC_ISSUER:-https://${DOMAIN}}"

# shellcheck disable=SC2206
CURL=(curl -sS --max-time 20 ${CURL_EXTRA_ARGS:-})

pass=0; fail=0; warn=0
log(){ echo "$*"; }
ok(){ pass=$((pass+1)); log "[PASS] $*"; }
ko(){ fail=$((fail+1)); log "[FAIL] $*"; }
wn(){ warn=$((warn+1)); log "[WARN] $*"; }

log "=== PrivMail 1.0 Prod-Deploy-Probe — ${DOMAIN} ==="
log "Zeit: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log ""

# 1 HTTPS + Discovery
code=$("${CURL[@]}" -o /tmp/pm-disc.json -w '%{http_code}' "${ISSUER}/.well-known/openid-configuration" || echo 000)
if [[ "$code" == "200" ]] && grep -q authorization_endpoint /tmp/pm-disc.json; then
  ok "1 OIDC Discovery HTTP 200"
else
  ko "1 OIDC Discovery HTTP $code"
fi

# 2 Security headers API
hdr=$("${CURL[@]}" -D- -o /dev/null -I "https://${DOMAIN}/api/auth/setup-required" 2>/dev/null || true)
miss=""
echo "$hdr" | grep -qi 'strict-transport-security' || miss="$miss HSTS"
echo "$hdr" | grep -qi 'x-content-type-options' || miss="$miss XCTO"
echo "$hdr" | grep -qi 'x-frame-options' || miss="$miss XFO"
[[ -z "$miss" ]] && ok "2 API Security-Header" || ko "2 API Header fehlen:$miss"

# 3 Frontend headers
hdr=$("${CURL[@]}" -D- -o /dev/null -I "https://${DOMAIN}/" 2>/dev/null || true)
miss=""
echo "$hdr" | grep -qi 'strict-transport-security' || miss="$miss HSTS"
echo "$hdr" | grep -qi 'content-security-policy' || miss="$miss CSP"
[[ -z "$miss" ]] && ok "3 Frontend Security-Header" || ko "3 Frontend Header fehlen:$miss"

# 4 Setup / Auth API
code=$("${CURL[@]}" -o /tmp/pm-setup.json -w '%{http_code}' "https://${DOMAIN}/api/auth/setup-required" || echo 000)
[[ "$code" == "200" ]] && ok "4 Auth API HTTP 200" || ko "4 Auth API HTTP $code"

# 5 Vaultwarden
code=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "https://${VAULT_HOST}/alive" || echo 000)
[[ "$code" == "200" ]] && ok "5 Vaultwarden /alive HTTP 200" || wn "5 Vaultwarden nicht erreichbar HTTP $code (optional wenn Suite ohne Vault)"

# 6 Immich
code=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "https://${PHOTOS_HOST}/api/server/ping" || echo 000)
[[ "$code" == "200" ]] && ok "6 Immich ping HTTP 200" || wn "6 Immich nicht erreichbar HTTP $code (optional)"

# 7 Admin ohne Token
code=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/admin/users" || echo 000)
[[ "$code" == "401" || "$code" == "403" ]] && ok "7 Admin unauth HTTP $code" || ko "7 Admin unauth erwartet 401/403 got $code"

# 8 OIDC bad redirect
code=$("${CURL[@]}" -o /tmp/pm-oidc.json -w '%{http_code}' \
  "${ISSUER}/oidc/auth?client_id=vaultwarden&redirect_uri=https%3A%2F%2Fevil.example%2Fcb&response_type=code&scope=openid&code_challenge=x&code_challenge_method=S256" || echo 000)
[[ "$code" == "400" ]] && ok "8 OIDC invalid redirect HTTP 400" || ko "8 OIDC redirect HTTP $code"

# 9 TLS Zertifikat (nicht self-signed in Prod)
if [[ "${ALLOW_SELF_SIGNED:-}" == "true" ]]; then
  wn "9 TLS: Self-Signed erlaubt (ALLOW_SELF_SIGNED=true) — nur Dev/E2E"
else
  if curl -sS --max-time 15 "https://${DOMAIN}/" -o /dev/null 2>/tmp/pm-tls.err; then
    ok "9 TLS öffentlich vertrauenswürdig"
  else
    if grep -qi 'self.signed\|certificate problem\|SSL certificate' /tmp/pm-tls.err 2>/dev/null; then
      ko "9 TLS nicht öffentlich gültig — setup-ssl.sh / Let's Encrypt nötig"
    else
      wn "9 TLS-Check unklar: $(head -c 120 /tmp/pm-tls.err)"
    fi
  fi
fi

# 10 Secrets nicht Default (wenn .env lokal)
if [[ -f .env ]]; then
  if grep -qE 'JWT_SECRET=(change-me|dev-secret)|DB_PASSWORD=change-me|ALLOW_INSECURE_DEV=true' .env 2>/dev/null; then
    ko "10 .env enthält unsichere Defaults (change-me / ALLOW_INSECURE_DEV)"
  else
    ok "10 .env ohne offensichtliche Dev-Defaults"
  fi
else
  wn "10 Keine lokale .env — Secrets auf Server prüfen"
fi

# 11 DKIM
if [[ -f .env ]] && grep -q '^DKIM_PRIVATE_KEY_PATH=.\+' .env 2>/dev/null; then
  ok "11 DKIM_PRIVATE_KEY_PATH gesetzt"
else
  wn "11 DKIM nicht konfiguriert — ausgehende Mail ohne Signatur (setup-dkim.sh)"
fi

# 12 Compose ports sanity (lokal)
if command -v docker >/dev/null && docker compose ps >/dev/null 2>&1; then
  PUB=$(docker compose ps --format json 2>/dev/null | python3 -c '
import sys,json
bad=[]
for line in sys.stdin:
  try: o=json.loads(line)
  except: continue
  ports=str(o.get("Publishers") or o.get("Ports") or "")
  name=o.get("Service") or o.get("Name") or ""
  for leak in ("5432","6379","2283"):
    if leak in ports and "0.0.0.0" in ports:
      bad.append(f"{name}:{leak}")
print(",".join(bad))
' 2>/dev/null || true)
  if [[ -z "$PUB" ]]; then
    ok "12 Keine DB/Redis-Host-Ports in Compose-ps"
  else
    ko "12 Interne Ports öffentlich: $PUB"
  fi
else
  wn "12 Docker nicht verfügbar — Port-Check übersprungen"
fi

log ""
log "=== SUMMARY pass=$pass fail=$fail warn=$warn ==="
if [[ "$fail" -gt 0 ]]; then
  log "Ergebnis: NICHT produktionsbereit"
  exit 1
fi
log "Ergebnis: Probe bestanden (Warnungen prüfen)"
exit 0
