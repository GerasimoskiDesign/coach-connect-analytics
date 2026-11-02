import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isEcommerce, loadTrackingPlan } from '../../scripts/tracking-plan.mjs';

export interface PlanEntry {
  event: string;
  parameters: string[];
  keyEvent: boolean;
}

export const PLAN: PlanEntry[] = loadTrackingPlan();
export const ECOMMERCE_EVENTS = new Set<string>(PLAN.filter(isEcommerce).map(e => e.event));

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
export async function signUp(page: Page, email = `player.${Date.now()}@example.test`): Promise<void> {
  if (!/\/login$/.test(page.url())) await page.goto('login');
  await page.getByRole('link', { name: 'Create one' }).click();
  await page.waitForURL(/\/register$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('First name').fill('Demo');
  await page.getByLabel('Last name').fill('Player');
  await page.getByLabel('Phone number').fill('+000 00 000 000');
  await page.getByLabel('City').selectOption('Skopje');
  await page.getByLabel('Password', { exact: true }).fill('demo-pass-123');
  await page.getByLabel('Confirm password').fill('demo-pass-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/dashboard$/);
}
