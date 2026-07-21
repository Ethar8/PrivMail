# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Niemals ein Issue für Sicherheitslücken im öffentlichen Issue-Tracker öffnen.**

Stattdessen: Sicherheitsrelevante Meldungen bitte per E-Mail an:

**security@ethartech.de**

PGP-Schlüssel für verschlüsselte Kommunikation:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(Wird bei Bedarf bereitgestellt)
-----END PGP PUBLIC KEY BLOCK-----
```

## Prozess

1. **Eingang**: Wir bestätigen den Eingang innerhalb von 48 Stunden.
2. **Analyse**: Das Team analysiert die Meldung und bestimmt Schweregrad und Umfang.
3. **Fix**: Ein Fix wird entwickelt und getestet – parallel zur Kommunikation mit dem Melder.
4. **Release**: Ein Sicherheits-Patch wird veröffentlicht. Schwere Lücken erhalten ein eigenes Advisory.
5. **Disclosure**: Nach der Veröffentlichung des Fixes stimmen wir die öffentliche Bekanntgabe mit dem Melder ab.

## Scope

Zum Scope gehören:

- Der PrivMail-Server (`backend/`)
- Das Webmail-Frontend (`frontend/`)
- SMTP/IMAP-Server-Implementierung
- Docker- und Nginx-Konfiguration
- Installations- und Deployment-Skripte

Nicht im Scope (Out-of-Scope):

- Bereits bekannte CVEs in Drittanbieter-Abhängigkeiten, die älter als 30 Tage sind
- Physische Angriffe auf den Server
- Social Engineering
- Denial-of-Service ohne konkreten Datenabfluss
- TLS-Versionen < 1.2

## Sichere Entwicklung

PrivMail folgt diesen Prinzipien:

1. **Zero-Trust**: Kein vertrauenswürdiges Netzwerk, alle Authentifizierung und Autorisierung wird serverseitig validiert.
2. **Fail-Closed**: Bei Ausfall von Sicherheitskomponenten (z. B. ClamAV) wird die unsicherere Aktion blockiert.
3. **No Plaintext**: In Produktion kein Fallback auf unverschlüsselte Übertragung – HTTPS/TLS ist Pflicht.
4. **Defense in Depth**: Mehrere Sicherheitsschichten (TLS, PGP E2EE, RFC 9788, CSP, CSRF, Rate-Limiting).

## Dependency Scanning

CI/CD führt automatisch aus:

- `npm audit --audit-level=high` (Backend + Frontend)
- `dependency-review-action` bei Pull Requests
- Empfehlung: `osv-scanner` lokal ausführen

```bash
npx osv-scanner --lockfile=backend/package-lock.json
npx osv-scanner --lockfile=frontend/web/package-lock.json
```

## Threat Model

Siehe `docs/security.md` für das vollständige Bedrohungsmodell.
