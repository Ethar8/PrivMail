# PrivMail Suite **1.0.0**

Selbst gehostete E-Mail-Plattform mit zentralem Login (OIDC) für **Vaultwarden** (Passwörter)
und **Immich** (Fotos). Jeder Betreiber betreibt eine **eigene, unabhängige** Instanz —
mit eigener Domain, eigenen Secrets und ohne Abhängigkeit von der Infrastruktur eines anderen
Betreibers.

Release-Notes: [`docs/RELEASE.md`](docs/RELEASE.md) · Changelog: [`CHANGELOG.md`](CHANGELOG.md) · Version: `VERSION`

Kein zentrales Anthropic-/Cursor-/Cloud-Konto ist erforderlich. Optionale Cloud-KI ist nur
ein vom Betreiber gewählter Zusatz.

> **Hinweis für Installationen durch andere:** Der Code ist **produktionsreif vorbereitet**
> (Release 1.0). Zertifikate (Let’s Encrypt) und DNS-Einträge kann dieses Repo **nicht**
> mitliefern — jeder Betreiber braucht **eigene** Domain, DNS und TLS auf **seinem** Server.
> Schnellstart unten sowie [`./scripts/prod-deploy-probe.sh`](scripts/prod-deploy-probe.sh)
> führen dich durch die nötigen Schritte und prüfen, ob die Instanz go-live-tauglich ist.
> Details: [`docs/installation.md`](docs/installation.md), [`docs/RELEASE.md`](docs/RELEASE.md).

## Voraussetzungen

- Linux-Server (oder vergleichbar) mit **Docker** + **Docker Compose**
- Eine Domain, die **du** kontrollierst
- Offene Ports **80/443** (HTTPS) sowie SMTP/IMAP nach Bedarf (`2525`/`2143` oder 25/143 hinter Firewall)
- Für öffentliches TLS: DNS zeigt bereits auf diesen Server (siehe unten)

## Schnellstart

```bash
git clone <repo-url> privmail-suite
cd privmail-suite

# 1) Deine Domain & Hosts eintragen (Secrets werden automatisch erzeugt)
./scripts/setup-wizard.sh
# oder nicht-interaktiv:
# ./scripts/setup-wizard.sh --domain mail.example.org --yes

# 2) Stack starten
./install.sh

# 3) Nach gesetztem DNS: Zertifikat holen
./infrastructure/scripts/setup-ssl.sh mail.example.org

# 4) DKIM + DNS-Hinweise
./infrastructure/scripts/setup-dkim.sh mail.example.org
./infrastructure/scripts/setup-dns.sh mail.example.org <DEINE-SERVER-IP>

# 5) Optional: Host-Firewall
sudo ./infrastructure/scripts/setup-firewall.sh

# 6) Produktions-Probe
DOMAIN=mail.example.org ./scripts/prod-deploy-probe.sh

# 7) Admin-Konto im Browser
# https://mail.example.org/setup
```

Ersetze `mail.example.org` überall durch **deine** Domain.

## DNS-Einträge, die DU selbst bei deinem Domain-Anbieter setzen musst

Niemand außer dir kann Records bei deinem Registrar anlegen. Typisches Minimum für die Suite:

| Typ | Name / Host | Ziel |
|-----|-------------|------|
| A oder AAAA | `<DEINE-DOMAIN>` | `<DEINE-SERVER-IP>` |
| A oder AAAA | `vault.<DEINE-DOMAIN>` *oder dein gewählter Vault-Host* | `<DEINE-SERVER-IP>` |
| A oder AAAA | `photos.<DEINE-DOMAIN>` *oder dein gewählter Photos-Host* | `<DEINE-SERVER-IP>` |

Vorschläge `vault.` / `photos.` sind nur Defaults im Wizard — du kannst andere Hostnamen wählen.

Zusätzlich für **Mail-Zustellung** (nicht für reines SSO nötig): MX, SPF, DKIM, DMARC, PTR —
Details in [`docs/security.md`](docs/security.md).

Hilfstext erzeugen:

```bash
./infrastructure/scripts/setup-dns.sh <DEINE-DOMAIN> <DEINE-SERVER-IP>
```

## Was der Setup-Wizard für dich erledigt

- schreibt `.env` (Domain, Vault-/Photos-Hosts, CORS, App-URLs)
- generiert kryptografisch starke Secrets (JWT, OIDC-Client-Secrets, DB-Passwörter, …)
- erzeugt `infrastructure/nginx/nginx.conf` aus `nginx.conf.template` (keine feste Domain im Repo)
- Migrationen laufen automatisch beim Backend-Start

## Unabhängigkeit der Instanz

- Keine geteilte Datenbank oder geteiltes Login mit anderen PrivMail-Installationen
- OIDC-Issuer ist immer `https://<DEINE-DOMAIN>` (bzw. `OIDC_ISSUER` in `.env`)
- Vaultwarden- und Immich-Container gehören zu **deiner** Compose-Umgebung

## Dokumentation

| Dokument | Inhalt |
|----------|--------|
| [Installation](docs/installation.md) | Details zur Installation |
| [Konfiguration](docs/configuration.md) | Umgebungsvariablen |
| [Suite SSO](docs/sso.md) | OIDC, Vaultwarden, Immich |
| [Sicherheit](docs/security.md) | TLS, DNS-Mail, Threat Model |
| [TEST-RESULTS.md](TEST-RESULTS.md) | Nachweisbarer SSO-E2E-Lauf |

## Troubleshooting

### Zertifikat wird nicht ausgestellt

Häufigste Ursache: DNS zeigt noch nicht (oder nicht überall) auf den Server. Prüfe:

```bash
dig +short <DEINE-DOMAIN>
dig +short vault.<DEINE-DOMAIN>
dig +short photos.<DEINE-DOMAIN>
```

Alle müssen deine Server-IP liefern. Port 80 muss für certbot erreichbar sein (`setup-ssl.sh` nutzt standalone).

### SSO schlägt fehl (Redirect-URI)

Häufigste Ursache: **Redirect-URI-Mismatch**. Die bei PrivMail registrierten URIs müssen exakt zu Vaultwarden/Immich passen, z. B.:

- Vaultwarden: `https://<VAULT-HOST>/identity/connect/oidc-signin`
- Immich: `https://<PHOTOS-HOST>/auth/login` (+ `user-settings`, optional mobile-redirect)

Hosts in `.env` (`VAULT_HOST`, `PHOTOS_HOST`) und in der Immich-Admin-OAuth-Konfiguration müssen übereinstimmen. Nach Host-Änderung: Secrets/Seed bzw. Admin → OIDC-Clients prüfen und Stack neu starten.

### Immich OAuth automatisch setzen

```bash
./scripts/configure-immich-oauth.sh \
  --immich-url "https://$PHOTOS_HOST" \
  --issuer "https://$DOMAIN" \
  --client-secret "$OIDC_IMMICH_CLIENT_SECRET" \
  --admin-email "admin@$DOMAIN" \
  --admin-password '…'
```

(`autoRegister` bleibt deaktiviert.)

## Lizenz

[MIT](./LICENSE)
