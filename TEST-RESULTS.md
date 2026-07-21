# PrivMail Suite – E2E SSO Test Results

Stand: `2026-07-21T15:05:00Z` (Container-Stack + IdP)

## 0. Container-E2E (Teil 2) – echter Compose-Stack

**Lauf:** `2026-07-21` lokal mit Docker Compose ohne sudo  
**Stack:** `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build`  
**Hosts:** `privmail.test` / `vault.privmail.test` / `photos.privmail.test` (curl `--resolve` → `127.0.0.1`, Self-Signed E2E-CA)  
**Skript:** `./scripts/e2e-container-sso.sh` → **pass=22 fail=0**

| # | Gegenstand | Ergebnis |
|---|------------|----------|
| 1 | OIDC Discovery über Nginx/HTTPS | **HTTP 200** `issuer=https://privmail.test` |
| 2 | Vaultwarden Health | **HTTP 200** `/alive` |
| 3 | Immich Health | **HTTP 200** `/api/server/ping` `{"res":"pong"}` |
| 4 | Vaultwarden Login-Seite (echtes Web-Vault) | **HTTP 200** size≈23 KB |
| 5 | Immich Login-Seite (echtes Web-UI) | **HTTP 200** size≈10 KB |
| 6 | PrivMail Admin Setup/Login | **HTTP 201/200** `admin@privmail.test` |
| 7b–c | Vaultwarden SSO-Start (`/identity/sso/prevalidate` → `/identity/connect/authorize`) | **307** → `https://privmail.test/oidc/auth?…` |
| 7d–e | PrivMail Interaction + Passwort-Login | Interaction-Redirect + **Login HTTP 200** |
| 7f–g | Zurück zu Vaultwarden | Callback `…/identity/connect/oidc-signin?code=…` → **HTTP 307** → `/sso-connector.html?code=…` (server-seitiger Token-Exchange OK) |
| 8 | Immich OAuth per API | **PUT /api/system-config → HTTP 200**, `enabled=true`, **`autoRegister=false`** |
| 8c–f | Immich Login-Flow (`POST /api/oauth/authorize` → PrivMail → Callback mit `code`) | Redirect-Kette komplett |
| 8g | Immich `POST /api/oauth/callback` | **HTTP 201** Keys=`accessToken,userId,userEmail,…` |
| 8h | Immich Token-Funktionstest `GET /api/users/me` mit Bearer-Token | **HTTP 200** `email=admin@privmail.test` |
| 9a | Negativ: falscher `redirect_uri` | **HTTP 400** |
| 9b | Negativ: Token ohne PKCE-Verifier (echter Immich-Client-Flow → `/oidc/token`) | **HTTP 400** `error=invalid_grant` |

### Roh-Log (Ausschnitt Container-Lauf)

```
[PASS] 1 Discovery HTTP 200 issuer=https://privmail.test
[PASS] 2 Vaultwarden /alive HTTP 200
[PASS] 3 Immich ping HTTP 200 body={"res":"pong"}
[PASS] 4 Vaultwarden login page HTTP 200 size=23139
[PASS] 5 Immich login page HTTP 200 size=10348
[PASS] 7c Vaultwarden → PrivMail OIDC redirect HTTP 307 loc_host=privmail.test
[PASS] 7f Vaultwarden SSO callback reached: …/identity/connect/oidc-signin?code=…
[PASS] 7g Vaultwarden oidc-signin completed HTTP 307 loc=…/sso-connector.html?code=…
[PASS] 8c Immich oauth/authorize → PrivMail URL (HTTP 201)
[PASS] 8f Immich callback with code: …/auth/login?code=…
[PASS] 8g Immich oauth/callback HTTP 201 keys=accessToken,userId,userEmail,…
[PASS] 8h Immich GET /api/users/me HTTP 200 email=admin@privmail.test (Token funktioniert)
[PASS] 9a Negativ falscher redirect_uri HTTP 400
[PASS] 9b Negativ: Token ohne PKCE-Verifier (Immich-Client-Flow) HTTP 400 error=invalid_grant
=== SUMMARY pass=22 fail=0 ===
```

Wiederholen:

```bash
./scripts/e2e-prepare.sh
./scripts/e2e-make-certs.sh
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
export CURL_EXTRA_ARGS="-k --resolve privmail.test:443:127.0.0.1 --resolve vault.privmail.test:443:127.0.0.1 --resolve photos.privmail.test:443:127.0.0.1"
./scripts/e2e-container-sso.sh
```

## 1. Was zusätzlich automatisiert (IdP-Unit/E2E ohne Compose) wurde

| # | Gegenstand | Ergebnis (Auszug) |
|---|------------|-------------------|
| 1 | Secrets/CORS-Generierung | `scripts/generate-secrets.sh` setzt u. a. `OIDC_*_CLIENT_SECRET`, leitet `CORS_ORIGINS` ab |
| 2 | Immich-OAuth per API | `PUT /api/system-config` → **HTTP 200**, `autoRegister=false` |
| 3 | Auto-TLS Multi-SAN | `setup-ssl.sh` fordert certbot für `DOMAIN` + Vault- + Photos-Host |
| 6–9 | Embedded-Postgres IdP-E2E | Discovery, VW/Immich-PKCE, Negativtests – siehe `backend/src/test/e2e/sso-suite.e2e.ts` |

Wiederholen IdP-only: `cd backend && node --require ts-node/register/transpile-only src/test/e2e/sso-suite.e2e.ts`

## 2. Was NICHT automatisierbar ist (und warum)

| Thema | Warum |
|-------|--------|
| DNS-A/AAAA beim Registrar | Erfordert Login/Besitz der Domain beim Provider |
| Öffentlich gültiges Let’s-Encrypt-Zertifikat | ACME braucht erreichbare Domain + DNS |

## 3. Exakt verbleibende Schritte für Produktion (Operator)

1. Drei DNS-Einträge: `<DOMAIN>`, Vault-Host, Photos-Host  
2. `./infrastructure/scripts/setup-ssl.sh <DOMAIN>`  
3. Optional: `./scripts/configure-immich-oauth.sh …` nach erstem Immich-Admin  

## 4. Bekannte Einschränkungen / Restrisiken

- Vaultwarden-Master-Passwort bleibt nach SSO nötig (Zero-Knowledge) – kein Bug; E2E endet bewusst am `sso-connector.html` (Web-Vault setzt danach die Master-Password-Entschlüsselung fort).
- Immich `autoRegister=false`: Callback kann ohne vorherige Benutzerverknüpfung scheitern; im Lauf war der Immich-Admin bereits vorhanden → **HTTP 201** mit Session; Token-Nutzung per `GET /api/users/me` nachgewiesen.
- Backend in Compose braucht `TLS_CERT_PATH`/`TLS_KEY_PATH` (E2E: Mount der Self-Signed-Certs in `docker-compose.e2e.yml`); HTTPS für Clients läuft über Nginx.
- `/etc/hosts` optional – Tests nutzen `curl --resolve`.
- PKCE-Negativtest (9b) läuft als eigener Immich-Authorize-Durchlauf gegen PrivMails `/oidc/token` (ohne `code_verifier`), damit der Happy-Path-Code in 8 nicht verbraucht wird.

## Automatisierte Artefakte

| Datei | Zweck |
|-------|--------|
| `scripts/e2e-prepare.sh` / `e2e-make-certs.sh` | Lokale Domain + Self-Signed CA |
| `docker-compose.e2e.yml` | DNS-Aliase, CA-Trust VW/Immich, Backend-TLS-Mount |
| `scripts/e2e-container-sso.sh` | **Echter** SSO gegen VW- + Immich-Login (+ PKCE-Negativ, Immich-Token-Me) |
| `scripts/configure-immich-oauth.sh` | Immich OAuth via API (`CURL_EXTRA_ARGS` für E2E) |
| `backend/src/test/e2e/sso-suite.e2e.ts` | IdP-E2E ohne Docker |

---

## 5. Penetrationstest + Krypto-Reparatur (2026-07-21)

Autorisierter Test gegen den lokalen Compose-Stack (`*.privmail.test`). Skripte: `scripts/pentest-stack.sh`, `scripts/e2e-srp-login.sh`.

### 5.1 Krypto-Fixes (Teil 1)

| # | Thema | Status | Beleg |
|---|--------|--------|-------|
| 1 | SRP-Modulus N = vollständige RFC-5054-2048-bit-Gruppe | **Behoben** | `backend/src/utils/crypto/srp.ts`, `frontend/web/src/lib/srp.ts`; Unit-Test `srp.test.ts` (N ungerade, nicht durch kleine Primzahlen teilbar; Client↔Server-Proof) |
| 2 | Challenge/Verify speichert `b` unter `challengeId` (TTL 5 min) | **Behoben** | `srp-challenge-store.ts`; Auth-Routen rufen `getServerChallenge`/`verifyClientProof` korrekt auf |
| 2b | Frontend `verifyServerProof` nutzt `M` statt Salt | **Behoben** | `frontend/web/src/lib/srp.ts` |
| 2c | Echter SRP-Login E2E | **PASS** | `./scripts/e2e-srp-login.sh` → `login 200` `enroll 200` `challenge 200` `verify 200` `proofOk=true` `email=admin@privmail.test` |
| 3 | Hybrid: echte ML-KEM-768 via `@noble/post-quantum` (ESM dynamic import) | **Behoben** | Manuell: `alg ml-kem-768` encrypt/decrypt OK; Legacy secp521r1 nur noch als „classical-secondary“ entschlüsselbar, keine PQ-Zusage |

### 5.2 Angriffstests (Teil 2) — `pass=16 fail=0`

```
[PASS] 1 XSS Sanitizer entschärft … <img src=x>  (onerror entfernt; <script> entfernt)
[PASS] 2 CSRF ohne Token abgewiesen HTTP 403 {"error":"Ungültiges oder fehlendes CSRF-Token"}
[PASS] 3 Injection kein SQL-Leak HTTP 200/401 body ohne SQL-Details
[PASS] 4 Brute-Force Web-Login Rate-Limit HTTP 429
[PASS] 5 SMTP/IMAP AUTH Rate-Limit greift smtp=0 imap=1
[PASS] 6 VRFY/EXPN disabled: 502 Command disabled for security reasons
[PASS] 7 Attachment Traversal blockiert: filename=passwd read_trav=null/null read_ok=true
[PASS] 8 Admin ohne Token HTTP 401
[PASS] 9 OIDC reject redirect_uri=https://evil.example/cb HTTP 400
[PASS] 9 OIDC reject redirect_uri=https://privmail.test.evil.com/cb HTTP 400
[PASS] 9 OIDC reject …vault.privmail.test.evil.com… HTTP 400
[PASS] 9 OIDC reject http://vault…/oidc-signin HTTP 400
[PASS] 10 Headers Frontend vorhanden (HSTS, XFO, XCTO, CSP)
[PASS] 10 Headers API vorhanden
[PASS] 11 npm audit ohne critical/high — backend crit=0 high=0; frontend crit=0 high=0 mod=2 (postcss via next)
[PASS] SRP E2E Login (challenge→verify) erfolgreich
=== SUMMARY pass=16 fail=0 ===
```

**Nachzug 1.0:** Frontend `postcss` Override → `npm audit --omit=dev` = **0 vulnerabilities** (backend ebenfalls 0).

### 5.3 Gefundene Schwachstellen / Findings

| Schwere | Finding | Datei | Status |
|---------|---------|-------|--------|
| **kritisch** | SRP-N keine Primzahl (Null-Padding) | `srp.ts` | **Behoben** |
| **hoch** | SRP `challengeId` fälschlich als `b` | `auth.ts` / `srp.ts` | **Behoben** |
| **hoch** | Frontend Server-Proof mit Salt statt M | `frontend/.../srp.ts` | **Behoben** |
| **mittel** | „PQ“-Fallback war nur secp521r1 ECDH | `hybrid.ts` | **Behoben** (echte ML-KEM; Legacy ehrlich benannt) |
| **mittel** | Security-Header fehlten auf `/api/` (nginx location-Vererbung) | `nginx.conf.template` | **Behoben** (`add_header` auf `/api/`, `/oidc/`, `/`) |
| **niedrig** | Attachment-`id` ohne UUID-Whitelist | `attachment.ts` | **Behoben** |
| **niedrig** | Frontend `postcss` moderate (via `next`) | `frontend/web` | **Behoben** — `postcss@^8.5.10` + `overrides`; `npm audit --omit=dev` = 0 |
| **info** | osv-scanner nicht installiert | Host | Dokumentiert; npm audit ausgeführt |

### 5.4 Firewall & Netzwerk (Teil 3)

| # | Aufgabe | Ergebnis |
|---|---------|----------|
| 12 | Compose-`ports:` | Öffentlich: Nginx 80/443, Backend SMTP 2525, IMAP 2143. **Nicht** publiziert: Postgres, Immich-Postgres, Redis/Valkey, Immich-ML, Backend:3000, Frontend:3000, Vaultwarden:80, Immich:2283 |
| 13 | Host-Firewall-Skript | `infrastructure/scripts/setup-firewall.sh` (ufw Default-Deny; erlaubt 80/443/SMTP/IMAP/SSH) |
| 14 | Dokumentation | `docs/firewall.md` |

Wiederholen:

```bash
docker exec privmail-nginx nginx -s reload   # nach nginx.conf-Render
./scripts/e2e-srp-login.sh
./scripts/pentest-stack.sh
# optional Host: sudo ./infrastructure/scripts/setup-firewall.sh
```

---

## 6. PrivMail Suite 1.0.0 — Release-Schnitt (2026-07-21)

| Check | Ergebnis |
|-------|----------|
| `VERSION` / package.json backend+frontend | **1.0.0** |
| `CHANGELOG.md` + `docs/RELEASE.md` + `docs/release-checklist.md` | vorhanden |
| Frontend `npm audit --omit=dev` | **0 vulnerabilities** (`postcss@8.5.21` Override) |
| Backend `npm audit --omit=dev` | **0 vulnerabilities** |
| DKIM Keygen | `./infrastructure/scripts/setup-dkim.sh` → PEM + DNS-TXT (private PEM gitignored) |
| Unit: dkim-signer / dns-selfcheck / queue | **12/12 PASS** |
| Prod-Deploy-Probe (E2E Self-Signed) | **pass=11 fail=0 warn=1** (Warn = ALLOW_SELF_SIGNED) |
| Base `docker-compose.yml` TLS+DKIM | Backend startet ohne E2E-Overlay (`TLS_*` + ssl/dkim mounts) |

```
=== PrivMail 1.0 Prod-Deploy-Probe — privmail.test ===
[PASS] 1–8, 10–12 …
[WARN] 9 TLS: Self-Signed erlaubt (ALLOW_SELF_SIGNED=true)
=== SUMMARY pass=11 fail=0 warn=1 ===
```

Wiederholen:

```bash
DOMAIN=privmail.test ALLOW_SELF_SIGNED=true \
  CURL_EXTRA_ARGS="-k --resolve privmail.test:443:127.0.0.1 --resolve vault.privmail.test:443:127.0.0.1 --resolve photos.privmail.test:443:127.0.0.1" \
  ./scripts/prod-deploy-probe.sh
```

**Go-Live (echtes Prod):** DNS + `setup-ssl.sh` (ohne `ALLOW_SELF_SIGNED`) + DKIM-TXT beim Registrar + erneut `prod-deploy-probe.sh`.

