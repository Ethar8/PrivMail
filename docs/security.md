# Sicherheit

## Bedrohungsmodell

PrivMail minimiert die serverseitig sichtbaren Daten:

- **E-Mail-Körper** werden Ende-zu-Ende mit OpenPGP verschlüsselt. Der Server sieht nur verschlüsselte Daten.
- **Header (Betreff, Von, An)** werden gemäß RFC 9788 mit dem öffentlichen Schlüssel des Empfängers geschützt. Der Server sieht nur den verschleierten äußeren Betreff `[...]`.
- **Suchanfragen** laufen vollständig client-seitig über SQLite WASM + FTS5. Der Server erhält keine Suchdaten.
- **AI-Anfragen** gehen direkt vom Browser an den konfigurierten Provider. Der Server ist nicht involviert.

Der Server speichert folgende Daten im Klartext:
- Benutzerkonten (E-Mail, Passwort-Hash, öffentlicher OpenPGP-Schlüssel)
- Domain-Konfiguration
- SMTP-Kommunikationsmetadaten (Absender, Empfänger, IP, Zeitstempel)

## TLS / Nginx

Für den Produktivbetrieb wird empfohlen, einen Reverse-Proxy mit TLS vorzuschalten:

- Nginx oder Caddy mit Let's Encrypt für HTTPS (Port 443)
- SMTP und IMAP können mit STARTTLS betrieben werden
- Interne Dienste laufen ohne TLS innerhalb des Docker-Netzwerks

## E-Mail-Auth DNS-Einträge

Für eine zuverlässige E-Mail-Zustellung sind folgende DNS-Einträge erforderlich:

### SPF (Sender Policy Framework)

```
TXT  example.com  →  v=spf1 mx a ip4:203.0.113.10 -all
```

Erläuterung:
- `mx` – Mailserver der Domain sind berechtigt
- `a` – A-Record der Domain ist berechtigt
- `ip4:203.0.113.10` – Explizite Server-IP (durch eigene IP ersetzen)
- `-all` – Alle anderen Quellen sind nicht berechtigt (strict fail)

### DKIM (DomainKeys Identified Mail)

```
TXT  selector._domainkey.example.com  →  v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg...
```

- `selector` – Ein beliebiger, selbst gewählter Selektor-Name
- `p=` – Der öffentliche DKIM-Schlüssel (Base64-kodiert)
- Der private Schlüssel wird vom SMTP-Server zum Signieren verwendet

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

```
TXT  _dmarc.example.com  →  v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
```

Erläuterung:
- `p=quarantine` – Nicht authentifizierte E-Mails in Spam verschieben
- `rua=mailto:...` – Aggregierte Berichte an diese Adresse senden
- Alternativ: `p=reject` für strikte Ablehnung

### MX (Mail Exchange)

```
MX  example.com  →  mail.example.com  10
```

### PTR / Reverse DNS

Der Server-Provider muss einen PTR-Eintrag für die Server-IP setzen:

```
PTR  203.0.113.10  →  mail.example.com
```

Dies ist entscheidend für die Zustellbarkeit bei vielen E-Mail-Providern.

## WebAuthn / YubiKey 2FA

PrivMail unterstützt Zwei-Faktor-Authentifizierung über WebAuthn:

- Registrierung von YubiKeys und anderen FIDO2/WebAuthn-kompatiblen Geräten
- Login mit Passwort + WebAuthn (oder Passwort-only, falls konfiguriert)
- Geräte werden in `Settings > Sicherheit` verwaltet

## Spam- & Tracking-Schutz

| Schutzmaßnahme | Beschreibung |
|---------------|-------------|
| SPF-Prüfung | Eingehende E-Mails werden auf gültige SPF-Einträge geprüft |
| DKIM-Prüfung | DKIM-Signaturen eingehender E-Mails werden validiert |
| DMARC-Prüfung | DMARC-Policies werden ausgewertet |
| Bayes-Klassifikator | Naive-Bayes-Modell zur Spam-Erkennung |
| Blacklist/Whitelist | Manuelle Sperr- und Freigabelisten |
| Tracking-Pixel | Automatische Erkennung und Entfernung von Tracking-Pixeln |
| Phishing-URLs | Heuristische Erkennung verdächtiger Links |

Siehe [Spam-Filter](spam-filter.md) für Details.
