import { Page, expect, test } from '@playwright/test';
import {
  ECOMMERCE_EVENTS, Entry, PLAN, UNDEFINED, acceptConsent, dataLayer, events, isEvent,
  missingPaths, signUp, stubGoogle, waitForEvent,
} from './helpers';

// One full visitor journey, recorded once and checked from several angles.
test.describe.configure({ mode: 'serial' });

let page: Page;
let dl: Entry[];
let variant: string | null;

const tracked = () => dl.filter((e): e is Record<string, unknown> => isEvent(e) && !String(e['event']).startsWith('gtm.'));
const only = (name: string) => tracked().filter(e => e['event'] === name);
const one = (name: string) => {
  const list = only(name);
  expect(list, `${name} count`).toHaveLength(1);
  return list[0];
};
const items = (e: Record<string, unknown>) => (e['ecommerce'] as { items: Record<string, unknown>[] }).items;

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await stubGoogle(page);

  const email = `journey.${Date.now()}@example.test`;
  await page.goto('');
  await acceptConsent(page);

  // Sign up, land on the dashboard with recommendations.
  await signUp(page, email);
  await waitForEvent(page, 'view_item_list');

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
  await page.locator('.club-select').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.locator('.day-btn:not([disabled])').first().click();
  await page.locator('.slot', { hasText: /^\s*10:00\s*$/ }).click();
  await page.getByRole('button', { name: 'Send request' }).click();
  await page.waitForURL(/\/checkout\/[0-9a-f-]+$/);
  await waitForEvent(page, 'book_session');

  // Pay.
  await page.getByTestId('pay-now').click();
  await expect(page.getByTestId('payment-confirmed')).toBeVisible();
  await waitForEvent(page, 'purchase');

  // Log out and back in.
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('demo-pass-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard$/);
  await waitForEvent(page, 'login');

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

test('(b) parameter values are consistent across the funnel', () => {
  expect(variant === 'content_based' || variant === 'popularity').toBe(true);
  expect(one('set_user_properties')['rec_variant']).toBe(variant);
  expect(one('sign_up')['method']).toBe('email');
  expect(one('login')['method']).toBe('email');

  const search = one('search');
  expect(search).toMatchObject({ search_term: 'serve', filter_level: 'all', filter_city: 'Skopje' });

  const list = only('view_item_list')[0];
  expect(list['ecommerce']).toMatchObject({ item_list_id: 'recommended_coaches', item_list_name: 'Recommended coaches' });
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
  expect(book).toMatchObject({ coach_id: coachId, session_type: 'coaching', currency: 'EUR' });
  expect(book['value']).toBe(items(view)[0]['price']); // 60 minutes at the hourly rate

  const purchase = one('purchase');
  const p = purchase['ecommerce'] as Record<string, unknown>;
  expect(p['transaction_id']).toMatch(/^CC-[0-9A-F]{8}$/);
  expect(p).toMatchObject({ currency: 'EUR', value: book['value'] });
  expect(items(purchase)[0]).toMatchObject({ item_id: coachId, price: book['value'], quantity: 1 });
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
  const scoped = ['method', 'search_term', 'filter_level', 'filter_city', 'rec_algorithm',
    'rec_score', 'coach_id', 'session_type', 'value', 'currency'];
  const model: Record<string, unknown> = {};
  for (const entry of dl) {
    if (Array.isArray(entry)) continue;
    for (const [k, v] of Object.entries(entry)) model[k] = v === UNDEFINED ? undefined : v;
    if (!isEvent(entry) || String(entry['event']).startsWith('gtm.')) continue;
    const own = new Set(PLAN.find(p => p.event === entry['event'])!.parameters);
    const leaked = scoped.filter(k => !own.has(k) && model[k] !== undefined);
    expect(leaked, `${entry['event']} would carry stale ${leaked.join(', ')}`).toEqual([]);
  }
});

test('reloading the confirmation does not send purchase again', async () => {
  const checkoutUrl = (only('page_view_spa').map(e => String(e['page_path'])).find(p => p.includes('/checkout/')))!;
  await page.goto(checkoutUrl.replace('/coach-connect-analytics/', ''));
  await expect(page.getByText('This session is already paid.')).toBeVisible();
  expect((await events(page, 'purchase'))).toHaveLength(0);
});
