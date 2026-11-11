import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { allParameters, eventLevelKeys, isEcommerce, loadTrackingPlan } from '../../scripts/tracking-plan.mjs';

export interface PlanEntry {
  event: string;
  parameters: string[];
  optionalParameters: string[];
  keyEvent: boolean;
}

export const PLAN: PlanEntry[] = loadTrackingPlan();
export const ECOMMERCE_EVENTS = new Set<string>(PLAN.filter(isEcommerce).map(e => e.event));
/** Keys that describe one event and are reset on every push (EVENT_SCOPED_KEYS in the service). */
export const EVENT_LEVEL_KEYS: string[] = [...new Set(PLAN.flatMap(e => eventLevelKeys(e)))];
export const ownParameters = (event: string): Set<string> =>
  new Set(allParameters(PLAN.find(p => p.event === event)!));

/** Seeded demo players (synthetic @players.example emails), exported by simulation/export-seeded-players.mjs. */
export const SEEDED_PLAYERS: { email: string; skillLevel: number }[] =
  JSON.parse(readFileSync(new URL('../../simulation/seeded-players.json', import.meta.url), 'utf8'));

/** A dataLayer entry. gtag() commands are Arguments objects; we serialise them as arrays. */
export type Entry = Record<string, unknown> | unknown[];

/**
 * Stub Google's endpoints. GTM is answered with an empty script, so the real
 * container never runs and no test traffic reaches the GA4 property. The
 * returned list records which GTM URLs the page asked for.
 */
export async function stubGoogle(page: Page): Promise<string[]> {
  const gtmRequests: string[] = [];
  await page.route(/googletagmanager\.com/, route => {
    gtmRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* stubbed in tests */' });
  });
  await page.route(/google-analytics\.com|analytics\.google\.com|doubleclick\.net/, route => route.abort());
  return gtmRequests;
}

/** Marks keys pushed with an explicit `undefined` (JSON would silently drop them). */
export const UNDEFINED = '__undefined__';

export async function dataLayer(page: Page): Promise<Entry[]> {
  return page.evaluate((marker) =>
    JSON.parse(JSON.stringify(
      ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map(e =>
        Object.prototype.toString.call(e) === '[object Arguments]' ? Array.from(e as ArrayLike<unknown>) : e,
      ),
      (_key, value) => (value === undefined ? marker : value),
    )),
  UNDEFINED);
}

export const isEvent = (e: Entry, name?: string): e is Record<string, unknown> =>
  !Array.isArray(e) && typeof e['event'] === 'string' && (name === undefined || e['event'] === name);

export async function events(page: Page, name: string): Promise<Record<string, unknown>[]> {
  return (await dataLayer(page)).filter((e): e is Record<string, unknown> => isEvent(e, name));
}

/** Wait until at least `count` pushes of `name` exist. */
export async function waitForEvent(page: Page, name: string, count = 1): Promise<void> {
  await expect.poll(async () => (await events(page, name)).length, { message: `waiting for ${name} x${count}` })
    .toBeGreaterThanOrEqual(count);
}

/**
 * Replays the dataLayer the way GTM merges it (objects merged key by key,
 * undefined clears a key) and returns the model as each tracked event saw it.
 */
export function modelAtEvents(dl: Entry[]): { event: Record<string, unknown>; model: Record<string, unknown> }[] {
  const model: Record<string, unknown> = {};
  const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(source)) {
      if (v === UNDEFINED) target[k] = undefined;
      else if (v !== null && typeof v === 'object' && !Array.isArray(v) && k !== 'ecommerce') {
        const inner = (target[k] && typeof target[k] === 'object' ? target[k] : {}) as Record<string, unknown>;
        target[k] = inner;
        merge(inner, v as Record<string, unknown>);
      } else target[k] = v;
    }
  };
  const out: { event: Record<string, unknown>; model: Record<string, unknown> }[] = [];
  for (const entry of dl) {
    if (Array.isArray(entry)) continue;
    merge(model, entry);
    if (isEvent(entry) && !String(entry['event']).startsWith('gtm.')) {
      out.push({ event: entry, model: JSON.parse(JSON.stringify(model)) });
    }
  }
  return out;
}

/**
 * Resolve a tracking-plan path such as `ecommerce.items[].item_id` against an
 * event. `[]` means "every element of the array must have it".
 */
export function missingPaths(event: Record<string, unknown>, paths: string[]): string[] {
  const has = (value: unknown, parts: string[]): boolean => {
    if (parts.length === 0) return value !== undefined && value !== null && value !== '' && value !== UNDEFINED;
    const [head, ...rest] = parts;
    if (head.endsWith('[]')) {
      const arr = (value as Record<string, unknown> | undefined)?.[head.slice(0, -2)];
      return Array.isArray(arr) && arr.length > 0 && arr.every(item => has(item, rest));
    }
    return value !== null && typeof value === 'object' && has((value as Record<string, unknown>)[head], rest);
  };
  return paths.filter(p => !has(event, p.split('.')));
}

export async function acceptConsent(page: Page): Promise<void> {
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('consent-accept')).toBeHidden();
}

/** From the login page, follow the in-app link (no full reload, like a real visitor). */
export async function signUp(page: Page, email = `player.${Date.now()}@example.test`, role: 'Player' | 'Coach' = 'Player'): Promise<void> {
  if (!/\/login$/.test(page.url())) await page.goto('login');
  await page.getByRole('link', { name: 'Create one' }).click();
  await page.waitForURL(/\/register$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('First name').fill('Demo');
  await page.getByLabel('Last name').fill(role);
  await page.getByLabel('Phone number').fill('+000 00 000 000');
  await page.getByLabel('City').selectOption('Skopje');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass-123');
  await page.getByLabel('Confirm password').fill('demo-pass-123');
  if (role === 'Coach') await page.locator('label.role-card:has(input[value="Coach"])').click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/dashboard$/);
}

export async function logIn(page: Page, email: string): Promise<void> {
  if (!/\/login$/.test(page.url())) await page.goto('login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('demo-pass-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard$/);
}

/** In an open booking modal: first club, first free day next month, 10:00, 60 minutes, send. */
export async function sendBookingRequest(page: Page): Promise<void> {
  await page.locator('.club-select').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.locator('.day-btn:not([disabled])').first().click();
  await page.locator('.slot', { hasText: /^\s*10:00\s*$/ }).click();
  await page.getByRole('button', { name: 'Send request' }).click();
}

/**
 * Puts one pending request addressed to the signed-in user into the mock
 * backend's storage, as if another user had sent it. Only this browser's
 * storage is touched: the demo has no shared backend.
 */
export async function seedIncomingRequest(page: Page, from: { id: string; role: 'Player' | 'Coach' }): Promise<string> {
  return page.evaluate(({ id, role }) => {
    const me = JSON.parse(localStorage.getItem('cc_user') ?? 'null') as { userId: string; firstName: string; lastName: string; role: string } | null;
    if (!me) throw new Error('not signed in');
    const requests = JSON.parse(localStorage.getItem('cc_mock_requests') ?? '[]') as unknown[];
    const requestId = crypto.randomUUID();
    const when = new Date(Date.now() + 10 * 86400000);
    when.setHours(10, 0, 0, 0);
    requests.push({
      id: requestId, requesterId: id, requesterFirstName: 'Seeded', requesterLastName: role,
      receiverId: me.userId, receiverFirstName: me.firstName, receiverLastName: me.lastName,
      tennisClubId: 'k-000-0001', tennisClubName: 'Demo club', parentRequestId: null, rescheduleCount: 0,
      status: 'Pending', sessionType: role === 'Coach' || me.role === 'Coach' ? 'CoachPlayer' : 'PlayerPlayer',
      proposedDateTime: when.toISOString(), durationMinutes: 60, note: null,
      createdAt: new Date().toISOString(), estimatedPriceMkd: null,
    });
    localStorage.setItem('cc_mock_requests', JSON.stringify(requests));
    return requestId;
  }, from);
}
