import { expect, test } from '@playwright/test';
import type { Entry } from './helpers';
import { acceptConsent, dataLayer, signUp, stubGoogle, waitForEvent } from './helpers';

const SIGNALS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];

const consentCommands = (dl: Entry[], kind: 'default' | 'update') =>
  dl.filter((e): e is unknown[] => Array.isArray(e) && e[0] === 'consent' && e[1] === kind)
    .map(e => e[2] as Record<string, unknown>);

test('GTM container script is requested with the right ID', async ({ page }) => {
  const gtm = await stubGoogle(page);
  await page.goto('');
  await waitForEvent(page, 'page_view_spa');
  expect(gtm.some(url => url.includes('gtm.js?id=GTM-M69PG8QQ'))).toBe(true);
});

test('(a) nothing is granted before the visitor accepts', async ({ page }) => {
  await stubGoogle(page);
  await page.goto('');
  await waitForEvent(page, 'page_view_spa');

  let dl = await dataLayer(page);
  const defaults = consentCommands(dl, 'default');
  expect(defaults).toHaveLength(1);
  for (const s of SIGNALS) expect(defaults[0][s]).toBe('denied');
  expect(defaults[0]['wait_for_update']).toBe(500);
  // The consent default is the very first thing in the dataLayer, before GTM's own gtm.js event.
  expect(dl[0]).toEqual(['consent', 'default', defaults[0]]);

  // Browse and sign up without answering the banner: still nothing granted anywhere.
  await signUp(page);
  await waitForEvent(page, 'view_item_list');
  dl = await dataLayer(page);
  expect(JSON.stringify(dl)).not.toContain('granted');
  expect(consentCommands(dl, 'update')).toHaveLength(0);

  // Accept: one update, all four signals granted.
  await acceptConsent(page);
  const updates = consentCommands(await dataLayer(page), 'update');
  expect(updates).toHaveLength(1);
  for (const s of SIGNALS) expect(updates[0][s]).toBe('granted');
});

test('stored choice is re-applied before GTM on the next load', async ({ page }) => {
  await stubGoogle(page);
  await page.goto('');
  await acceptConsent(page);

  await page.reload();
  await waitForEvent(page, 'page_view_spa');
  const dl = await dataLayer(page);
  const updateIndex = dl.findIndex(e => Array.isArray(e) && e[0] === 'consent' && e[1] === 'update');
  const gtmIndex = dl.findIndex(e => !Array.isArray(e) && e['event'] === 'gtm.js');
  expect(updateIndex).toBeGreaterThan(0);
  expect(updateIndex).toBeLessThan(gtmIndex);
  await expect(page.getByTestId('consent-accept')).toHaveCount(0);
});

test('decline sends denied for all signals and is remembered', async ({ page }) => {
  await stubGoogle(page);
  await page.goto('');
  await page.getByTestId('consent-decline').click();

  const updates = consentCommands(await dataLayer(page), 'update');
  expect(updates).toHaveLength(1);
  for (const s of SIGNALS) expect(updates[0][s]).toBe('denied');

  await page.reload();
  await waitForEvent(page, 'page_view_spa');
  await expect(page.getByTestId('consent-decline')).toHaveCount(0);
  expect(JSON.stringify(await dataLayer(page))).not.toContain('granted');
});
