# Traffic simulation

`simulate.mjs` drives the real Coach Connect+ demo in a visible Chromium window, one simulated user at a time, so that GTM sends real events to the GA4 property `G-GQKEFPELG9`. It produces the demo data set for the GA4 reports, funnels and the A/B comparison.

It is separate from the Playwright tests on purpose. The tests stub Google requests so CI never sends traffic; the simulation must not, or nothing would reach GA4.

## Before a real run

Run against the live site only when all of these are true. Otherwise the data in GA4 will not match the tracking plan.

1. The live site runs the current build (the deploy includes the Phase 1 analytics changes).
2. The GTM container from `gtm/container.json` is published, with no second Google tag for `G-GQKEFPELG9` ([manual steps](../docs/MANUAL_STEPS_FOR_MARIO.md)).
3. The custom dimensions and metrics in [GA4 setup, section 4](../docs/GA4_SETUP.md#4-custom-dimensions-and-metric) are registered. They only apply to data collected after they exist.
4. No **Internal Traffic** filter is Active for this machine's IP address; it would drop every simulated user ([GA4 setup, section 6](../docs/GA4_SETUP.md#6-exclude-internal-and-test-traffic)).
5. The laptop is plugged in. The script keeps Windows (and macOS) awake while it runs, but it cannot stop a lid-close sleep or a forced update restart.

## Commands

Install once (from the repo root):

```powershell
npm ci
npx playwright install chromium
```

Local test against the production build, GA4 requests blocked (nothing is sent to GA4):

```powershell
npm run build:pages
npm run serve:dist                 # terminal 1: serves dist on http://localhost:4300/coach-connect-analytics/
npm run sim:local                  # terminal 2: 3 users, fast pace, --block-ga
```

Full batch against the live site (sends real events to GA4):

```powershell
npm run sim                        # = node simulation/simulate.mjs (defaults below)
```

Any option can be added after `--`, for example `npm run sim -- --max-users 20 --seed 42`.

| Option | Env variable | Default | Meaning |
|---|---|---|---|
| `--base-url <url>` | `BASE_URL` | `https://gerasimoskidesign.github.io/coach-connect-analytics/` | Site to drive. Only that URL or `http://localhost` / `http://127.0.0.1` are accepted; anything else exits before a browser opens. |
| `--max-users <n>` | `MAX_USERS` | 150 | Simulated users in the run |
| `--max-events <n>` | `MAX_EVENTS_PER_USER` | 40 | Tracked dataLayer events per user; the journey ends when it is reached |
| `--max-minutes <n>` | `MAX_RUNTIME_MINUTES` | 360 | Wall-clock cap for the whole run; checked before each new user |
| `--pace <x>` | `PACE` | 1 | Multiplier for the pauses between actions (0.3 for quick tests) |
| `--seed <n>` | `SEED` | time based | Random seed; the same seed replays the same mix of users and journeys |
| `--block-ga` | `BLOCK_GA=1` | off | Abort GA4 collect requests (they are still counted in the log). For local tests. |
| `--no-keep-awake` | `NO_KEEP_AWAKE=1` | off | Do not keep the machine awake |

At pace 1 a user takes roughly 45 to 75 seconds including the pause between users, so 150 users take about 2 to 3 hours. That is an estimate from local runs at a faster pace; the live site can be slower. The 360-minute cap stops the run if it is.

`npm run sim:seed` regenerates `seeded-players.json` from the mock data (`src/app/core/mock/mock-data.ts`). Only needed if the mock players change.

## Who is simulated

| Share | Type | How they get in |
|---|---|---|
| 70% | Seeded player | Logs in as one of the 24 mock players (`<name>@players.example`, any password); the same account can come back later in the run |
| 20% | New player | Signs up through the registration form (`sim.<run>.<n>@example.test`) |
| 10% | New coach | Signs up through the registration form as a coach |

The split is exact (largest remainder), with at least one of each type when there are 3 or more users, in shuffled order.

Each user gets a fresh browser context: empty localStorage, sessionStorage and cookies, so a new GA4 client ID. The mock backend lives in that browser only, so users never see each other's data.

**A/B arm.** Every first page load carries `?rec_variant=`, so the two arms stay balanced. A seeded player always gets the same arm (by account), so the same `user_id` never appears in both arms; new users alternate.

**Journeys** (weights are relative):

| Player journey | Weight | What happens |
|---|---|---|
| `full_booking` | 28 | Recommended coach > profile > booking request > pay |
| `search_then_book` | 8 | Search, back to the dashboard, recommended coach > book > pay |
| `browse_list_book` | 6 | Coach list (not a recommendation) > profile > book > pay |
| `practice_partner` | 8 | Recommended player > free practice request |
| `abandon_dashboard` | 14 | Sees the recommendations, leaves |
| `abandon_search` | 8 | Searches, leaves |
| `abandon_profile` | 14 | Clicks a recommendation, leaves on the profile |
| `abandon_booking_modal` | 7 | Opens the booking form, closes it |
| `abandon_checkout` | 7 | Sends the request, does not pay |

| Coach journey | Weight | What happens |
|---|---|---|
| `rec_player_book` | 50 | Recommended player > request a session |
| `browse_players_book` | 20 | Players list > profile > request a session |
| `abandon_player_profile` | 20 | Opens a player profile, leaves |
| `abandon_dashboard` | 10 | Sees the recommendations, leaves |

On top of that, 20% of users come back for a repeat visit (new page in the same browser, so the same client ID), and 30% log out at the end. Recommendation clicks favour the top positions (38/24/16/12/10% for positions 1 to 5), so CTR by position has a realistic shape.

Not simulated: `session_request_responded` (nobody receives another simulated user's request, because users share no backend). The Playwright tests cover that event.

## Consent

Before the first page load the script sets `cc_consent=granted` in localStorage with `context.addInitScript`. `index.html` re-applies the stored choice before GTM loads, as it does for a returning visitor. After each first load the script checks that:

- `cc_consent` is `granted`,
- the `consent update` with `analytics_storage: granted` is in the dataLayer before `gtm.js`,
- the consent banner is not shown,
- the GTM container `GTM-M69PG8QQ` has loaded.

A consent failure stops the whole run.

## Stop rules

Nothing is retried. The run stops on:

| Condition | Result |
|---|---|
| Consent not applied | Stop |
| A page outside `BASE_URL` (the app navigated away) | Stop |
| GTM not loaded for the first user | Stop (for later users the journey counts as a failure) |
| Site not loading for the first user, or for 2 users in a row | Stop |
| 3 failed journeys in a row, or 10 in total | Stop |
| A journey runs longer than 6 minutes | That journey fails and its browser closes |
| `MAX_RUNTIME_MINUTES` reached | Stop before the next user |
| Ctrl+C | Stop after the current user; a second Ctrl+C quits at once |

Exit code 0 means all users finished; 1 means the run stopped on a rule above; 2 means a bad option (including a forbidden `BASE_URL`).

## Logs

Each run writes two files to `simulation/logs/` (git-ignored):

- `run-<id>.jsonl`: one line per user. It records type, arm, journey, the steps with their durations, every tracked dataLayer event with its parameters, the GA4 event names seen in collect requests, outcome, error and `missingInGa` (events pushed but not seen in a GA4 request).
- `run-<id>-summary.json`: config, stop reason, counts by type, journey, outcome and event, total GA4 hits and the `missingInGa` totals.

Seeded accounts are logged by their `@players.example` address so a journey can be replayed. Those addresses are synthetic and never reach GA4 (the app's allow-list blocks them). New users get `@example.test` addresses, which can never receive mail.

The console prints one line per user: number, type, journey, arm, outcome, duration and the event sequence.

**Why a page is not closed right away:** gtag batches hits and sends them a moment later. Closing a page immediately after an event lost hits in early test runs, so every visit ends with a 5 to 7 second wait and a close that fires `beforeunload`. `missingInGa` in the log shows whether anything was still lost.
