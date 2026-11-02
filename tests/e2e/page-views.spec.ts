import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { acceptConsent, events, signUp, stubGoogle, waitForEvent } from './helpers';

const pageViews = (page: Page) => events(page, 'page_view_spa');

/** Settle long enough that a duplicate push from the same navigation would have landed. */
const settle = (page: Page) => page.waitForTimeout(400);

test('(d) first load with a redirect produces exactly one page_view_spa', async ({ page }) => {
  await stubGoogle(page);
  await page.goto(''); // '' redirects to /login on the client
  await page.waitForURL(/\/login$/);
  await settle(page);

  const views = await pageViews(page);
  expect(views).toHaveLength(1);
  expect(views[0]).toMatchObject({
    page_path: '/coach-connect-analytics/login',
    page_title: 'Log in | Coach Connect+',
  });
  expect(String(views[0]['page_location'])).toMatch(/^http:\/\/localhost:4300\/coach-connect-analytics\/login$/);
});

test('(d) each route change fires page_view_spa once, never twice', async ({ page }) => {
  await stubGoogle(page);
  await page.goto('');
  await acceptConsent(page);
  await signUp(page);
  await waitForEvent(page, 'view_item_list');
  await settle(page);
  // One load so far: login -> register -> dashboard, each counted once.
  expect((await pageViews(page)).map(v => v['page_path'])).toEqual([
    '/coach-connect-analytics/login',
    '/coach-connect-analytics/register',
    '/coach-connect-analytics/dashboard',
  ]);

  const route = [
    { link: 'Coaches', path: '/coaches', title: 'Find a coach | Coach Connect+' },
    { link: 'Players', path: '/players', title: 'Find a player | Coach Connect+' },
    { link: 'Profile', path: '/profile', title: 'Profile | Coach Connect+' },
    { link: 'Requests', path: '/requests', title: 'Requests | Coach Connect+' },
    { link: 'Dashboard', path: '/dashboard', title: 'Dashboard | Coach Connect+' },
  ];

  for (const step of route) {
    const before = (await pageViews(page)).length;
    await page.getByRole('link', { name: step.link, exact: true }).first().click();
    await page.waitForURL(new RegExp(`${step.path}$`));
    await settle(page);

    const views = await pageViews(page);
    expect(views.length, `after clicking ${step.link}`).toBe(before + 1);
    expect(views.at(-1)).toMatchObject({
      page_path: `/coach-connect-analytics${step.path}`,
      page_title: step.title,
    });
  }

  // Clicking the link of the page you are already on is not a route change.
  const before = (await pageViews(page)).length;
  await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
  await settle(page);
  expect((await pageViews(page)).length).toBe(before);
});

test('(d) a guard redirect counts once, for the final page', async ({ page }) => {
  await stubGoogle(page);
  await page.goto('coaches'); // not logged in: guard sends you to /login
  await page.waitForURL(/\/login$/);
  await settle(page);
  const views = await pageViews(page);
  expect(views).toHaveLength(1);
  expect(views[0]['page_path']).toBe('/coach-connect-analytics/login');
});
