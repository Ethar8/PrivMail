# PrivMail Suite 1.0.0 — Release Notes

**Tag:** `v1.0.0`  
**Datum:** 2026-07-21  
**Status:** Stabiles Produktions-Release (self-hosted)

## Was ist enthalten

- Eigener SMTP/IMAP-Stack mit OpenPGP / RFC 9788
- OIDC-IdP für Vaultwarden + Immich (PKCE)
- Setup-Wizard, Nginx-Template, Secrets-Generator
- SRP-Login, CSRF, Rate-Limits, TLS-Guard
- Hybrid OpenPGP + ML-KEM-768
- Operator-Tools: SSL, DNS, DKIM, Firewall, Prod-Deploy-Probe

## Upgrade / Neuinstallation

Siehe [docs/installation.md](docs/installation.md) und [CHANGELOG.md](CHANGELOG.md).

## Bekannte Einschränkungen

1. **DKIM** — Signierung ist aktiv, sobald Schlüssel + DNS gesetzt sind (`setup-dkim.sh`). Ohne Schlüssel wird Mail unsigniert zugestellt (Inbound-Checks laufen trotzdem).
2. **Immich `autoRegister=false`** — OAuth-Nutzer müssen existieren bzw. verknüpft werden.
3. **Vaultwarden** — nach SSO weiterhin Master-Passwort (Zero-Knowledge, by design).
4. **Mail-Reputation / Port 25** — Zustellbarkeit zu großen Providern hängt vom Server-IP-Ruf und DNS (SPF/DKIM/DMARC) ab; Lab-E2E ersetzt keinen Production-MTA-Check.

## Verifikation vor Go-Live

```bash
./scripts/prod-deploy-probe.sh
# optional lokal:
./scripts/pentest-stack.sh
./scripts/e2e-container-sso.sh
```

## Support / Security

- Schwachstellen: [SECURITY.md](SECURITY.md)
- Status früherer Fixes: [SECURITY-FIXES.md](SECURITY-FIXES.md)
