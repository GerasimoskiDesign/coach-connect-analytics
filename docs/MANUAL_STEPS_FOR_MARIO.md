# Manual steps for Mario

Steps only the owner of the GA4 property and the GTM container can do. Work top to bottom. Details are in [GA4 setup](GA4_SETUP.md) and [GTM manual setup](GTM_MANUAL_SETUP.md).

- [ ] **Publish the repo** (could not be done unattended, see PROGRESS.md). Takes about 3 minutes:
  1. On github.com/new create `coach-connect-analytics`, **Public**, with no README, .gitignore or license.
  2. In the new repo: Settings > Pages > Build and deployment > Source: **GitHub Actions**.
  3. In a terminal:
     ```powershell
     cd C:\portfolio\coach-connect-analytics
     git remote add origin https://github.com/GerasimoskiDesign/coach-connect-analytics.git
     git push -u origin main
     ```
  4. Actions tab: wait for **CI** to go green (build, tests, deploy), then open https://gerasimoskidesign.github.io/coach-connect-analytics/ and check the app loads. In DevTools > Network, filter `gtm.js`: the request must contain `id=GTM-M69PG8QQ`.
- [ ] **GA4 web stream.** Admin > Data collection and modification > Data streams: Stream URL is `https://gerasimoskidesign.github.io`, Measurement ID `G-GQKEFPELG9`. In Enhanced measurement > Page views > Show advanced settings, **Page changes based on browser history events** is OFF. ([GA4 setup 1 and 2](GA4_SETUP.md#1-confirm-the-web-stream))
- [ ] **Import the container.** GTM-M69PG8QQ > Admin > Import Container > `gtm/container.json` > New workspace > Merge (Rename conflicting). Remove any second Google tag for the same ID. ([GTM setup 5](GTM_MANUAL_SETUP.md#5-import-instead-of-building-by-hand))
- [ ] **Preview the journey.** Preview against https://gerasimoskidesign.github.io/coach-connect-analytics/ and walk it: accept consent, sign up, search, click a recommendation, book, pay. Each event fires one GA4 event tag. ([GTM setup 6](GTM_MANUAL_SETUP.md#6-verify-with-preview))
- [ ] **Check GA4 DebugView.** Admin > Data display > DebugView: parameters per event as in the checklist. ([GA4 setup 7](GA4_SETUP.md#7-testing-gtm-preview-and-ga4-debugview))
- [ ] **Screenshots.** Save into `docs/img/` with these exact names, then replace the `TODO(Mario)` placeholders in `README.md`. The last two can only be taken after the key event and exploration steps below:
  - `gtm-preview.png`
  - `ga4-debugview.png`
  - `ga4-realtime.png`
  - `ga4-key-events.png`
  - `ga4-funnel.png`
- [ ] **Publish the GTM version.** Submit > Publish and Create Version, with a version name and a short description of what it contains.
- [ ] **Mark key events.** `book_session`, `purchase`, `sign_up` in Admin > Data display > Events (or create them by name in Admin > Data display > Key events). ([GA4 setup 3](GA4_SETUP.md#3-key-events))
- [ ] **Register custom definitions.** Dimensions `rec_algorithm`, `session_type`, `search_term` (event) and `rec_variant` (user); metric `rec_score` (event, Standard). ([GA4 setup 4](GA4_SETUP.md#4-custom-dimensions-and-metric))
- [ ] **Data retention.** Admin > Data collection and modification > Data retention > 14 months. ([GA4 setup 5](GA4_SETUP.md#5-data-retention))
- [ ] **Explorations, after 24 to 48 hours of data.** Funnel exploration `view_item_list` > `select_item` > `view_item` > `book_session` by `rec_variant`, and the free-form CTR by Item list position. Take `ga4-funnel.png` from the funnel. ([GA4 setup 8 and 9](GA4_SETUP.md#8-funnel-exploration-recommendation-funnel))
