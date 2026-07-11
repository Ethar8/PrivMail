# PrivMail

Eine vollständige, produktionsreife, quelloffene E-Mail-Plattform mit
Ende-zu-Ende-Verschlüsselung, verschlüsselten Headern (RFC 9788), Offline-Modus,
lokaler Volltextsuche und eigenem SMTP-/IMAP-Server – komplett selbst geschrieben
in TypeScript. Keine Forks, kein Postfix, kein Dovecot, kein Stalwart.

> **Status:** In aktiver Entwicklung. Das Gerüst und die Kernkomponenten sind
> implementiert; einzelne Features werden iterativ vervollständigt und getestet.

## Features

| Nr. | Feature | Beschreibung |
|-----|---------|--------------|
| 1 | **E2EE (OpenPGP)** | Client-seitige Ver- und Entschlüsselung mit OpenPGP.js. |
| 2 | **RFC 9788** | Header-Verschlüsselung (Betreff, Absender, Empfänger). |
| 3 | **Offline-Modus** | Lokale Speicherung in SQLite (WASM + OPFS). |
| 4 | **Lokale Volltextsuche** | FTS5-basierte Suche – der Server sieht die Anfrage nie. |
| 5 | **1-Click-Installation** | Docker-Compose + `install.sh`. |
| 6 | **Spam- & Tracking-Schutz** | Bayes, Blacklist, URL-Prüfung, Tracking-Pixel-Entfernung. |
| 7 | **KI-Assistent** | Eigene OpenAI-API oder lokales LLM (Ollama). |
| 8 | **2FA mit YubiKey** | WebAuthn/FIDO2. |
| 9 | **Modernes Webdesign** | Next.js 15 + TailwindCSS + Shadcn UI, Dark/Light Mode. |
| 10 | **Kalender & Kontakte** | Verschlüsselter Kalender und Adressbuch. |
| 11 | **Admin-Panel** | Web-UI für Nutzer-, Domänen- und Systemverwaltung. |
| 12 | **Eigener SMTP/IMAP-Server** | Komplett selbst geschrieben in Node.js/TypeScript. |

## Technologie-Stack

- **Backend:** Node.js 22 + Express + TypeScript
- **Frontend:** Next.js 15 + React + TypeScript
- **Styling:** TailwindCSS + Shadcn UI
- **DB (Server):** PostgreSQL 16
- **DB (Client):** SQLite (WASM) + OPFS
- **Krypto:** OpenPGP.js
- **Container:** Docker + Docker Compose
- **Tests:** Jest + Supertest

## Schnellstart

```bash
git clone <repo-url> privmail
cd privmail
./install.sh
```

Danach:

- Web-UI: <http://localhost:8080>
- Ersten Nutzer anlegen: <http://localhost:8080/setup>
- SMTP: `localhost:2525`
- IMAP: `localhost:2143`

## Dokumentation

Siehe [`docs/`](./docs):

- [Installation](./docs/installation.md)
- [Konfiguration](./docs/configuration.md)
- [API-Referenz](./docs/api-reference.md)
- [Sicherheit](./docs/security.md)
- [RFC 9788](./docs/rfc9788.md)
- [FAQ](./docs/faq.md)

## Lizenz

[MIT](./LICENSE)

## Eigentümer

Dieses Projekt gehört [ethartech](https://ethartech.de/). Alle Rechte an Marke
und Code liegen beim Eigentümer.
