# Firewall & Netzwerk-Exposition (PrivMail Suite)

Dieses Dokument beschreibt, welche Ports **öffentlich** erreichbar sein müssen und welche **niemals** auf dem Host veröffentlicht werden dürfen.

## Zwingend öffentlich (Produktion)

| Port | Dienst | Begründung |
|------|--------|------------|
| **80/tcp** | Nginx HTTP | Nur Redirect 301 → HTTPS; Let's Encrypt HTTP-01 optional |
| **443/tcp** | Nginx HTTPS | Einziger Web-Einstieg für PrivMail, Vaultwarden und Immich (SNI/`server_name`) |
| **SMTP** (Default Compose: **2525**, Produktion oft **25/465/587**) | PrivMail Backend | Empfang/Versand von Mail; ohne diesen Port kein SMTP von außen |
| **IMAP** (Default Compose: **2143**, Produktion oft **993**) | PrivMail Backend | Mail-Clients (Thunderbird etc.) |

Optional, nur wenn benötigt:

| Port | Dienst | Begründung |
|------|--------|------------|
| **22/tcp** (oder custom) | SSH | Administration des Hosts – stark absichern (Keys, Fail2ban), nicht die Suite selbst |

Skript: `infrastructure/scripts/setup-firewall.sh` (ufw, Default-Deny).

## Niemals öffentlich exponieren

Diese Dienste laufen nur im Docker-Netz `privmail-network` (`expose:` / keine `ports:`):

| Dienst | Interner Port | Warum nicht öffentlich |
|--------|---------------|-------------------------|
| **postgres** (PrivMail) | 5432 | Datenbank mit Nutzer-/OIDC-Daten |
| **immich-postgres** | 5432 | Immich-Datenbank |
| **immich-redis** / Valkey | 6379 | Cache/Queue – kein Auth-Modell fürs Internet |
| **immich-machine-learning** | — | Nur intern von Immich-Server |
| **backend:3000** | 3000 | HTTP-API nur über Nginx |
| **frontend:3000** | 3000 | Next.js nur über Nginx |
| **vaultwarden:80** | 80 | Nur über Nginx (`vault.`-Host) |
| **immich-server:2283** | 2283 | Nur über Nginx (`photos.`-Host) |

## Compose-`ports:`-Bewertung (`docker-compose.yml`)

| Mapping | Bewertung |
|---------|-----------|
| `nginx` `80:80`, `443:443` | **OK** – öffentliche Web-Einstiege |
| `backend` `${SMTP_PORT:-2525}:2525` | **OK** – Mail; in Produktion Firewall + ggf. 25/587 |
| `backend` `${IMAP_PORT:-2143}:2143` | **OK** – Mail-Clients |
| Postgres / Redis / Immich-ML / interne `expose` | **OK** – nicht auf dem Host publiziert |

## Checkliste nach Installation

1. `sudo ./infrastructure/scripts/setup-firewall.sh`
2. `docker compose ps` – keine unerwarteten `0.0.0.0:…`-Bindings auf DB/Redis
3. Von außen nur 80/443/(SMTP)/(IMAP)/(SSH) erreichbar testen
4. Nginx terminiert TLS; Backend-API nicht direkt vom Internet
