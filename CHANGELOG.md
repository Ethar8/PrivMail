# Changelog

Alle bemerkenswerten Änderungen an PrivMail Suite.

## [1.0.0] — 2026-07-21

Erstes stabiles Produktions-Release der **PrivMail Suite** (Mail + OIDC-IdP + Vaultwarden + Immich).

### Highlights
- PrivMail als OpenID Connect Provider (`oidc-provider`) für Vaultwarden und Immich (PKCE Pflicht)
- Setup-Wizard / `install.sh` für Domain, Secrets, Nginx-Template, Compose
- SRP-6a Login (RFC 5054 2048-bit Gruppe) inkl. Challenge/Verify-Cache
- Hybridverschlüsselung: OpenPGP + echte ML-KEM-768 (`@noble/post-quantum`)
- Security: CSRF, TLS-Guard, Rate-Limits, VRFY/EXPN off, Attachment-Path-Härtung
- Mail: Inbound SPF/DKIM/DMARC-Checks, optionale Outbound-DKIM-Signierung
- Operator: Firewall-Skript, DNS-/SSL-/DKIM-Hilfen, Prod-Deploy-Probe

### Sicherheit (getestet)
- Container-SSO-E2E gegen echte Vaultwarden-/Immich-Login-Flows
- Penetrationstest gegen lokalen Compose-Stack (XSS, CSRF, Injection, Brute-Force, OIDC-Redirects, Header)
- Details: `TEST-RESULTS.md`, `SECURITY-FIXES.md`

### Breaking / Operator-Hinweise
- Produktion erfordert gültiges TLS (`setup-ssl.sh`) und starke Secrets (`generate-secrets.sh`)
- Ausgehende DKIM-Signierung: `./infrastructure/scripts/setup-dkim.sh` + DNS-TXT
- Immich OAuth: `autoRegister=false` — Nutzer manuell verknüpfen
- Frontend: `postcss` auf `^8.5.10` gepinnt (`overrides`) — `npm audit --omit=dev` = 0 Vulnerabilities

### Migration
- Datenbank-Migrationen bis `011_oidc_provider.sql` werden beim Backend-Start angewendet
- Bestehende Installationen: `.env` um `OIDC_*`, `VAULT_HOST`, `PHOTOS_HOST`, optional `DKIM_*` ergänzen und Nginx neu rendern

[1.0.0]: https://github.com/ethar-dev/PrivMail/releases/tag/v1.0.0
