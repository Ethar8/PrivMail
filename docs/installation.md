# Installation

## Voraussetzungen

- **Docker** 24 oder höher
- **Docker Compose** (v2, als `docker compose` Plugin)
- Folgende Ports müssen verfügbar sein:
  - **2525** – SMTP
  - **2143** – IMAP
  - **3000** – REST API
  - **8080** – HTTP (Webmail)

## 1-Klick-Installation

1. Repository klonen:

   ```bash
   git clone https://github.com/ethartech/privmail.git
   cd privmail
   ```

2. Installationsskript ausführen:

   ```bash
   chmod +x install.sh
   ./install.sh
   ```

   Das Skript erstellt die notwendigen Verzeichnisse, prüft die Umgebungsvariablen in `.env` und startet alle Dienste per Docker Compose.

3. Nach erfolgreichem Start das Setup unter folgender Adresse aufrufen:

   ```
   http://localhost:8080/setup
   ```

   Dort den ersten Admin-Benutzer anlegen.

## Nach der Installation

Nach dem Setup sind alle Dienste betriebsbereit:

- **Webmail:** `http://localhost:8080`
- **SMTP:** Port `2525` (STARTTLS)
- **IMAP:** Port `2143` (STARTTLS)
- **API:** Port `3000`

DNS-Einträge (MX, SPF, DKIM, DMARC) sollten gemäß der [Sicherheitsdokumentation](security.md) konfiguriert werden, um E-Mail-Zustellung zu gewährleisten.

## Manuelles Dev-Setup

### Backend

Voraussetzungen: Node.js 22, PostgreSQL 16

```bash
cd backend
cp .env.example .env
# .env anpassen (insbesondere DATABASE_URL)
npm install
npm run dev
```

Der Backend-Server startet auf Port 3000.

### Frontend

Voraussetzungen: Node.js 22

```bash
cd frontend/web
cp .env.example .env.local
npm install
npm run dev
```

Das Frontend startet auf Port 8080.

## Deinstallation

```bash
docker compose down -v
rm -rf data/
```

Zusätzlich das geklonte Repository-Verzeichnis löschen, falls nicht mehr benötigt:

```bash
cd ..
rm -rf privmail
```
