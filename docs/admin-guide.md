# Admin-Guide

Das Admin-Panel ist unter **Einstellungen > Administration** erreichbar (nur für Benutzer mit Admin-Rolle).

## Benutzerverwaltung

### Benutzer erstellen

1. Im Admin-Panel auf **Benutzer** navigieren.
2. Auf **Neuen Benutzer** klicken.
3. E-Mail-Adresse, Passwort und optionale Rolle vergeben.
4. Der Benutzer erhält automatisch eine Willkommens-E-Mail mit Login-Informationen.

### Admin-Berechtigungen vergeben

1. In der Benutzerliste den gewünschten Benutzer auswählen.
2. Die Rolle auf **Admin** setzen.
3. Änderungen speichern.

Admins haben Zugriff auf:
- Benutzerverwaltung (erstellen, bearbeiten, löschen, deaktivieren)
- Domain-Management
- Systemstatus und Logs
- Serverweite Einstellungen

### Benutzer deaktivieren / löschen

- **Deaktivieren:** Der Benutzer kann sich nicht mehr anmelden, Daten bleiben erhalten.
- **Löschen:** Alle Benutzerdaten werden unwiderruflich entfernt.

## Domain-Management

PrivMail kann E-Mails für mehrere Domains empfangen:

1. Auf **Domains** im Admin-Panel navigieren.
2. **Domain hinzufügen** und die Domain angeben.
3. Die notwendigen DNS-Einträge werden angezeigt (MX, SPF, DKIM, DMARC).
4. DKIM-Schlüssel können im Panel generiert werden.

## Systemstatus

Die Statusseite zeigt:

- **Server-Uptime** – Laufzeit des SMTP/IMAP/API-Servers
- **CPU / RAM / Disk** – Ressourcennutzung
- **PostgreSQL-Verbindung** – Datenbankstatus
- **Warteschlange** – Anzahl ausstehender SMTP-Nachrichten
- **Letzte Fehler** – Log-Auszug der letzten Fehler

## Logs

Server-Logs sind unter `data/logs/` verfügbar. Das Admin-Panel zeigt einen Auszug der letzten Log-Einträge.

Wichtige Log-Dateien:

- `smtp.log` – SMTP-Verbindungen und Zustellungen
- `imap.log` – IMAP-Verbindungen
- `api.log` – API-Anfragen
- `error.log` – Fehler aller Dienste
