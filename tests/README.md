# Tests

Dieser Ordner enthält übergreifende Tests. Die kernnahen Unit-Tests für Backend
liegen zusätzlich unter `backend/src/test/` und laufen mit Jest.

## Struktur

- `unit/` – isolierte Funktionstests (Krypto, Parser, Filter)
- `integration/` – Zusammenspiel mehrerer Backend-Module (API + DB)
- `e2e/` – End-to-End-Szenarien über die laufende Anwendung

## Ausführen

```bash
cd backend
npm test
```
