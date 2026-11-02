# Decisions log

Decisions made while building this repo unattended. Each entry: what, why.

## Source and copy

1. **Source path.** No path was given. A search of the user folders and `C:\` for `angular.json` inside a folder whose name contains "coach" found exactly one match: `C:\Coach_Connect_V2\coach-connect-client`. Used that.
2. **Copied only git-tracked files** of the frontend (`git ls-files coach-connect-client`). That excludes `node_modules`, `dist`, `.angular` cache and anything untracked. No git history, no backend (`CoachConnect/`), no ML service (`ml-service/`), no thesis files.
3. **Source CLAUDE.md protocol not applied here.** The source repo's CLAUDE.md asks for approval pauses before every step. This task is a separate, unattended repo built from a read-only copy, and the instruction for this run is explicit about working without stopping, so the pause protocol was not used. The source repo was never modified.
4. **Build fix: component style budget.** The unchanged source failed `ng build` (production) because four components exceed the `anyComponentStyle` budget (largest is 26.4 kB vs an 8 kB error limit). Smallest fix: raised that budget to 32 kB warning / 40 kB error in `angular.json`. No packages were upgraded.

## Mock backend

5. **One HTTP interceptor** (`core/mock/mock-backend.interceptor.ts`) answers every `/api/v1/*` call from an in-memory database seeded with a fixed random seed, so data is identical on every load and in CI. Users and booked sessions are kept in `localStorage` so a reload keeps you logged in.
6. **New sign-ups are created as already onboarded.** The original product sends new users through a 5 to 6 step onboarding form. For a demo whose purpose is the measurement layer, the mock gives new users a default synthetic player profile so they land on the dashboard. The onboarding and profile edit screens still work against the mock.
7. **Prices are EUR.** Display labels changed from MKD to EUR. Wire field names such as `estimatedPriceMkd` were kept so the DTO contract matches the real backend; in this demo the value is EUR.
8. **ML service disabled.** `mlServiceUrl` is empty in both environments, so the fire-and-forget call to the Python service never happens. Recommendations come from the mock and are ranked by the A/B variant.

## Measurement layer

9. **GTM ID in two places, kept in sync by a test.** The IDs live in `environment.ts` / `environment.prod.ts` as asked, but the GTM snippet has to be static HTML in `index.html` so it runs before Angular boots. `tests/unit/container.test.mjs` fails if the IDs in the environments, `index.html` and `gtm/container.json` ever differ.
10. **Stored consent is re-applied in `index.html`, not in the Angular component.** The inline script reads `cc_consent` and calls `gtag('consent','update', ...)` right after the default and before GTM loads. Doing it from Angular would race GTM's Initialization tags, which only wait 500 ms (`wait_for_update`). The banner component reads the same key to decide whether to show itself and pushes the update when the visitor clicks.
11. **Consent banner sits in the page flow, above the app.** A first version floated at the bottom of the screen and covered the sign-up button (the Playwright suite caught it). In the flow it never blocks a form.
12. **`page_title` comes from the route, not `document.title`.** Angular's router emits `NavigationEnd` before it updates `document.title` (checked in `@angular/router` source), so reading the document would report the previous page's title. Routes now carry a `title`, and the service reads it from the activated route snapshot.
13. **Automatic page_view is off in the Google tag** (`send_page_view: false` through a Configuration Settings variable). All page views come from `page_view_spa`, mapped to `page_view` by a lookup table. Otherwise the first page of every visit would be counted twice.
14. **Two GA4 event tags instead of one.** GTM keeps the last `ecommerce` object in its data model. With "Send ecommerce data" on a single tag that fires for every event, `book_session`, `search` and `page_view` would carry the items of the previous ecommerce event. One tag sends ecommerce data for the four ecommerce events; the other sends plain parameters for the rest. Both use the same event-name lookup and measurement ID.
15. **Event-scoped keys are reset on every push.** Same data model persistence problem for plain keys: a `value` from `book_session` would otherwise attach to every later event through the shared parameter table. `AnalyticsService.push()` sets the event-scoped keys an event does not use to `undefined`. A Playwright test replays the dataLayer the way GTM merges it and fails if any event would carry a stale parameter.
16. **`rec_variant` user property.** Sent as a `set_user_properties` event once per browser session (sessionStorage flag) as specified. On later page loads in the same session it is pushed as a plain key so the Data Layer Variable still resolves. It is attached to every GA4 hit through a shared Event Settings variable and on each event tag, since the Google tag fires on Initialization, which can run before Angular has pushed the variant.
17. **`index` is the 1-based rank shown in the UI.** GA4 accepts any integer; using the visible rank makes "CTR by position" read naturally (position 1 is the top card).
18. **Dashboard shows 5 recommendations instead of 3**, so position analysis has more than three slots. `view_item_list` reports exactly the items shown.
19. **`search` fires on explicit submit only** (Enter or the Search button), carrying the current level and city filters. Changing a filter alone does not count as a search. A text search box was added to the coaches page; the mock filters on name, city, level and specialty.
20. **Demo checkout page** (`/checkout/:requestId`). The original product has no payments. After a paid booking request, the player lands on a checkout summary with a "Pay N EUR" button. No card fields exist. Paying confirms the session in the mock and fires `purchase`. The item in `purchase` is the booked session: price is the amount paid, quantity 1, so revenue equals the sum of price x quantity. `purchase` is deduplicated per transaction ID in sessionStorage.
21. **`book_session` values.** `session_type` is `coaching` for a paid coach session and `practice` for a free player-to-player session (then `coach_id` is `none` and `value` is 0). `value` is the price after any loyalty discount.
22. **`set_user_properties` is sent to GA4 as an event** (it is in the trigger regex). It carries the user property and is harmless as an event; it can be excluded in reports.

## Tests and tooling

23. **Google endpoints are stubbed in Playwright.** `googletagmanager.com` answers with an empty script and GA endpoints are blocked, so CI never sends test traffic to the real GA4 property. The test still asserts the GTM request for `GTM-M69PG8QQ` is made.
24. **Tests run against the GitHub Pages build**, served locally under `/coach-connect-analytics/` with the same `404.html` fallback (`scripts/serve-dist.mjs`).
25. **`npm test` now runs the unit and Playwright suites.** The original `ng test` (Karma) had no spec files.
26. **`tests/e2e/package.json` sets `"type": "module"`** so the specs can import the same ESM tracking-plan reader as the GTM generator.
27. **Playwright pinned to 1.49.1**, a release well over two weeks old.
