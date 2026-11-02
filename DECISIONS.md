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
