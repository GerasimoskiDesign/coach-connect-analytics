import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  ECOMMERCE_EVENTS, EVENT_LEVEL_KEYS, PLAN, acceptConsent, dataLayer, events, isEvent, logIn,
  missingPaths, modelAtEvents, ownParameters, seedIncomingRequest, sendBookingRequest, signUp,
  stubGoogle, waitForEvent,
} from './helpers';
import type { Entry } from './helpers';

// One full visitor journey, recorded once and checked from several angles.
test.describe.configure({ mode: 'serial' });

let page: Page;
let dl: Entry[];
let variant: string | null;
let email: string;
let myId: string;
let requestId: string;
let incomingId: string;

const tracked = () => dl.filter((e): e is Record<string, unknown> => isEvent(e) && !String(e['event']).startsWith('gtm.'));
const only = (name: string) => tracked().filter(e => e['event'] === name);
const one = (name: string) => {
  const list = only(name);
  expect(list, `${name} count`).toHaveLength(1);
  return list[0];
};
const items = (e: Record<string, unknown>) => (e['ecommerce'] as { items: Record<string, unknown>[] }).items;

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await stubGoogle(page);

  email = `journey.${Date.now()}@example.test`;
  await page.goto('');
  await acceptConsent(page);

  // Sign up, land on the dashboard with recommendations.
  await signUp(page, email);
  await waitForEvent(page, 'view_item_list');
  myId = await page.evaluate(() => JSON.parse(localStorage.getItem('cc_user')!).userId);

  // Search for a coach.
  await page.getByRole('link', { name: 'Coaches', exact: true }).click();
  await page.waitForURL(/\/coaches$/);
  await page.getByTestId('filter-city').selectOption({ label: 'Skopje' });
  await page.getByTestId('coach-search-input').fill('serve');
  await page.getByTestId('coach-search-submit').click();
  await waitForEvent(page, 'search');

  // Back to the dashboard and click the top recommendation.
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await waitForEvent(page, 'view_item_list', 2);
  await page.getByTestId('rec-1').click();
  await page.waitForURL(/\/coaches\/[0-9a-f-]+$/);
  await waitForEvent(page, 'view_item');

  // Book a 60 minute session next month.
  await page.getByTestId('request-session').click();
  await sendBookingRequest(page);
  await page.waitForURL(/\/checkout\/[0-9a-f-]+$/);
  await waitForEvent(page, 'book_session');
  requestId = page.url().split('/').at(-1)!;

  // Pay.
  await page.getByTestId('pay-now').click();
  await expect(page.getByTestId('payment-confirmed')).toBeVisible();
  await waitForEvent(page, 'purchase');

  // A coach "sent" this player a request (seeded into this browser's mock storage): accept it.
  const coachId = String(items((await events(page, 'select_item'))[0])[0]['item_id']);
  incomingId = await seedIncomingRequest(page, { id: coachId, role: 'Coach' });
  await page.getByRole('link', { name: 'Requests' }).first().click();
  await page.waitForURL(/\/requests$/);
  await page.getByTestId('request-accept').click();
  await waitForEvent(page, 'session_request_responded');

  // Log out and back in.
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login$/);
  await logIn(page, email);
  await waitForEvent(page, 'login');
  await waitForEvent(page, 'set_user_properties', 3);

  dl = await dataLayer(page);
  variant = await page.evaluate(() => localStorage.getItem('cc_rec_variant'));
});

test.afterAll(async () => {
  await page?.close();
});

test('(b) every tracking-plan event fired with all required parameters', () => {
  const fired = new Set(tracked().map(e => e['event']));
  for (const { event, parameters } of PLAN) {
    expect(fired.has(event), `${event} never fired`).toBe(true);
    for (const e of only(event)) {
      expect(missingPaths(e, parameters), `${event} missing parameters`).toEqual([]);
    }
  }
});

test('(b) no event is pushed that the tracking plan does not define', () => {
  const known = new Set(PLAN.map(p => p.event));
  expect(tracked().map(e => e['event']).filter(n => !known.has(String(n)))).toEqual([]);
});

test('(b) no key outside the tracking plan reaches the dataLayer', () => {
  for (const e of tracked()) {
    const own = ownParameters(String(e['event']));
    const topLevel = new Set([...own].map(p => p.split('.')[0]));
    const extra = Object.keys(e).filter(k => k !== 'event' && !topLevel.has(k) && !EVENT_LEVEL_KEYS.includes(k));
    expect(extra, `${e['event']} carries keys outside the plan`).toEqual([]);
  }
});

test('(b) parameter values are consistent across the funnel', () => {
  expect(variant === 'content_based' || variant === 'popularity').toBe(true);
  expect(one('sign_up')).toMatchObject({ method: 'email', user_role: 'player' });
  expect(one('login')).toMatchObject({ method: 'email', user_role: 'player' });

  const search = one('search');
  expect(search).toMatchObject({ search_term: 'serve', filter_level: 'all', filter_city: 'Skopje' });

  const list = only('view_item_list')[0];
  expect(list['ecommerce']).toMatchObject({ item_list_id: 'rec_coaches', item_list_name: 'Recommended coaches' });
  expect(list['rec_algorithm']).toBe(variant);
  expect(items(list).map(i => i['index'])).toEqual([1, 2, 3, 4, 5]);

  const select = one('select_item');
  expect(select['rec_algorithm']).toBe(variant);
  expect(select['rec_score']).toBeGreaterThan(0);
  expect(select['rec_score']).toBeLessThanOrEqual(1);
  expect(items(select)[0]).toMatchObject({ item_id: items(list)[0]['item_id'], index: 1 });

  const view = one('view_item');
  const coachId = items(select)[0]['item_id'];
  expect(view['ecommerce']).toMatchObject({ currency: 'EUR', value: items(view)[0]['price'] });
  expect(items(view)[0]['item_id']).toBe(coachId);

  const book = one('book_session');
  expect(book).toMatchObject({
    session_request_id: requestId,
    interaction_type: 'player_coach',
    requester_role: 'player',
    receiver_id: coachId,
    receiver_role: 'coach',
    coach_id: coachId,
    session_type: 'coaching',
    player_level: 'intermediate', // new sign-ups get skill level 5
    duration_minutes: 60,
    currency: 'EUR',
    rec_list_id: 'rec_coaches',
    rec_algorithm: variant,
    rec_index: 1,
  });
  expect(book['value']).toBe(items(view)[0]['price']); // 60 minutes at the hourly rate

  const purchase = one('purchase');
  const p = purchase['ecommerce'] as Record<string, unknown>;
  expect(p['transaction_id']).toMatch(/^CC-[0-9A-F]{8}$/);
  expect(p).toMatchObject({ currency: 'EUR', value: book['value'] });
  expect(purchase['player_level']).toBe('intermediate');
  expect(items(purchase)[0]).toMatchObject({
    item_id: coachId, price: book['value'], quantity: 1,
    item_list_id: 'rec_coaches', item_list_name: 'Recommended coaches', index: 1, rec_algorithm: variant,
  });

  expect(one('session_request_responded')).toMatchObject({
    session_request_id: incomingId, response: 'accepted', responder_role: 'player', interaction_type: 'coach_player',
  });
});

test('user ID and user properties: set on sign-up and login, cleared on logout', () => {
  const props = only('set_user_properties');
  // App start (signed out), sign-up (once the player level is known), login again after logout.
  expect(props).toHaveLength(3);
  for (const e of props) expect(e['rec_variant']).toBe(variant);
  expect(props[0]['user']).toEqual({ user_id: '__undefined__', user_role: '__undefined__', signup_date: '__undefined__', player_level: '__undefined__' });
  const account = { user_id: myId, user_role: 'player', signup_date: new Date().toISOString().slice(0, 10), player_level: 'intermediate' };
  expect(props[1]['user']).toEqual(account);
  expect(props[2]['user']).toEqual(account);

  const seen = modelAtEvents(dl);
  const signUpAt = seen.findIndex(s => s.event['event'] === 'sign_up');
  const logoutView = seen.findIndex((s, i) => i > signUpAt && s.event['event'] === 'page_view_spa' && String(s.event['page_path']).endsWith('/login'));
  const loginAt = seen.findIndex(s => s.event['event'] === 'login');
  const userId = (i: number) => (seen[i].model['user'] as Record<string, unknown> | undefined)?.['user_id'];

  expect(seen.slice(0, signUpAt).every((_, i) => userId(i) === undefined)).toBe(true);
  // Every event from sign-up to logout carries the account, sign_up itself included.
  for (let i = signUpAt; i < logoutView; i++) expect(userId(i), String(seen[i].event['event'])).toBe(myId);
  expect(userId(logoutView), 'page view after logout').toBeUndefined();
  expect(userId(loginAt)).toBe(myId);
});

test('no personal data in the dataLayer', () => {
  const text = JSON.stringify(dl);
  expect(text).not.toContain(email);
  expect(text).not.toContain('@');
  expect(text).not.toContain('+000 00 000 000');
  expect(text).not.toContain('Demo Player');
  for (const e of tracked().filter(x => x['ecommerce'])) {
    for (const item of items(e)) expect(String(item['item_name'])).toMatch(/^(Coach|Player) [0-9a-f]{8}$/);
  }
});

test('(c) every ecommerce event is immediately preceded by { ecommerce: null }', () => {
  dl.forEach((entry, i) => {
    if (isEvent(entry) && ECOMMERCE_EVENTS.has(String(entry['event']))) {
      expect(dl[i - 1], `entry before ${entry['event']} at ${i}`).toEqual({ ecommerce: null });
    }
  });
  expect(only('purchase')).toHaveLength(1);
});

test('no stale parameters reach later events in the GTM data model', () => {
  // Replay the pushes the way GTM merges them and check each event only carries
  // its own event-scoped parameters.
  for (const { event, model } of modelAtEvents(dl)) {
    const own = ownParameters(String(event['event']));
    const leaked = EVENT_LEVEL_KEYS.filter(k => !own.has(k) && model[k] !== undefined);
    expect(leaked, `${event['event']} would carry stale ${leaked.join(', ')}`).toEqual([]);
  }
});

test('reloading the confirmation does not send purchase again', async () => {
  const checkoutUrl = (only('page_view_spa').map(e => String(e['page_path'])).find(p => p.includes('/checkout/')))!;
  await page.goto(checkoutUrl.replace('/coach-connect-analytics/', ''));
  await expect(page.getByText('This session is already paid.')).toBeVisible();
  expect((await events(page, 'purchase'))).toHaveLength(0);
});
