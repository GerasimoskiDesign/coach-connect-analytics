# Progress

| # | Step | Status |
|---|---|---|
| 1 | Locate source, copy frontend only | done |
| 1 | Secret scan of the copy | done (clean, see below) |
| 1 | Baseline build | done after budget fix (DECISIONS 4) |
| 1 | Mock backend layer | in progress |
| 2 | GTM snippet + Consent Mode v2 | todo |
| 3 | AnalyticsService + events + A/B variant | todo |
| 4 | GTM container JSON + validation | todo |
| 5 | Docs | todo |
| 6 | Playwright QA + CI | todo |
| 7 | README | todo |
| 8 | Publish, Pages deploy, live check | todo |

## Secret scan (step 1)

Scanned every copied file except `node_modules` and `package-lock.json`.

- Strict patterns (Google API keys `AIza...`, GitHub tokens `ghp_...`, `sk-...` keys, PEM private keys, SQL connection strings `Server=` / `Data Source=`, JWT-shaped strings `eyJ...`): **0 matches**.
- Broad keywords (`password`, `token`, `secret`, `api key`, `localhost:`, `.env`): matches are only code that handles form passwords and auth tokens at runtime, a dev proxy target `http://localhost:5178` and the ML dev URL `http://localhost:8000`. No credential values.
- No `.env` files present in the copy.

Result: **clean**.
