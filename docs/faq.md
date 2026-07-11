# FAQ – Häufig gestellte Fragen

## Ist PrivMail ein Fork von Postfix, Dovecot oder Stalwart?

Nein. PrivMail ist eine vollständige Eigenentwicklung mit eigenen SMTP- und IMAP-Servern, geschrieben in TypeScript. Es basiert nicht auf Postfix, Dovecot, Stalwart oder einem anderen bestehenden Mailserver.

## Kann der Server meine E-Mails lesen?

Nein. E-Mail-Körper werden Ende-zu-Ende mit OpenPGP verschlüsselt und verlassen den Browser des Absenders nur verschlüsselt. Zusätzlich werden sensitive Header (Betreff, Von, An) gemäß RFC 9788 geschützt. Der Server speichert und überträgt ausschließlich verschlüsselte Daten.

## Wie funktioniert die Suche, ohne dass der Server die Inhalte sieht?

Die Suche nutzt SQLite WASM mit FTS5 (Full-Text Search 5), das vollständig im Browser läuft. E-Mails werden lokal im OPFS (Origin Private File System) des Browsers zwischengespeichert und indiziert. Suchanfragen werden ausschließlich gegen diesen lokalen Index ausgeführt – kein Server ist involviert.

## Funktioniert PrivMail offline?

Ja. Der Offline-Modus nutzt SQLite WASM + OPFS, um E-Mails lokal zu speichern. Lesen, Verfassen und Suchen funktionieren ohne Internetverbindung. Sobald die Verbindung wiederhergestellt ist, werden Änderungen synchronisiert.

## Welche AI-Provider werden unterstützt?

OpenAI (ChatGPT), Ollama (lokal/self-hosted) und beliebige OpenAI-kompatible Endpunkte. AI-Anfragen werden direkt vom Browser an den Provider gesendet – der PrivMail-Server sieht keine AI-Daten.

## Werden YubiKeys und andere FIDO2-Geräte unterstützt?

Ja. PrivMail verwendet WebAuthn für Zwei-Faktor-Authentifizierung und unterstützt YubiKeys sowie alle FIDO2/WebAuthn-kompatiblen Sicherheitsschlüssel.

## Unter welcher Lizenz steht PrivMail?

PrivMail ist unter der MIT-Lizenz veröffentlicht. Die Software darf frei verwendet, verändert und weitergegeben werden.

## Wie erstelle ich Backups?

Im Projektverzeichnis stehen zwei Skripte zur Verfügung:

```bash
# Backup erstellen
./backup.sh

# Backup wiederherstellen
./restore.sh /pfad/zum/backup.tar.gz
```

Die Backups umfassen die PostgreSQL-Datenbank, E-Mail-Daten (Maildir), Warteschlangen und Logs.

## Welche Ports muss ich in der Firewall öffnen?

Für den vollen Betrieb:

| Port | Zweck |
|------|-------|
| 25 | SMTP (optional, für direkten Empfang) |
| 2525 | SMTP (Standard-Privat-SMTP-Port) |
| 2143 | IMAP |
| 8080 | Webmail HTTP |
| 443 | HTTPS (via Reverse-Proxy) |

Interne Ports (3000 für API) müssen nicht von außen erreichbar sein.

## Wie migriere ich von einem anderen Mailserver?

1. PrivMail installieren und Domains konfigurieren
2. E-Mails via IMAP-Migration übertragen (imapsync oder ähnliches Tool)
3. DNS-Einträge auf den neuen Server umstellen
4. Alten Server nach erfolgreicher Migration abschalten

## Kann ich externe E-Mail-Clients (Thunderbird, Outlook) verwenden?

Ja. Jeder IMAP/SMTP-kompatible Client kann über Port 2143 (IMAP) und 2525 (SMTP) mit STARTTLS verbunden werden. Allerdings nur für unverschlüsselte E-Mails – die Ende-zu-Ende-Verschlüsselung steht nur im PrivMail-Webmail zur Verfügung.
