# Release-Checkliste PrivMail 1.0

Vor dem Tag `v1.0.0` / GitHub Release:

- [x] `VERSION` und `package.json` (backend + frontend) = `1.0.0`
- [x] `CHANGELOG.md` + `docs/RELEASE.md` aktuell
- [x] Keine Secrets in Git (`.env` gitignored; nur `.env.example`)
- [x] `infrastructure/dkim/*.private.pem` nicht committed
- [x] Backend: Unit-Tests Kern (SRP, DKIM, Queue) grün; `tsc --noEmit` OK
- [x] Frontend: `postcss` Override, `npm audit --omit=dev` = 0; `tsc --noEmit` OK
- [x] `./scripts/prod-deploy-probe.sh` grün mit `ALLOW_SELF_SIGNED=true` (E2E)
- [x] Pen-Test / SSO-E2E laut `TEST-RESULTS.md` dokumentiert
- [x] DNS/DKIM/SSL-Doku stimmt (`docs/installation.md`, `setup-dkim.sh`)
- [ ] Tag: `git tag -a v1.0.0 -m "PrivMail Suite 1.0.0"` *(nach Commit)*
- [ ] GitHub Release mit Text aus `docs/RELEASE.md` *(nach Push)*
