# PrivMail – Dokumentation

PrivMail ist eine selbstgehostete, Ende-zu-Ende-verschlüsselte E-Mail-Plattform mit eigenen SMTP- und IMAP-Servern, OpenPGP-basierter Verschlüsselung und modernem Webmail-Frontend.

## Funktionen im Überblick

| Bereich | Funktion |
|---------|----------|
| **E-Mail** | Eigener SMTP-Server (Port 2525) und IMAP-Server (Port 2143) |
| **Verschlüsselung** | Ende-zu-Ende-Verschlüsselung mit OpenPGP, RFC 9788 Header-Verschlüsselung |
| **Frontend** | Next.js 15 Webmail auf Port 8080 |
| **Offline-Modus** | SQLite WASM + OPFS für lokalen Cache und private Volltextsuche |
| **Suche** | Client-seitige FTS5-Volltextsuche (Server sieht keine Suchanfragen) |
| **Spam-Schutz** | Naive-Bayes-Klassifikator, Tracking-Pixel-Erkennung, SPF/DKIM/DMARC-Prüfung |
| **AI-Assistent** | Zusammenfassungen und Antwortvorschläge über OpenAI, Ollama oder kompatible Endpunkte |
| **2FA** | WebAuthn / YubiKey Unterstützung |
| **1-Klick-Installation** | Docker Compose Setup via `install.sh` |
| **PostgreSQL 16** | Serverseitige Datenhaltung |

## Dokumentationsübersicht

| Seite | Inhalt |
|-------|--------|
| [Installation](installation.md) | Voraussetzungen, 1-Klick-Installation, Dev-Setup, Deinstallation |
| [Konfiguration](configuration.md) | Umgebungsvariablen, Ports, DNS, Datenverzeichnisse |
| [Admin-Guide](admin-guide.md) | Benutzerverwaltung, Domain-Management, Systemstatus |
| [Benutzerhandbuch](user-guide.md) | Webmail-Nutzung: Postfächer, Verfassen, Suche, Offline-Modus |
| [API-Referenz](api-reference.md) | Vollständige REST-API Dokumentation |
| [Sicherheit](security.md) | Bedrohungsmodell, TLS, DNS-Einträge, WebAuthn, Spam-Schutz |
| [RFC 9788](rfc9788.md) | Header-Verschlüsselung nach RFC 9788 |
| [Spam-Filter](spam-filter.md) | Funktionsweise des Spam-Filters |
| [AI-Assistent](ai-assistant.md) | Konfiguration und Nutzung des AI-Assistenten |
| [FAQ](faq.md) | Häufig gestellte Fragen |

## Lizenz

PrivMail ist unter der MIT-Lizenz veröffentlicht.

## Projekt-Links

- GitHub: [https://github.com/ethartech/privmail](https://github.com/ethartech/privmail)
- Website: [https://ethartech.de/](https://ethartech.de/)
