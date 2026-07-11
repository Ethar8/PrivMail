# Benutzerhandbuch

## Erstes Setup

Nach dem Aufruf von `http://localhost:8080/setup`:

1. Admin-E-Mail-Adresse und Passwort festlegen.
2. OpenPGP-Schlüsselpaar wird automatisch generiert.
3. Optional WebAuthn/YubiKey als zweiten Faktor einrichten.

## Postfächer & Ordner

Die linke Seitenleiste zeigt die verfügbaren Postfächer:

- **Posteingang** – Eingehende E-Mails
- **Gesendet** – Gesendete Nachrichten
- **Entwürfe** – Nicht abgeschlossene Nachrichten
- **Spam** – Automatisch erkannte Spam-Nachrichten
- **Papierkorb** – Gelöschte Nachrichten
- **Eigene Ordner** – Benutzerdefinierte Ordner können über das Kontextmenü erstellt werden

## E-Mail verfassen

1. Auf **Verfassen** klicken oder `N` drücken.
2. Empfänger, Betreff und Nachrichtentext eingeben.
3. **Anhänge** per Drag & Drop oder Dateiauswahl hinzufügen.

### Verschlüsselung aktivieren

- Der **Verschlüsselungsschalter** aktiviert Ende-zu-Ende-Verschlüsselung für die Nachricht.
- Der öffentliche Schlüssel des Empfängers wird automatisch gesucht oder kann manuell importiert werden.
- Bei aktivierter Verschlüsselung werden Nachrichtenkörper und Betreff mit dem öffentlichen Schlüssel des Empfängers verschlüsselt (OpenPGP + RFC 9788).

## Suche

Die Suche arbeitet **vollständig lokal und privat**:

- FTS5-Volltextsuche mit SQLite WASM + OPFS im Browser
- Suchanfragen und -inhalte verlassen niemals den Browser
- Keine Server-Indexierung erforderlich
- Suche nach Absender, Empfänger, Betreff und Nachrichtentext
- Ergebnisse erscheinen während der Eingabe (inkrementell)

## Kalender

Unter **Kalender** können Termine und Ereignisse verwaltet werden. Die Kalenderdaten werden verschlüsselt in der PostgreSQL-Datenbank gespeichert.

## Kontakte

Unter **Kontakte** werden Adressbuch-Einträge verwaltet. Öffentliche Schlüssel von Kontakten können hier gespeichert werden, um nahtlose E2EE zu ermöglichen.

## Einstellungen

### Verschlüsselungsschlüssel

- Eigenes OpenPGP-Schlüsselpaar einsehen und exportieren
- Neues Schlüsselpaar generieren
- Öffentliche Schlüssel von Kontakten importieren

### Sicherheit / 2FA

- WebAuthn/YubiKey als zweiten Faktor registrieren
- Sitzungen verwalten (aktive Sessions einsehen und beenden)
- Passwort ändern

### AI-Assistent

- OpenAI API-Key oder Ollama-Endpunkt konfigurieren
- AI-Funktionen aktivieren/deaktivieren

## Offline-Modus

PrivMail unterstützt **vollständigen Offline-Betrieb**:

- E-Mails werden lokal in SQLite WASM + OPFS (Origin Private File System) zwischengespeichert
- Lesen und Verfassen von E-Mails ist ohne Internetverbindung möglich
- Die lokale Suche funktioniert offline
- Beim nächsten Online-Gang werden Änderungen synchronisiert

Die Offline-Funktionalität ist im Browser automatisch aktiv (Service Worker + OPFS).
