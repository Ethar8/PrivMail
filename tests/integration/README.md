# Integration tests

Integrationstests erfordern eine laufende PostgreSQL-Instanz (z. B. via
`docker compose up postgres`). Setze `DATABASE_URL` entsprechend, bevor du die
Tests startest.

Beispiel:

```bash
DATABASE_URL=postgresql://privmail:pass@localhost:5432/privmail npm test
```
