# Progress

| # | Step | Status |
|---|---|---|
| 1 | Locate source, copy frontend only | done |
| 1 | Secret scan of the copy | done, clean (below) |
| 1 | Baseline build | done after budget fix (DECISIONS 4) |
| 1 | Mock backend layer | done |
| 2 | GTM snippet + Consent Mode v2 + banner | done |
| 3 | AnalyticsService, all events, A/B variant | done |
| 4 | GTM container JSON + validation | done (9 unit checks) |
| 5 | Docs | done |
| 6 | Playwright QA + CI workflow | done (13 tests); CI not yet run on GitHub |
| 7 | README | done; screenshots are TODO(Mario) |
| 8 | Publish, Pages deploy, live check | **blocked**, see Final summary |

## Secret scan (step 1)

Scanned every copied file except `node_modules` and `package-lock.json`.

- Strict patterns (Google API keys `AIza...`, GitHub tokens `ghp_...`, `sk-...` keys, PEM private keys, SQL connection strings `Server=` / `Data Source=`, JWT-shaped strings `eyJ...`): **0 matches**.
- Broad keywords (`password`, `token`, `secret`, `api key`, `localhost:`, `.env`): matches are only code that handles form passwords and auth tokens at runtime, a dev proxy target `http://localhost:5178` and the ML dev URL `http://localhost:8000`. No credential values.
- No `.env` files present in the copy.

Result: **clean**.

## Final summary

**Repo (local):** `C:\portfolio\coach-connect-analytics`, branch `main`, clean history of small commits (`git log --oneline`).
**Repo URL (once pushed):** https://github.com/GerasimoskiDesign/coach-connect-analytics
**Live URL (once deployed):** https://gerasimoskidesign.github.io/coach-connect-analytics/
**CI status:** not run yet. The workflow is `.github/workflows/ci.yml`; the same steps pass locally.

### What was verified locally

- `npm run gtm:check`: container is up to date with the tracking plan.
- `npm run test:unit`: 9 of 9 pass (container structure, references, regexes vs tracking plan, ID sync across files).
- `npm run build:pages`: production build, no errors or warnings, base href `/coach-connect-analytics/`, `404.html` written.
- `npx playwright test`: 13 of 13 pass against that build served under `/coach-connect-analytics/`.
- `npm start`: dev server serves the app with the GTM snippet; deep links work.
- The source repo `C:\Coach_Connect_V2` was only read: `git status` there is the same as before this run (only the pre-existing `SESSIONS.md` change).

### Why publishing did not happen

`gh` is not installed, and creating the repo through the GitHub API would have meant reading the GitHub token stored in Git Credential Manager. The permission system blocked that, so I stopped there rather than look for a way around it. Nothing was pushed anywhere. The live check (app loads, `gtm.js?id=GTM-M69PG8QQ` requested) is therefore still open; the Playwright suite checks the same thing against the local build.

### Decisions

See [DECISIONS.md](DECISIONS.md) (32 entries). The ones that change behaviour compared with the brief:

- Two GA4 event tags instead of one, so ecommerce items never attach to non-ecommerce events (14).
- Unused event-scoped keys are reset to `undefined` on every push, so GTM's data model cannot leak `value` or `search_term` into later events (15).
- The stored consent choice is re-applied in `index.html` before GTM loads, not from the Angular component (10).
- The Google tag's automatic page_view is off; `page_view_spa` is the only source of page views (13).
- New sign-ups skip onboarding; a demo checkout page was added for `purchase` (6, 20).
- The consent banner sits in the page flow because the floating version covered the sign-up button (11).

### Manual steps left for Mario, in order

Full checklist with click paths: [docs/MANUAL_STEPS_FOR_MARIO.md](docs/MANUAL_STEPS_FOR_MARIO.md).

1. Publish: create the empty public repo on github.com, set Pages source to GitHub Actions, `git remote add origin ...` and `git push -u origin main`. Wait for CI and confirm the live URL loads and requests `gtm.js?id=GTM-M69PG8QQ`.
2. GA4: confirm the web stream and turn **Page changes based on browser history events** off.
3. GTM: import `gtm/container.json` (new workspace, Merge), Preview the journey on the live URL, check DebugView.
4. Take the five screenshots into `docs/img/` and replace the `TODO(Mario)` placeholders in the README.
5. Publish the GTM container version.
6. GA4: mark `sign_up`, `book_session`, `purchase` as key events; register `rec_algorithm`, `session_type`, `search_term`, `rec_variant` and the metric `rec_score`; set data retention to 14 months.
7. After 24 to 48 hours of data: the funnel exploration by `rec_variant` and the free-form CTR by position.

### Not verified (needs a real GTM account)

The container file follows the structure of current GTM exports and passes the local structure checks, but it has not been imported into GTM. One key is less certain than the rest: the user property table on the Google tag's Event Settings variable (`userProperties`). If the import rejects it, the same user property is also set directly on both GA4 event tags, and `docs/GTM_MANUAL_SETUP.md` covers building it by hand.
