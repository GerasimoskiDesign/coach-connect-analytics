# GA4 setup

Step-by-step configuration of the GA4 property that receives data from this app.

| Setting | Value |
|---|---|
| Measurement ID | `G-GQKEFPELG9` |
| Web stream URL | `https://gerasimoskidesign.github.io` |
| Live app | https://gerasimoskidesign.github.io/coach-connect-analytics/ |
| GTM container | `GTM-M69PG8QQ` (see [GTM manual setup](GTM_MANUAL_SETUP.md)) |
| Currency | EUR |

Click paths use the current GA4 Admin layout, where property settings are grouped under **Data collection and modification** and **Data display**. Google renames labels from time to time; where a label is uncertain, this guide says what to search for instead.

The KPIs these settings support are defined in the [measurement plan](measurement_plan.md).

## 1. Confirm the web stream

1. Admin (gear icon, bottom left) > **Data collection and modification** > **Data streams**.
2. Open the web stream. Check that **Stream URL** is `https://gerasimoskidesign.github.io` and **Measurement ID** is `G-GQKEFPELG9`.

The app lives under the `/coach-connect-analytics/` path on that domain. The stream URL only needs the domain.

## 2. Enhanced measurement

In the same web stream, find **Enhanced measurement** and click the gear icon.

1. **Page views** > **Show advanced settings**.
2. Turn **Page changes based on browser history events** OFF.
3. Click **Save**.

Why: the app is a single-page application. GTM sends one `page_view` for every Angular route change (the app pushes `page_view_spa`, and a GTM lookup table renames it to `page_view`). The Google tag also has `send_page_view` set to `false`, so the first load is not counted twice either. If history-based page changes stay on, GA4 adds its own `page_view` on every route change and each screen is counted twice.

Leave the other enhanced measurement toggles as they are. One optional change: **Site search** can be turned off. Search is tracked explicitly with the `search` event when the visitor submits the search box, and the app does not put the search term in the URL, so site search adds nothing.

## 3. Key events

Mark `sign_up`, `book_session` and `purchase` as key events.

**After the events have been received once** (run the journey from section 7 first):

1. Admin > **Data display** > **Events**.
2. Find `sign_up`, `book_session` and `purchase` in the list.
3. Turn on **Mark as key event** for each of the three.

GA4 often marks `purchase` as a key event by default; confirm it is on.

**Before the events have been received** (alternative):

1. Admin > **Data display** > **Key events** > **New key event**.
2. Type the event name exactly (`sign_up`, `book_session`, `purchase`) and save. Repeat for each.

Key event names are case sensitive and must match the tracking plan exactly. Key event status only applies to data received from the moment it is set; it does not convert past events.

## 4. Custom dimensions and metric

Admin > **Data display** > **Custom definitions**.

**Custom dimensions** tab > **Create custom dimension**, once per row:

| Dimension name | Scope | Description | Event parameter / User property |
|---|---|---|---|
| `rec_algorithm` | Event | Ranking algorithm behind a clicked recommendation (`select_item`) | Event parameter: `rec_algorithm` |
| `session_type` | Event | `coaching` (paid coach session) or `practice` (free player-to-player) on `book_session` | Event parameter: `session_type` |
| `search_term` | Event | Text submitted in the coach search on `search` | Event parameter: `search_term` |
| `rec_variant` | User | A/B variant of the recommendation ranking: `content_based` or `popularity` | User property: `rec_variant` |

Note on `search_term`: GA4 also fills its built-in **Search term** dimension from the `search` event. Registering the custom dimension keeps the name consistent with the tracking plan. If GA4 rejects or warns about the name, use the built-in dimension instead.

**Custom metrics** tab > **Create custom metric**:

| Metric name | Scope | Description | Event parameter | Unit of measurement |
|---|---|---|---|---|
| `rec_score` | Event | Score (0 to 1) of the clicked recommendation on `select_item` | `rec_score` | Standard |

Important:

- Custom dimensions and metrics only have data from the moment they are registered. Register them before the data you want to analyse is collected.
- New definitions can take up to 24 to 48 hours to appear in reports and explorations.
- GA4 sums custom metrics. For an average score per click, divide `rec_score` by the event count of `select_item`.

## 5. Data retention

1. Admin > **Data collection and modification** > **Data retention**.
2. Set **Event data retention** to **14 months** (the maximum for a standard property).
3. Click **Save**.

Retention limits how far back explorations can go. Standard reports are not affected.

## 6. Exclude internal and test traffic

QA sessions (including browsers forced into a variant with `?rec_variant=`) should not count in the A/B test.

1. Define the traffic: Admin > **Data collection and modification** > **Data streams** > web stream > **Configure tag settings** > expand the settings list (**Show more** or **Show all**) > **Define internal traffic** > **Create**. Give the rule a name, keep `traffic_type` = `internal`, and add a rule for your IP address.
2. Activate the filter: Admin > **Data collection and modification** > **Data filters**. Open the **Internal Traffic** filter, check it in the **Testing** state first, then change the state to **Active**.

Filters apply from the moment they are active and permanently exclude matching data. The **Developer traffic** filter in the same list can exclude debug-mode events (GTM Preview traffic) from reports in the same way.

## 7. Testing: GTM Preview and GA4 DebugView

1. In GTM, open the workspace and click **Preview**. Enter `https://gerasimoskidesign.github.io/coach-connect-analytics/` and click **Connect**. The app opens in a new tab with Tag Assistant connected.
2. In GA4, open Admin > **Data display** > **DebugView**. GTM Preview sets debug mode automatically, so the session appears there. Pick your device in the device selector at the top if more than one is listed.
3. Walk the journey: accept the consent banner, sign up, search for a coach, go back to the dashboard and click a recommendation, request a session, pay on the checkout page.

What to check, per event:

| Event | In Tag Assistant (GTM) | In DebugView (GA4) |
|---|---|---|
| Page load | `Google tag - GA4` fires on Initialization, once per page load. Consent tab: default `denied` for all four signals, then `granted` after accepting. | No automatic `page_view` from the Google tag |
| `page_view_spa` | `GA4 - Event - Custom and recommended` fires | Arrives as `page_view` with `page_location` and `page_title`, exactly once per route change |
| `set_user_properties` | `GA4 - Event - Custom and recommended` fires | User property `rec_variant` = `content_based` or `popularity` (shown in the user properties panel) |
| `sign_up` | Custom and recommended tag fires | `method` = `email`; marked as a key event once section 3 is done |
| `search` | Custom and recommended tag fires | `search_term`, `filter_level`, `filter_city` |
| `view_item_list` | `GA4 - Event - Ecommerce` fires | 5 items, `item_list_id` = `recommended_coaches`, `index` 1 to 5 |
| `select_item` | Ecommerce tag fires | One item with the clicked `index`; `rec_algorithm` equals the `rec_variant` value; `rec_score` between 0 and 1 |
| `view_item` | Ecommerce tag fires | `currency` = `EUR`, `value` = coach hourly rate, one item |
| `book_session` | Custom and recommended tag fires; ecommerce tag does not | `coach_id`, `session_type`, `value`, `currency` = `EUR`; no items attached |
| `purchase` | Ecommerce tag fires | `transaction_id` (format `CC-` plus 8 hex characters), `value`, `currency` = `EUR`, one item with `quantity` 1 |

Also check that no event carries a parameter from an earlier event (for example `search_term` on `book_session`). The app clears event-scoped keys on every push to prevent this.

To test the other variant, open the app with `?rec_variant=popularity` (or `?rec_variant=content_based`) in the URL. The choice is persisted in `localStorage` key `cc_rec_variant`.

### Realtime

Reports > **Realtime**. Within a minute of the journey you should see your events in the event count card (by Event name) and `sign_up`, `book_session` and `purchase` in the key events card once they are marked. Realtime is a quick arrival check; use DebugView to inspect parameters.

## 8. Funnel exploration: recommendation funnel

Prerequisite: the `rec_variant` custom dimension is registered (section 4). Data for it only exists from the registration date onward, so build this after 24 to 48 hours of traffic.

1. **Explore** > **Funnel exploration**.
2. Set the date range to start on or after the day `rec_variant` was registered.
3. **Steps** > edit (pencil icon) and add four steps, each with the condition Event name exactly matches:
   1. `view_item_list`
   2. `select_item`
   3. `view_item`
   4. `book_session`
4. Leave **Make open funnel** OFF (closed funnel: users must enter at step 1).
5. **Dimensions** > **+** > import the custom dimension `rec_variant` (search for "rec_variant"), then drag it into **Breakdown**.
6. No list filter is needed: `view_item_list` only fires for the recommendation list.

Reading it: the completion rate of step 1 to step 2 per `rec_variant` is the list-level recommendation click rate; step 3 to step 4 shows whether those profile visits turn into bookings.

The same template with two steps (`search` then `book_session`) gives the search-to-booking rate.

## 9. Free-form exploration: recommendation CTR by position

GA4 stores the `index` of each item as the item-scoped dimension **Item list position**. Together with the item-scoped list metrics it gives click-through rate per slot directly.

1. **Explore** > **Free-form** (blank exploration).
2. **Dimensions** > **+** and import: Item list position, Item list ID, Item list name, and the custom dimension `rec_variant`.
3. **Metrics** > **+** and import: Items viewed in list, Items clicked in list, Item list click-through rate. If a label differs, search the picker for "list" or "click" and pick the item list metrics.
4. **Rows**: Item list position.
5. **Values**: Items viewed in list, Items clicked in list, Item list click-through rate.
6. **Filters**: Item list ID exactly matches `recommended_coaches`.
7. **Variant breakdown**: drag `rec_variant` into **Columns**.

If GA4 marks `rec_variant` as incompatible with the item-scoped metrics, remove it from Columns and use segments instead:

1. **Segments** > **+** > **User segment**.
2. Condition: `rec_variant` exactly matches `content_based`. Save. Repeat for `popularity`.
3. Apply both segments to the exploration. Each segment gets its own set of columns.

Item list position, the item metrics and Item list ID are built-in, so they work for all data collected since the app went live. Only the `rec_variant` split depends on the custom dimension registration date.

For significance testing and how to read the result, see the A/B test section of the [measurement plan](measurement_plan.md#5-ab-test-recommendation-ranking).
