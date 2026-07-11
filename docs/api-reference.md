# API-Referenz

Basis-URL: `http://localhost:3000/api`

Authentifizierung: JWT Bearer Token im `Authorization`-Header.

## Auth

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/auth/setup-required` | Prüft, ob ein Setup erforderlich ist |
| `POST` | `/auth/setup` | Ersten Admin-Benutzer einrichten |
| `POST` | `/auth/register` | Neuen Benutzer registrieren |
| `POST` | `/auth/login` | Benutzer-Login (E-Mail + Passwort) |
| `GET` | `/auth/me` | Aktuellen Benutzer abrufen |

## WebAuthn

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/auth/webauthn/register` | WebAuthn-Registrierung starten |
| `POST` | `/auth/webauthn/verify` | WebAuthn-Registrierung bestätigen |
| `POST` | `/auth/webauthn/login` | WebAuthn-Login starten |
| `POST` | `/auth/webauthn/verify-login` | WebAuthn-Login bestätigen |

## Mail

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/mail/mailboxes` | Postfächer/Ordner auflisten |
| `GET` | `/mail/list?mailbox=INBOX&page=1` | E-Mails eines Postfachs auflisten |
| `GET` | `/mail/get?id=<id>` | Einzelne E-Mail abrufen |
| `PATCH` | `/mail/read` | E-Mail als gelesen markieren |
| `DELETE` | `/mail/delete?id=<id>` | E-Mail löschen |
| `POST` | `/mail/send` | E-Mail senden |
| `POST` | `/mail/move` | E-Mail in anderen Ordner verschieben |

## Search

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/search/info` | Such-Index-Informationen |

> **Hinweis:** Die eigentliche Suche läuft client-seitig im Browser (SQLite WASM + FTS5). Die API dient nur zum Abruf von Metadaten.

## AI

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/ai/providers` | Verfügbare AI-Provider abrufen |

> **Hinweis:** AI-Anfragen werden direkt vom Browser an den konfigurierten Provider gesendet. Der Server ist nicht involviert.

## Admin

Erfordert Admin-Rolle.

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/admin/users` | Benutzerliste abrufen |
| `POST` | `/admin/users` | Benutzer erstellen |
| `PATCH` | `/admin/users/:id` | Benutzer bearbeiten |
| `DELETE` | `/admin/users/:id` | Benutzer löschen |
| `GET` | `/admin/domains` | Domains auflisten |
| `POST` | `/admin/domains` | Domain hinzufügen |
| `DELETE` | `/admin/domains/:id` | Domain entfernen |
| `GET` | `/admin/status` | Systemstatus abrufen |

## Calendar & Contacts

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/calendar` | Kalendereinträge abrufen |
| `POST` | `/calendar` | Kalendereintrag erstellen |
| `PATCH` | `/calendar/:id` | Kalendereintrag bearbeiten |
| `DELETE` | `/calendar/:id` | Kalendereintrag löschen |
| `GET` | `/contacts` | Kontakte auflisten |
| `POST` | `/contacts` | Kontakt erstellen |
| `PATCH` | `/contacts/:id` | Kontakt bearbeiten |
| `DELETE` | `/contacts/:id` | Kontakt löschen |

## Settings

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/settings` | Benutzereinstellungen abrufen |
| `PATCH` | `/settings` | Benutzereinstellungen aktualisieren |
| `GET` | `/settings/keys` | OpenPGP-Schlüssel abrufen |
| `POST` | `/settings/keys` | OpenPGP-Schlüssel generieren/importieren |
| `GET` | `/settings/sessions` | Aktive Sessions auflisten |
| `DELETE` | `/settings/sessions/:id` | Session beenden |
| `PATCH` | `/settings/password` | Passwort ändern |
