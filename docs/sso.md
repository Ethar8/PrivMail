# PrivMail Suite – SSO (OIDC) für Vaultwarden & Immich

PrivMail ist der zentrale OpenID-Connect-Identity-Provider für das Zuhause-Ökosystem.
Die Implementierung nutzt ausschließlich **`oidc-provider`** (node-oidc-provider) –
keine eigene Token-/Signatur-/PKCE-Logik.

## Architektur

| Dienst | Rolle | URL (Beispiel) |
|--------|--------|----------------|
| PrivMail | E-Mail + OIDC IdP | `https://mail.example.com` |
| Vaultwarden | Passwort-Manager (offizielles Image) | `https://vault.mail.example.com` |
| Immich | Fotos/Videos (offizielles Image) | `https://photos.mail.example.com` |

- **Issuer:** `https://<DOMAIN>` (env `OIDC_ISSUER`)
- **Discovery:** `https://<DOMAIN>/.well-known/openid-configuration`
- **Protokoll-Endpunkte:** unter `/oidc/*` (Auth, Token, UserInfo, JWKS, …)
- **Login-UI:** bestehende PrivMail-Seite `/login` (inkl. SRP/WebAuthn) – keine zweite Login-Oberfläche

TLS: Alle Subdomains laufen ausschließlich über HTTPS (Nginx Port 80 → 443). Zertifikat muss die Subdomains abdecken (Wildcard oder SAN).

---

## Phase 1 – PrivMail als OIDC-Provider

### Funktionstest

1. Backend starten (Migration `011_oidc_provider.sql` wird angewendet).
2. `curl -sf https://<DOMAIN>/.well-known/openid-configuration | jq .issuer` → Issuer-URL.
3. Admin → **OIDC-Clients**: Vaultwarden- und Immich-Clients sind nach Seed vorhanden (Secrets aus `.env` bzw. einmalig generiert).
4. PKCE ist serverseitig erzwungen (`pkce.required = true`, Methode `S256`).

### Umgebungsvariablen

```bash
OIDC_ISSUER=https://mail.example.com
OIDC_VAULTWARDEN_CLIENT_ID=vaultwarden
OIDC_VAULTWARDEN_CLIENT_SECRET=<langes-geheimnis>
OIDC_IMMICH_CLIENT_ID=immich
OIDC_IMMICH_CLIENT_SECRET=<langes-geheimnis>
```

Admin-UI: `/admin/oidc-clients`

---

## Phase 2 – Vaultwarden

Image: `vaultwarden/server:latest` (Stand Doku 2026; Tags auf Docker Hub prüfen).

SSO-Variablen (gegen [Vaultwarden `.env.template`](https://github.com/dani-garcia/vaultwarden/blob/main/.env.template) verifiziert):

| Variable | Wert |
|----------|------|
| `SSO_ENABLED` | `true` |
| `SSO_AUTHORITY` | `https://<DOMAIN>` (ohne `/.well-known/…`, ohne trailing `/`) |
| `SSO_CLIENT_ID` | wie `OIDC_VAULTWARDEN_CLIENT_ID` |
| `SSO_CLIENT_SECRET` | wie `OIDC_VAULTWARDEN_CLIENT_SECRET` |
| `SSO_PKCE` | `true` |
| `SSO_SCOPES` | `openid profile email` |
| `DOMAIN` | `https://vault.<DOMAIN>` |

Redirect-URI (bei PrivMail registriert):  
`https://vault.<DOMAIN>/identity/connect/oidc-signin`

### Wichtig: Master-Passwort

**SSO ersetzt nur den Account-Login, nicht das Vaultwarden-Master-Passwort.**

Nach erfolgreicher OIDC-Anmeldung fragt Vaultwarden weiterhin das Master-Passwort ab.
Das ist so vorgesehen: Aus dem Master-Passwort wird der Verschlüsselungsschlüssel des Tresors abgeleitet.
Ohne Master-Passwort könnte der Server (oder der IdP) den Tresorinhalt nicht entschlüsseln –
Zero-Knowledge bleibt erhalten. Das ist **kein Bug**.

### Funktionstest

1. `https://vault.<DOMAIN>` öffnen → „Enterprise SSO“ / SSO-Login.
2. Redirect zu PrivMail-Login → mit PrivMail-Konto anmelden.
3. Zurück bei Vaultwarden → **Master-Passwort** eingeben → Tresor öffnet sich.

---

## Phase 3 – Immich

Images laut [offizieller Compose-Doku](https://docs.immich.app/install/docker-compose):  
`ghcr.io/immich-app/immich-server`, `immich-machine-learning`, Valkey/Redis, Immich-Postgres.

OAuth wird in der Immich-Admin-UI konfiguriert (nicht primär per Env – Immich entfernt Env-OAuth zugunsten der UI):

1. Als Immich-Admin: **Administration → Settings → OAuth Authentication**
2. Issuer URL: `https://<DOMAIN>/.well-known/openid-configuration` (oder Issuer-Basis je nach Immich-Feld)
3. Client ID / Secret: Immich-Client aus PrivMail
4. Scope: `openid profile email`
5. Redirect-URIs bei PrivMail:
   - `https://photos.<DOMAIN>/auth/login`
   - `https://photos.<DOMAIN>/user-settings`
   - `app.immich:///oauth-callback`
   - optional: `https://photos.<DOMAIN>/api/oauth/mobile-redirect`
6. **Auto Register: deaktiviert** – wird von `scripts/configure-immich-oauth.sh` gesetzt (`autoRegister: false`)
7. Mobile: Immich „Mobile Redirect URI Override“ auf  
   `https://photos.<DOMAIN>/api/oauth/mobile-redirect`  
   (Custom-Scheme `app.immich://…` wird am PrivMail-Web-Client nicht registriert, damit der OIDC-Client gültig bleibt)

### Automatisierung

```bash
./scripts/configure-immich-oauth.sh \
  --immich-url https://photos.<DOMAIN> \
  --issuer https://<DOMAIN> \
  --client-id immich \
  --client-secret "$OIDC_IMMICH_CLIENT_SECRET" \
  --admin-email admin@<DOMAIN> \
  --admin-password '…'
```

### Funktionstest

1. Immich-Login → „Login with OAuth“.
2. PrivMail-Login → Rückkehr zu Immich.
3. Nutzer ohne vorherige Immich-Freischaltung wird **nicht** automatisch angelegt.

---

## Phase 4 – Dashboard & Health

- Apps-Übersicht: `/dashboard/apps` – echte Links zu Mail / Vault / Photos (kein iframe).
- Admin-Status: OIDC-Discovery, letzter erfolgreicher SSO-Login, Vaultwarden `/alive`, Immich `/api/server/ping`.

### Funktionstest

1. Als Nutzer `/dashboard/apps` öffnen – Kacheln verlinken korrekt.
2. Als Admin Systemstatus: Suite-Zeile zeigt erreichbar/nicht erreichbar.
