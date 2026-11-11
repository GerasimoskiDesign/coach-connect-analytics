# Measurement plan

Coach Connect+ is a tennis coaching platform: players find coaches, request sessions and pay for them. This repo runs the Angular app against an in-browser mock backend with synthetic data, and measures it with Google Tag Manager (GTM-M69PG8QQ) and GA4 (G-GQKEFPELG9).

This plan links each business goal to the KPIs that track it, the events that feed those KPIs and the GA4 reports where they are read. The event and parameter definitions live in [`tracking_plan.csv`](tracking_plan.csv). That file is the source of truth: the GTM container is generated from it and the Playwright suite checks every dataLayer push against it.

Related docs: [GA4 setup](GA4_SETUP.md), [GTM manual setup](GTM_MANUAL_SETUP.md), [manual steps checklist](MANUAL_STEPS_FOR_MARIO.md).

## 1. Business goals

| # | Goal | Question it answers |
|---|---|---|
| G1 | Grow the player base | How many visitors create an account? |
| G2 | Turn interest into booked sessions | How many players who look at coaches go on to request a session? |
| G3 | Grow revenue from paid coaching | How much revenue do bookings generate per user? |
| G4 | Help players find the right coach | Do recommendations and search lead players to coaches they book? Which ranking algorithm works better? |

## 2. Events

All events are pushed to `window.dataLayer` by one Angular service (`src/app/core/analytics/analytics.service.ts`) and forwarded to GA4 by GTM.

| Event | Fires when | Key event | Feeds goal |
|---|---|---|---|
| `page_view_spa` (sent to GA4 as `page_view`) | Every Angular route change, including the first load | no | all (denominators) |
| `set_user_properties` | App start (once per browser session) and whenever sign-up, login or the player level change the user properties; carries `rec_variant` and, signed in, the account keys (`user_id`, `user_role`, `signup_date`, `player_level`) | no | G4 (A/B split), segments |
| `sign_up` | Registration form succeeded (`method` = `email`) or the demo created the account at the first login (`method` = `auto_login`); `user_role` | yes | G1 |
| `login` | Login with an existing account (`method` = `email`, `user_role`) | no | G1 (returning users) |
| `search` | Coach search submitted with Enter or the Search button (`search_term`, `filter_level`, `filter_city`) | no | G4 |
| `view_item_list` | The 5 recommended coaches (`rec_coaches`) or players (`rec_players`) render on the dashboard, with `rec_algorithm` | no | G4 |
| `select_item` | Click on a recommended coach or player (`index`, `rec_algorithm`, `rec_score`) | no | G4 |
| `view_item` | A coach profile loads (`value` = hourly rate in EUR) | no | G2, G4 |
| `book_session` | Session request sent (`session_request_id`, `interaction_type`, `requester_role`, `receiver_id`, `receiver_role`, `coach_id`, `session_type`, `player_level`, `duration_minutes`, `value`, `currency`, and `rec_list_id` / `rec_algorithm` / `rec_index` when it came from a recommendation) | yes | G2, G4 |
| `session_request_responded` | The receiver accepted, declined or rescheduled a request (`session_request_id`, `response`, `responder_role`, `interaction_type`) | no | G2 |
| `purchase` | Demo payment confirmed on the checkout page (`transaction_id`, `value`, `currency`, `items`, `player_level`; items carry the recommendation list, position and algorithm) | yes | G3, G4 |

Notes on the data:

- `index` in `items` is the 1-based rank shown in the UI, so position 1 is the top card.
- `item_variant` on items holds the coach's level. It is not the A/B variant; the A/B variant is the `rec_variant` user property.
- `session_type` is `coaching` whenever a coach is on either side (also when the coach sent the request; then `coach_id` is the coach's own ID and `value` is the coach's rate) and `practice` for a free player-to-player session (then `coach_id` is `none` and `value` is 0).
- `player_level` on an event is the level band of the player in that session (for a coach's request, the receiving player). The `player_level` user property is the signed-in player's own band.
- `book_session.value` is the price the backend stored for the request (after any loyalty discount). GA4 reports it as key event value, not as revenue. Revenue comes only from `purchase`, so the two never double count.
- `purchase` is deduplicated per `transaction_id`, so reloading the confirmation screen does not report revenue twice.
- Currency is always `EUR`.

## 3. KPIs

GA4 terms used below: **Total users** and **Sessions** are built-in metrics; "users with event X" means Total users filtered to Event name = X (in an exploration, a segment or filter on the event). Custom dimensions must be registered first (see [GA4 setup](GA4_SETUP.md)).

| KPI | Definition | Formula (GA4 terms) | Events used | GA4 dimension / metric | Where to see it |
|---|---|---|---|---|---|
| Sign-up rate | Share of users who create an account | Total users with `sign_up` / Total users | `sign_up`, `page_view` | Event name; Total users; User key event rate (with `sign_up` selected as the key event) | Reports > Engagement > Key events (`sign_up` row, Total users) against Reports > Acquisition > User acquisition (Total users). Free-form exploration for any breakdown. |
| Booking conversion rate | Share of users who send at least one session request | Total users with `book_session` / Total users | `book_session`, `page_view` | Event name; Total users; User key event rate (key event `book_session`); breakdown `session_type` | Reports > Engagement > Key events; Free-form exploration with `session_type` and `rec_variant` as rows. Session-level alternative: Session key event rate with `book_session` selected, in Reports > Acquisition > Traffic acquisition. |
| Recommendation CTR by position | Of the recommended coaches shown in a slot, the share that were clicked | Items clicked in list / Items viewed in list, filtered to Item list ID = `rec_coaches`, split by Item list position. Item impressions come from `view_item_list` items, clicks from `select_item` items. | `view_item_list`, `select_item` | Item list ID; Item list position (from `index`); Items viewed in list; Items clicked in list; Item list click-through rate | Free-form exploration, rows = Item list position (see [GA4 setup, section 9](GA4_SETUP.md#9-free-form-exploration-recommendation-ctr-by-position)) |
| Recommendation CTR by variant | The same click-through rate, compared between the two ranking algorithms | Items clicked in list / Items viewed in list, filtered to Item list ID = `rec_coaches`, split by `rec_variant`. Simpler list-level check: Event count of `select_item` / Event count of `view_item_list`, per `rec_variant`. | `view_item_list`, `select_item`, `set_user_properties` | User-scoped custom dimension `rec_variant`; event-scoped `rec_algorithm` on `select_item`; same item metrics as above | Free-form exploration with `rec_variant` as a column, or two user segments (`rec_variant` = `content_based` / `popularity`) compared side by side |
| Revenue per user | Purchase revenue earned per user | Purchase revenue / Total users | `purchase` | Purchase revenue; Total users; GA4 also offers built-in per-user revenue metrics (search the metric picker for "revenue per") which divide by Active users, so they differ slightly | Reports > Monetization > Overview; Free-form exploration with `rec_variant` rows for the A/B comparison |
| Search-to-booking rate | Of the users who search, the share who later send a session request | Total users who completed `search` then `book_session` / Total users with `search` | `search`, `book_session` | Event name; Total users; Search term; funnel completion rate | Funnel exploration with two steps, `search` then `book_session` (closed funnel). Search term dimension in a Free-form exploration shows what players look for. |

Supporting views that are not KPIs but help explain them:

- **Recommendation funnel**: `view_item_list` > `select_item` > `view_item` > `book_session`, broken down by `rec_variant` (Funnel exploration, see [GA4 setup, section 8](GA4_SETUP.md#8-funnel-exploration-recommendation-funnel)).
- **Average recommendation score of clicked coaches**: custom metric `rec_score` / Event count of `select_item`. GA4 sums custom metrics, so divide by the event count to get an average. Scores are not comparable between variants: each algorithm uses its own 0 to 1 scale.
- **Screens reached**: `page_view` by Page path and screen class or Page title (Reports > Engagement > Pages and screens).

## 4. Reports

| Report | Path | Used for |
|---|---|---|
| Realtime | Reports > Realtime | QA after a release; confirms events arrive |
| Events | Reports > Engagement > Events | Event counts and parameter checks per event |
| Key events | Reports > Engagement > Key events | `sign_up`, `book_session`, `purchase` totals |
| Monetization overview | Reports > Monetization > Overview | Purchase revenue, per-user revenue |
| Funnel exploration | Explore > Funnel exploration | Recommendation funnel and search-to-booking, split by `rec_variant` |
| Free-form exploration | Explore > Free-form | Recommendation CTR by position and variant; `session_type` and `search_term` breakdowns |

## 5. A/B test: recommendation ranking

| Item | Design |
|---|---|
| Hypothesis | Ranking coaches by fit with the player's own profile (`content_based`: skill level group, goals matched to coach specialties, surface, city, coaching style) gets a higher recommendation click-through rate than ranking by popularity (`popularity`: smoothed rating and review volume, the same for every player), and does not reduce bookings. |
| Variants | `content_based` and `popularity`, stored in the `rec_variant` user property. |
| Unit | User, approximated by browser. Assignment happens on the first visit and is persisted in `localStorage` key `cc_rec_variant`, so the unit is one browser on one device. `user_id` is sent while signed in, but the assignment does not follow the account: the same account on two browsers can see both arms. |
| Split | 50/50, random on first visit. |
| QA override | `?rec_variant=popularity` (or `content_based`) in the URL forces a variant and persists it like a normal assignment. In a real product, exclude this traffic with an internal traffic filter. The traffic simulation (`simulation/`) uses the same parameter to keep the arms balanced; in this demo property that synthetic traffic is the data set, so it is not excluded. |
| Primary metric | Recommendation CTR: Items clicked in list / Items viewed in list for Item list ID = `rec_coaches`, per `rec_variant`. |
| Secondary metrics | Booking conversion rate and revenue per user, per `rec_variant`. |
| Guardrails | (1) Sample ratio: Total users per variant should stay close to 50/50; a clear imbalance points to an assignment or tracking problem, and the test should not be read until it is fixed. (2) Booking conversion rate must not drop in the winning variant: more clicks on popular coaches that never get booked is not a win. |
| How to read it in GA4 | Free-form exploration: rows = Item list position, columns = `rec_variant`, values = Items viewed in list, Items clicked in list, Item list click-through rate, filter Item list ID = `rec_coaches`. Then the recommendation funnel broken down by `rec_variant`, and Purchase revenue / Total users per `rec_variant`. If GA4 refuses to combine the user-scoped `rec_variant` with item-scoped metrics, compare two user segments (`rec_variant` exactly matches each value) instead. |

**Statistical significance.** GA4 shows the numbers per variant but does not compute significance or confidence intervals. To call a winner:

1. Fix the sample size before starting. Example: with a 10% baseline CTR, detecting an absolute lift of 2 percentage points at 95% confidence and 80% power needs roughly 3,800 observations per variant. Lower traffic means a longer test, not an earlier decision.
2. Run whole weeks so weekday and weekend behaviour are both covered, and do not stop early because one variant looks ahead.
3. Export the counts per variant (impressions and clicks, or users and converters) and run a two-proportion z-test or chi-square test outside GA4. Clicks from the same user are not independent, so for a strict test compare per-user rates (users who clicked / users who saw the list).
4. Check that GA4 is not applying data thresholds or sampling to the exploration (an icon at the top right of the exploration shows this).

All data in this property is synthetic demo traffic, so any result here demonstrates the method, not a real product finding.

## 6. Consent and what the numbers include

The app uses Consent Mode v2 in advanced mode:

- `src/index.html` sets all four signals (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) to `denied` by default, with `wait_for_update: 500`, before GTM loads.
- A returning visitor's stored choice (`localStorage` key `cc_consent`) is re-applied in the same inline script, still before GTM loads.
- The consent banner sends `gtag('consent', 'update', ...)` for all four signals when the visitor accepts or declines.
- GTM loads for every visitor. Google tags read the consent state themselves, so when `analytics_storage` is denied they send cookieless pings with no client ID cookie instead of normal hits.

What this means for reporting:

- Denied visitors are not dropped, but their pings cannot be tied to a user or session, so they do not show up as normal users in reports.
- Once the property meets Google's eligibility thresholds for behavioural modelling (minimum daily volumes of consented and unconsented traffic over a period, listed in the GA4 help article on behavioural modelling) and the reporting identity is set to Blended, GA4 fills the gap with modelled data. From then on, users, sessions and key events include modelled numbers.
- A low-traffic demo property will most likely never meet those thresholds, so here the reports show consented traffic only.
- For QA, accept consent: DebugView and Realtime are much easier to read with full hits.
