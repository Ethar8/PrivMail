# Konfiguration

## Umgebungsvariablen

Die Konfiguration erfolgt über Umgebungsvariablen in der `.env`-Datei (bzw. `.env.local` für das Frontend).

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `DOMAIN` | Domain der PrivMail-Instanz | `localhost` |
| `DB_USER` | PostgreSQL Benutzername | `privmail` |
| `DB_PASSWORD` | PostgreSQL Passwort | – |
| `DATABASE_URL` | PostgreSQL Verbindungs-URL | `postgresql://privmail:password@postgres:5432/privmail` |
| `JWT_SECRET` | Geheimnis für JWT-Tokens | – |
| `SESSION_SECRET` | Geheimnis für Sessions | – |
| `SMTP_PORT` | SMTP-Server Port | `2525` |
| `IMAP_PORT` | IMAP-Server Port | `2143` |
| `API_PORT` | REST API Port | `3000` |
| `HTTP_PORT` | Webmail HTTP Port (Docker gemappt) | `8080` |
| `DOMAIN` | Primäre Domain der Instanz (OIDC-Issuer-Basis) | – (Setup-Wizard) |
| `VAULT_HOST` | Öffentlicher Hostname für Vaultwarden | `vault.$DOMAIN` |
| `PHOTOS_HOST` | Öffentlicher Hostname für Immich | `photos.$DOMAIN` |
| `OIDC_ISSUER` | OIDC Issuer-URL | `https://$DOMAIN` |
| `CORS_ORIGINS` | Erlaubte Origins | aus Domain+Hosts abgeleitet |
| `OIDC_VAULTWARDEN_CLIENT_ID` | OIDC-Client für Vaultwarden | `vaultwarden` |
| `OIDC_VAULTWARDEN_CLIENT_SECRET` | Client-Secret (automatisch generiert) | – |
| `OIDC_IMMICH_CLIENT_ID` | OIDC-Client für Immich | `immich` |
| `OIDC_IMMICH_CLIENT_SECRET` | Client-Secret (automatisch generiert) | – |
| `DKIM_SELECTOR` | DKIM-Selektor (DNS-Label) | `privmail` |
| `DKIM_PRIVATE_KEY_PATH` | Pfad zum privaten DKIM-PEM im Container | leer = keine Signierung |

Secrets und Host-Ableitungen: `./scripts/setup-wizard.sh` / `./scripts/generate-secrets.sh`.  
DKIM-Schlüssel: `./infrastructure/scripts/setup-dkim.sh <domain>`.  
Nginx: `./scripts/render-nginx.sh` aus `infrastructure/nginx/nginx.conf.template`.

Suite-SSO: siehe [Suite SSO](sso.md).

## Ports & DNS

### Verwendete Ports (Produktion)

| Port | Dienst | Protokoll |
|------|--------|-----------|
| 80 | Nginx HTTP → HTTPS-Redirect | TCP |
| 443 | Nginx HTTPS (Webmail, API, Vault, Photos) | TCP |
| 2525 (oder 25/587) | SMTP | TCP |
| 2143 (oder 993) | IMAP | TCP |

Backend-API (3000) und Frontend (3000) sind **nur intern** im Docker-Netz erreichbar.

### Empfohlene DNS-Einträge

```
A/AAAA  mail.example.com            → <Server-IP>
A/AAAA  vault.mail.example.com      → <Server-IP>
A/AAAA  photos.mail.example.com     → <Server-IP>
MX      example.com                 → mail.example.com  (Priorität 10)
TXT     example.com                 → v=spf1 mx a ip4:<Server-IP> -all
TXT     privmail._domainkey…        → v=DKIM1; k=rsa; p=…   (aus setup-dkim.sh)
TXT     _dmarc.example.com          → v=DMARC1; p=quarantine; rua=mailto:dmarc@…
PTR     <Server-IP>                 → mail.example.com
```

Hilfsskript: `./infrastructure/scripts/setup-dns.sh <domain> <server-ip>`.  
Siehe [Sicherheit](security.md) und [Firewall](firewall.md).

## Datenverzeichnisse

Alle persistenten Daten werden im `data/`-Verzeichnis gespeichert:

```
data/
├── postgres/      – PrivMail PostgreSQL
├── mail/          – E-Mail-Spool (Maildir)
├── queue/         – SMTP-Warteschlange
├── vaultwarden/   – Vaultwarden-Daten
├── immich/        – Immich Library + Immich-Postgres
└── logs/          – Server-Logs
```

TLS-Zertifikat muss `vault.<DOMAIN>` und `photos.<DOMAIN>` abdecken (Wildcard oder SAN). Details: [Suite SSO](sso.md).

## TLS / Nginx

Produktivinstallationen betreiben Nginx als TLS-Terminator (Port 80 → HTTPS). Die SMTP- und IMAP-Ports können optional mit STARTTLS konfiguriert werden. Siehe `infrastructure/nginx/nginx.conf`.
