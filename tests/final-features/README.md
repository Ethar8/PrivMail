# Final Features (vorbereitet in tests/final-features/)

Alle Module sind isoliert entwickelt und geprüft (Typecheck + Laufzeit-Roundtrips).
**Produktivcode ist unberührt.** Bei Freigabe werden die Dateien an die unten
genannten Zielorte übernommen.

## 1. KI-Schaltzentrale & Ollama (async LLM-Spamfilter)

| Datei (hier) | Zielort (Produktion) | Zweck |
|--------------|----------------------|-------|
| `backend/spam/llm-classifier.ts` | `backend/src/spam/llm-classifier.ts` | Async Ollama-HTTP-Call, Phishing-Score 0–10, **fail-open**, Timeout via AbortController |
| `backend/spam/ai-config-store.ts` | `backend/src/spam/ai-config-store.ts` | Persistente AI-Config (1-Zeilen-Tabelle) |
| `backend/spam/007_ai_config.sql` | `backend/src/database/migrations/007_ai_config.sql` | Migration `ai_config` |
| `backend/spam/ingest-llm-hook.ts` | Patch in `backend/src/mail/ingest.ts` | `scheduleLlmRescore()` – fire-and-forget NACH Zustellung, blockiert SMTP nie |
| `backend/api/admin-ai-config.ts` | Patch in `backend/src/api/routes/admin.ts` | `GET/POST /api/admin/ai-config` + erweiterte `/status` (CPU/RAM live) |
| `frontend/lib/ai-admin-api.ts` | Patch in `frontend/web/src/lib/api.ts` | Client (`aiAdminApi`) + Typen |
| `frontend/components/AIControlCenter.tsx` | `frontend/web/src/components/admin/AIControlCenter.tsx` | Regler: Modell (Llama 3/Mistral/Deaktiviert), Sensitivität, Live-CPU/RAM-Gauges |

**Benötigter Patch in `mailstore.ts`:** neue Methode
`updateSpamScore(id, userId, score)` (einfaches `UPDATE emails SET spam_score = $3 …`).

## 2. QR-Code Auto-Discovery (RFC 6186)

| Datei (hier) | Zielort | Zweck |
|--------------|---------|-------|
| `frontend/lib/autodiscovery.ts` | `frontend/web/src/lib/autodiscovery.ts` | Baut RFC-6186-Payload (SMTP-Submission, IMAP, JMAP/CardDAV/CalDAV well-known + SRV-Hints) |
| `frontend/components/SetupQrCode.tsx` | `frontend/web/src/components/admin/SetupQrCode.tsx` | Rendert QR (Lib `qrcode`), einzubinden in `admin/users` nach Nutzeranlage |

**Neue Dependency:** `qrcode` + `@types/qrcode` in `frontend/web/package.json`.

## 3. RFC 9788 – Empfang im Viewer

| Datei (hier) | Zielort | Zweck |
|--------------|---------|-------|
| `frontend/lib/rfc9788-viewer.ts` | `frontend/web/src/lib/rfc9788-viewer.ts` | `isHeaderProtected()`, `extractProtectedParts()`, `decryptProtectedMessage()` |
| `frontend/components/EmailView.rfc9788.tsx` | ersetzt `frontend/web/src/components/mail/EmailView.tsx` | Erkennt Header-Schutz, entschlüsselt Header + Body mit privatem Schlüssel + Passphrase |

## Verifikation (durchgeführt)

- **Backend Typecheck**: sauber (Overlay im echten Backend-Kontext)
- **LLM-Classifier-Tests**: 6/6 grün (Mock-Ollama: Parse, Fail-open ×2, Disabled, Clamp, Score-Mapping)
- **Frontend Typecheck**: sauber (Overlay + `qrcode` installiert)
- **Autodiscovery-Payload**: Laufzeit-Check – korrekte SRV/JMAP/WebDAV-Einträge
- **RFC-9788-Viewer**: voller OpenPGP-Roundtrip (bauen → erkennen → extrahieren → entschlüsseln → Original wiederhergestellt)

## Offene Integrationsschritte bei Freigabe
1. `mailstore.updateSpamScore()` ergänzen.
2. `ingest.ts`: `scheduleLlmRescore(...)` am Ende (ohne await) aufrufen.
3. `admin.ts`: `aiConfigRoutes` mounten + `/status` um `systemStats()` erweitern.
4. `qrcode`-Dependency hinzufügen.
5. `EmailView.tsx` durch die RFC-9788-Variante ersetzen; `email.raw` an den Viewer durchreichen.
