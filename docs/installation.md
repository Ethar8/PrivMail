# Installation

## Voraussetzungen

- **Docker** 24 oder höher
- **Docker Compose** v2 (`docker compose`)
- Freie Ports: **80**, **443**, SMTP (Default **2525**), IMAP (Default **2143**)
- Eine Domain mit DNS-Zugriff (Produktion)

## Produktions-Installation (empfohlen)

```bash
git clone https://github.com/ethartech/privmail.git
cd privmail
chmod +x install.sh scripts/*.sh infrastructure/scripts/*.sh

# 1) Domain + Secrets + Nginx
./scripts/setup-wizard.sh --domain mail.example.com --yes
# oder interaktiv: ./scripts/setup-wizard.sh

# 2) Stack starten
./install.sh

# 3) TLS (Let's Encrypt) – DNS A/AAAA für DOMAIN, vault.*, photos.* müssen stehen
./infrastructure/scripts/setup-ssl.sh mail.example.com

# 4) DKIM + DNS-Hinweise
./infrastructure/scripts/setup-dkim.sh mail.example.com
./infrastructure/scripts/setup-dns.sh mail.example.com <SERVER-IP>

# 5) Host-Firewall (optional, empfohlen)
sudo ./infrastructure/scripts/setup-firewall.sh

# 6) Probe
DOMAIN=mail.example.com ./scripts/prod-deploy-probe.sh
```

Admin-Setup im Browser: `https://mail.example.com/setup`

## Lokale Entwicklung / E2E

```bash
./scripts/e2e-prepare.sh
./scripts/e2e-make-certs.sh
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
ALLOW_SELF_SIGNED=true DOMAIN=privmail.test \
  CURL_EXTRA_ARGS='-k --resolve privmail.test:443:127.0.0.1 --resolve vault.privmail.test:443:127.0.0.1 --resolve photos.privmail.test:443:127.0.0.1' \
  ./scripts/prod-deploy-probe.sh
```

Setup: `https://privmail.test/setup` (Self-Signed, Browser-Warnung erwartbar).

## Windows / Docker Desktop

Siehe **[windows-docker.md](windows-docker.md)**.

## Manuelles Dev-Setup

### Backend

Voraussetzungen: Node.js 22, PostgreSQL 16

```bash
cd backend
cp .env.example .env   # ALLOW_INSECURE_DEV nur lokal
npm ci
npm run dev
```

### Frontend

```bash
cd frontend/web
npm ci
npm run dev
```

## Nach der Installation prüfen

| Check | Befehl / Ort |
|-------|----------------|
| HTTPS + Header + OIDC | `./scripts/prod-deploy-probe.sh` |
| SSO (lokal) | `./scripts/e2e-container-sso.sh` |
| DNS MX/SPF/DKIM/DMARC | Admin → DNS-Check |
| Firewall | `docs/firewall.md` |

## Deinstallation

```bash
./infrastructure/scripts/uninstall.sh
```
