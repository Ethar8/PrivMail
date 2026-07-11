# End-to-End tests

E2E-Szenarien laufen gegen den gestarteten Docker-Stack. Vorschlag zum Ausbau:

1. `docker compose up -d`
2. Setup-Flow über `http://localhost:8080/setup` durchlaufen
3. E-Mail senden/empfangen über SMTP/IMAP prüfen
4. Verschlüsselung, Suche und Spam-Filter verifizieren

Ein Framework wie Playwright kann hier ergänzt werden.
