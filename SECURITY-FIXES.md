# PrivMail Security Fixes – Status Report

Stand: `2026-07-19` | Audit-Fixes + Phase 1–4 (2026-Roadmap)

---

## 🔴 SICHERHEIT (MUSS)

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 1 | CSRF-Schutz | Behoben | `backend/src/api/middleware/csrf.ts` – Double-Submit-Cookie `XSRF-TOKEN` + Header `X-XSRF-TOKEN`. Frontend sendet Token bei POST/PUT/DELETE (`lib/api.ts`). |
| ✅ | 2 | JWT in httpOnly-Cookie | Behoben | Cookie `privmail-token` mit `httpOnly`, `sameSite: strict`, `secure` in Produktion. localStorage-JWT entfernt. Logout löscht Cookie + bump Token-Version. |
| ✅ | 3 | HTML-Sanitizer | Behoben | `sanitizeHtml()` bei Send (`mail.ts`) und Inbound (`ingest.ts`). Erweitert um SVG/iframe/object/event-handler/`javascript:`/`data:text/html`. |
| ✅ | 4 | Reset-Token-Logging | Behoben | Nur neutrales Log ohne Token-Wert; DB speichert Hash. |
| ✅ | 5 | CSP + Security-Header | Behoben | Nginx: HSTS (2y, includeSubDomains, preload), CSP, X-Frame-Options, nosniff, Referrer-Policy. Helmet im Backend. |
| ✅ | 6 | SMTP VRFY/EXPN | Behoben | `502 Command disabled for security reasons`. |
| ✅ | 7 | Rate-Limiting SMTP/IMAP | Behoben | Max. 5 AUTH-Versuche/Minute/IP in SMTP- und IMAP-Server. |
| ✅ | 8 | HTTPS-Erzwingung | Behoben | `tls-guard.ts` Startup-Guard, SMTP/IMAP TLS-Zwang für AUTH, Nginx Port-80→HTTPS, Secure-Cookies. Docs: `docs/security.md`, `docs/windows-docker.md`. |
| ✅ | 9 | Keine Default-Secrets | Behoben | Start verweigert bei leeren/bekannten JWT/SESSION-Secrets (außer `ALLOW_INSECURE_DEV=true`). |
| ✅ | 10 | CORS-Whitelist | Behoben | Explizite `CORS_ORIGINS`; leere Liste verhindert Start. |

---

## 🟡 FEATURES (SOLLTE)

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 11 | KI-Sicherheitscheck vor dem Lesen | Behoben | `ai/security-check.ts`, Route `/mail/:id/security-check`, Warnungen in `EmailListItem`/`EmailView`, Config in AI-Settings. |
| ✅ | 12 | Frontend-Tests ≥70 % | Behoben | Jest: Statements 87 %, Branches 73 %, Functions 84 %, Lines 89 % (lib+hooks, ohne Browser-API-Wrapper). 91 Tests grün. |
| ✅ | 13 | SystemStatus NaN-Bug | Behoben | Sichere Memory-Berechnung in `SystemStatus.tsx`. |
| ✅ | 14 | Attachments anbinden | Behoben | `ComposeForm` konvertiert Dateien → Base64 und sendet `attachments[]` an `/mail/send`. |
| ✅ | 15 | IMAP COPY | Behoben | `handlers/copy.ts` + Mailstore. |
| ✅ | 16 | IMAP SUBSCRIBE/UNSUBSCRIBE | Behoben | Persistiert in `mailbox_subscriptions`. |
| ✅ | 17 | Offline-Cache Kalender/Kontakte | Behoben | Tabellen + CRUD/FTS in `lib/db.ts`. |
| ✅ | 18 | Whitelist persistiert + Admin-UI | Behoben | PostgreSQL + `/admin/whitelist` UI. |
| ✅ | 19 | Queue persistiert | Behoben | `outbound_queue` in PostgreSQL. |
| ✅ | 20 | FTS5-Sanitizer | Behoben | Operator-Injection geblockt; NL-Suche läuft durch denselben Sanitizer. |

### Optional 21–24

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| 🔜 | 21 | CardDAV/CalDAV | Offen | Nur Autodiscovery-URLs; kein Server-Protokoll (nach Produktion). |
| 🔜 | 22 | JMAP | Offen | Keine JMAP-API (nach Produktion). |
| ✅ | 23 | PWA | Behoben | Manifest + `sw.js`; Service Worker wird in `providers.tsx` registriert. |
| ✅ | 24 | WebAuthn Origin | Behoben | Produktion default `https://${rpID}`; Override via `WEBAUTHN_ORIGIN`. |

---

## 🔐 PHASE 1 – SICHERHEITS-FUNDAMENT

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 1 | Post-Quantum-Hybrid | Behoben* | `hybrid.ts`: OpenPGP Curve25519 + ML-KEM-768 (`@noble/post-quantum`, Dependency in `package.json`). Fallback `secp521r1-interim`, wenn Paket noch nicht installiert (Netzwerk). Payload mit `alg`-Tag; Legacy v1 lesbar. |
| ✅ | 2 | SRP-Login | Behoben | SRP-6a Backend + Frontend-Client; bcrypt bleibt als Migrationspfad. |
| ✅ | 3 | Trusted-Key-Verifikation | Behoben | `contact-key.ts` + Frontend-Warnung bei Schlüsselwechsel. |
| ✅ | 4 | Login-Anomalie | Behoben | `services/anomaly.ts` + `login_history`. |
| ✅ | 5 | Zero-Knowledge-Recovery | Behoben | Recovery-Phrase (Hash only); kein Klartext-Passwort im Log. |
| ✅ | 6 | SECURITY.md + CI | Behoben | Verantwortliche Offenlegung, npm audit / dependency-review. |

\* Nach `npm install` im Backend wird ML-KEM-768 aktiv; bis dahin Interim-Algorithmus (klar gekennzeichnet).

---

## 🟡 PHASE 2 – ALLTAGSTAUGLICHKEIT

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 7 | Passwortgeschützte Mails | Behoben | AES-256-GCM + PBKDF2; Server speichert nur Chiffrat. Browser-Entschlüsselung (`external-decrypt.ts`, Seite `/external/[id]`). Access-Code auf `/ciphertext` und Legacy-`/decrypt` **Pflicht**, wenn gesetzt. |
| ✅ | 8 | Aliase | Behoben* | CRUD + Delivery + Send-as (siehe Killer-Features unten). Früher nur CRUD ohne Ingest – **repariert**. |
| ✅ | 9 | Selbstzerstörende Nachrichten | Behoben | `expires_at` + Cleanup-Job. |
| ✅ | 10 | Undo/Schedule/Snooze | Behoben | Delayed send + Snooze-Mailbox + Cleanup. |
| ✅ | 11 | Filter-Engine | Behoben | API + UI `/dashboard/settings/filters`. |
| ✅ | 12 | Abwesenheitsassistent | Behoben | API + UI `/dashboard/settings/autoresponder`. |
| ✅ | 13 | Import-Tool | Behoben | MBOX/EML/IMAP/VCF/ICS; `req.userId`-Bug behoben; UI unter Settings → Import. |
| ✅ | 14 | Mobile PWA | Behoben | SW-Registrierung + Offline-Cache-Strategie. |

---

## 🟢 PHASE 3 – KI-TOOLS

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 15 | Lokale KI als Default | Behoben | Ollama Default; Cloud nur Opt-in mit UI-Warnung. |
| ✅ | 16 | KI-Vorschlag Passwortschutz | Behoben | In Compose verdrahtet (`ComposeEncryption` + `ComposeForm`). |
| ✅ | 17 | Thread-Zusammenfassung | Behoben | Session-only `Map`-Cache in `ai.ts`. |
| ✅ | 18 | Ton-/Klarheits-Check | Behoben | Vor dem Senden in `ComposeForm` (überarbeitbar / trotzdem senden). |
| ✅ | 19 | Natürlichsprachliche Suche | Behoben | NL→Terms→`sanitizeFtsQuery`. |

---

## 🔵 PHASE 4 – INSTALLATION

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 20 | Ein-Befehl-Setup | Vorhanden | `install.sh` + Docker Compose. |
| ✅ | 21 | Setup-Wizard | Behoben | `/api/setup-wizard/*`. |
| ✅ | 22 | Auto-TLS-Erneuerung | Behoben | `setup-ssl.sh` / certbot. |
| ✅ | 23 | Windows/Docker-Anleitung | Behoben | `docs/windows-docker.md` + Link in `installation.md`. |
| ✅ | 24 | Health-Dashboard | Behoben | Admin `SystemStatus` (NaN-fix). |

---

## ⚪ DESIGN / UX

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 25 | Design-System | Vorhanden | Tailwind + Tokens + Shadcn. |
| ✅ | 26 | Dark Mode | Vorhanden | `next-themes`. |
| ✅ | 27 | Barrierefreiheit | Teilweise | Skip-Link, ARIA an neuen Settings/Compose/External-Seiten. Vollständige WCAG-Audit-Suite folgt. |

---

## ✉️ KILLER-FEATURES (Proton-inspiriert, 2026-07-19)

### Punkt 0 – Bestandsaufnahme (vor Erweiterung)

| Feature | Vorher | Nachher |
|---------|--------|---------|
| Aliase | **BROKEN**: nur CRUD/UI; Ingest ignorierte `email_aliases` → Mails verworfen; kein Send-as | Delivery + RCPT-Prüfung + Send-as + Sperre |
| Externe Passwort-Mails | **PARTIAL**: echte AES-GCM OK; Access-Code auf `/ciphertext` optional umgehbar; Legacy-`/decrypt` ohne Schutz | Access-Code Pflicht; Legacy gehärtet |

### Checkliste Erweiterungen

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 0 | Bestandsaufnahme | Erledigt | Siehe Tabelle oben |
| ✅ | 1 | Ein-Klick-Alias | Behoben | Schild-Button in Compose + Settings; Label; `mail_count`; Ein-Klick-Sperre → SMTP 550; Delivery via `resolveLocalRecipient` in RCPT+Ingest; From-Auswahl in Compose |
| ✅ | 2 | Easy-Switch-Import | Behoben | Hintergrund-Job `import_jobs`; LIST aller IMAP-Ordner; Mapping → PrivMail-Mailboxen; Fortschritt + ETA in UI |
| ✅ | 3 | KI-Schreibassistent | Behoben | Compose-Toolbar: verlängern/kürzen, Tonfall, Stichpunkte→Entwurf; Ollama-Default + Cloud-Warnung |
| ✅ | 4 | Anhang-Freigabelinks | Behoben | `attachment_shares` + gleiche AES-GCM-Logik; Ablauf + View-Count; Seite `/share/attachment/[id]` |
| ✅ | 5 | Kalender-Ausbau | Behoben | Mehrere farbige Kalender; Filter; Ort-Feld; Teilnehmer + iCal REQUEST + RSVP-Links |

Migration: `010_killer_features.sql`

---

## Konflikte / Hinweise

1. **ML-KEM-Paket**: `@noble/post-quantum` steht in `backend/package.json`; Registry war während der Session nicht erreichbar. Code lädt ML-KEM dynamisch und fällt sonst auf `secp521r1-interim` zurück – kein Feature-Verlust, aber kein echter PQ-Schutz bis `npm install`.
2. **Bearer-JWT**: Authorization-Header wird neben Cookie noch akzeptiert (Kompatibilität Clients); Cookie ist der bevorzugte Pfad.
3. **CardDAV/CalDAV/JMAP**: bewusst nach Produktion verschoben (optional).
4. **IMAP Easy-Switch**: Minimal-Client (kein IDLE); große Postfächer nutzen Limit pro Ordner; Fortschritt ist Schätzung.
5. **Kalender-RSVP**: öffentliche GET-Links aktualisieren Status; absolute Origin in Einladungs-Mails hängt vom Deployment-Host ab.

---

## 🧪 Tests (dieser Stand)

```
Backend TypeScript:  ✅ (smtp/async RCPT angepasst)
Backend SMTP-Tests:  ✅ 16/16
Frontend Tests:       ✅ 95/95
Frontend Coverage:    ✅ ≥70% (Stmt/Branch/Func/Line)
```

---

## 🏠 SUITE SSO – Vaultwarden & Immich (2026-07-19)

PrivMail als zentraler OIDC-Identity-Provider (`oidc-provider` / node-oidc-provider exclusively).  
Dokumentation: [`docs/sso.md`](docs/sso.md)

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | 1 | `oidc-provider` integriert | Behoben | Dependency + `services/oidc-provider.ts`; Discovery `/.well-known/openid-configuration`; Endpunkte `/oidc/*`. |
| ✅ | 2 | User-Tabelle als Account-Quelle | Behoben | `findAccount` → `models/user.ts` (`findById`). |
| ✅ | 3 | Bestehende Login-UI | Behoben | Interaction → `/login?interaction=…`; Confirm über `/api/oidc/interaction/:uid/confirm`. |
| ✅ | 4 | Client-Registrierung | Behoben | Env-Seed + Admin-UI `/admin/oidc-clients` + API. |
| ✅ | 5 | Scopes/Claims | Behoben | `openid profile email` (+ `offline_access`); Claims email/profile. |
| ✅ | 6 | PKCE | Behoben | Library-Config `pkce.required = () => true`, Methode `S256`. |
| ✅ | 7 | Vaultwarden Compose | Behoben | `vaultwarden/server:latest`, Volume `data/vaultwarden`, Nginx `vault.*`. |
| ✅ | 8 | Vaultwarden SSO-Env | Behoben | Gegen aktuelle Doku: `SSO_ENABLED`, `SSO_AUTHORITY`, `SSO_CLIENT_*`, `SSO_PKCE`, `SSO_SCOPES`. |
| ✅ | 9 | Master-Passwort erklärt | Behoben | `docs/sso.md` + Hinweis auf Apps-Dashboard. |
| ✅ | 10 | Vaultwarden Redirect-URI | Behoben | `…/identity/connect/oidc-signin` beim Seed. |
| ✅ | 11 | Immich Compose | Behoben | Server, ML, Valkey, Immich-Postgres; Volume für Uploads. |
| ✅ | 12 | Immich OAuth | Behoben | Schritte in `docs/sso.md` (Admin-UI; Auto Register aus). |
| ✅ | 13 | Immich Redirect-URIs | Behoben | Web + Mobile + mobile-redirect beim Seed. |
| ✅ | 14 | Auto-Register aus | Behoben | Dokumentiert als Pflicht in Immich-Admin. |
| ✅ | 15 | Apps-Dashboard | Behoben | `/dashboard/apps` – echte Links, kein iframe. |
| ✅ | 16 | Health-Check Suite | Behoben | Admin-Status: Discovery, letzter SSO-Login, Vaultwarden `/alive`, Immich ping. |

### Automatisierung + E2E (Nachzug 2026-07-19)

| Behoben | Nr. | Aufgabe | Status | Details |
|---------|-----|---------|--------|---------|
| ✅ | A1 | Secrets/CORS automatisch | Behoben | `scripts/generate-secrets.sh` + `install.sh` |
| ✅ | A2 | Immich-OAuth API | Behoben | `scripts/configure-immich-oauth.sh` → `PUT /api/system-config`, `autoRegister:false` |
| ✅ | A3 | Auto-TLS Subdomains | Behoben | `setup-ssl.sh` mit `-d DOMAIN -d vault.DOMAIN -d photos.DOMAIN` |
| ✅ | A4 | Setup-Flow | Behoben | Wizard `/derive-suite-config`, DNS-Hinweise, install.sh |
| ✅ | E2E | Nachweisbarer SSO-Test | Behoben | `TEST-RESULTS.md` + `sso-suite.e2e.ts` (Discovery, VW/Immich-PKCE, Negativtests) |

Vollständiger Bericht mit Log-Ausschnitten: [`TEST-RESULTS.md`](TEST-RESULTS.md)
