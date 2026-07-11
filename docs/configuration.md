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
| `NEXT_PUBLIC_API_URL` | API-URL für das Frontend | `http://localhost:3000` |

## Ports & DNS

### Verwendete Ports

| Port | Dienst | Protokoll |
|------|--------|-----------|
| 2525 | SMTP (eingehend/ausgehend) | TCP |
| 2143 | IMAP | TCP |
| 3000 | REST API (intern) | TCP |
| 8080 | Webmail HTTP | TCP |

### Empfohlene DNS-Einträge

```
A     mail.example.com     → <Server-IP>
MX    example.com          → mail.example.com  (Priorität 10)
TXT   example.com          → v=spf1 mx a ip4:<Server-IP> -all
TXT   selector._domainkey.example.com → (DKIM-Schlüssel)
TXT   _dmarc.example.com   → v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
PTR   <Server-IP>          → mail.example.com
```

Siehe [Sicherheit](security.md) für vollständige DNS-Beispiele.

## Datenverzeichnisse

Alle persistenten Daten werden im `data/`-Verzeichnis gespeichert:

```
data/
├── postgres/   – PostgreSQL-Datenbank
├── mail/       – E-Mail-Spool (Maildir)
├── queue/      – SMTP-Warteschlange
└── logs/       – Server-Logs

## TLS / Nginx

Produktivinstallationen sollten einen Reverse-Proxy (z. B. Nginx mit Let's Encrypt) vor dem Webmail-Frontend betreiben. Die SMTP- und IMAP-Ports können optional mit STARTTLS konfiguriert werden.
