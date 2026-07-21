# PrivMail unter Windows (Docker Desktop)

PrivMail lässt sich auf Windows über **Docker Desktop** mit WSL2 betreiben – analog zu einem Linux-Host, ohne dass Sie Node/PostgreSQL lokal installieren müssen.

## Voraussetzungen

1. **Windows 10/11** mit aktiviertem WSL2
2. **Docker Desktop** (aktuell, mit WSL2-Backend)
3. Genügend RAM (empfohlen ≥ 8 GB für Docker Desktop)
4. Ports freigeben / nicht belegt: `80`, `443`, `8080`, `3000`, `2525`, `2143` (bzw. die in `.env` gesetzten)

### WSL2 aktivieren (PowerShell als Administrator)

```powershell
wsl --install
# Danach neu starten, dann:
wsl --set-default-version 2
```

Docker Desktop → Settings → General → **Use the WSL 2 based engine** aktivieren.

## Installation

Im PowerShell- oder WSL-Terminal:

```powershell
git clone https://github.com/ethartech/privmail.git
cd privmail
```

Unter WSL (empfohlen):

```bash
chmod +x install.sh
./install.sh
```

Oder mit Docker Compose direkt:

```powershell
docker compose up -d
```

Nach dem Start: Setup-Wizard unter `https://localhost` bzw. `http://localhost:8080/setup` (je nach Nginx/TLS-Konfiguration).

## TLS unter Windows / Zuhause-Hosting

PrivMail startet in **Produktion nicht ohne gültiges TLS** (Bitwarden/Vaultwarden-Modell).

Optionen:

1. **Let's Encrypt** hinter einem öffentlichen Hostnamen (`infrastructure/scripts/setup-ssl.sh`)
2. **Eigenes Zertifikat** unter den in `.env` gesetzten `TLS_CERT_PATH` / `TLS_KEY_PATH`
3. **Reverse-Proxy** (Nginx terminiert TLS; Backend prüft `X-Forwarded-Proto: https`)

Für lokales Testen: `NODE_ENV=development` und ggf. `ALLOW_HTTP_DEV=true` – **niemals** in Produktion.

## Firewall & Router (Zuhause)

- Windows-Firewall: eingehend TCP 25/465/587 (SMTP), 143/993 (IMAP), 80/443 (HTTP/S) freigeben, falls Sie von außen erreichbar sein wollen
- Router: Port-Forwarding der gleichen Ports auf den PC mit Docker Desktop
- DynDNS oder fester Hostname für SPF/DKIM/DMARC und Let's Encrypt

## Bekannte Hinweise Docker Desktop

- Dateien am besten im **WSL-Dateisystem** (`\\wsl$\...`) ablegen – bessere I/O-Performance als unter `/mnt/c`
- Nach Ruhezustand ggf. `docker compose up -d` erneut ausführen
- Antivirus kann Container-Volumes verlangsamen; Projektordner ggf. ausschließen

## Weiterführend

- [Installation (allgemein)](installation.md)
- [Konfiguration](configuration.md)
- [Sicherheit / HTTPS-Zwang](security.md)
