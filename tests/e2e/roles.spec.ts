import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  SEEDED_PLAYERS, acceptConsent, events, logIn, seedIncomingRequest, sendBookingRequest, signUp,
  stubGoogle, waitForEvent,
} from './helpers';

// The journeys journey.spec.ts does not cover: a coach booking a player, a
// player booking a practice partner, auto-created accounts, decline and
// reschedule.

const band = (level: number) => (level >= 8 ? 'professional' : level >= 5 ? 'intermediate' : 'amateur');
const lastOf = async (page: Page, name: string) => (await events(page, name)).at(-1)!;
const items = (e: Record<string, unknown>) => (e['ecommerce'] as { items: Record<string, unknown>[] }).items;
const userKeys = async (page: Page) => (await lastOf(page, 'set_user_properties'))['user'] as Record<string, unknown>;

async function start(page: Page): Promise<void> {
  await stubGoogle(page);
  await page.goto('');
  await acceptConsent(page);
}

/** Dashboard: switch the recommendation toggle to players and wait for that list. */
async function showPlayerRecommendations(page: Page): Promise<Record<string, unknown>> {
  await page.getByRole('button', { name: /Players/ }).click();
  await expect.poll(async () => (await events(page, 'view_item_list'))
    .filter(e => (e['ecommerce'] as Record<string, unknown>)['item_list_id'] === 'rec_players').length).toBe(1);
  // The event is pushed before the list re-renders: wait for the links to point at players.
  await expect(page.getByTestId('rec-1')).toHaveAttribute('href', /\/players\//);
  return lastOf(page, 'view_item_list');
}

test('coach signs up and requests a session with a recommended player', async ({ page }) => {
  await start(page);
  await signUp(page, `coach.${Date.now()}@example.test`, 'Coach');
  await waitForEvent(page, 'set_user_properties', 2);

  const coachId = await page.evaluate(() => JSON.parse(localStorage.getItem('cc_user')!).userId as string);
  expect(await lastOf(page, 'sign_up')).toMatchObject({ method: 'email', user_role: 'coach' });
  expect(await userKeys(page)).toEqual({
    user_id: coachId, user_role: 'coach', signup_date: new Date().toISOString().slice(0, 10), player_level: '__undefined__',
  });

  const list = await showPlayerRecommendations(page);
  expect(list).toMatchObject({ rec_algorithm: 'skill_match', ecommerce: { item_list_name: 'Recommended players' } });
  expect(items(list)[0]).toMatchObject({ item_category: 'player', price: 0, index: 1 });

  await page.getByTestId('rec-2').click();
  await page.waitForURL(/\/players\/[0-9a-f-]+$/);
  const select = await lastOf(page, 'select_item');
  expect(select).toMatchObject({ rec_algorithm: 'skill_match', ecommerce: { item_list_id: 'rec_players' } });
  const playerId = String(items(select)[0]['item_id']);
  expect(playerId).toBe(items(list)[1]['item_id']);

  await page.getByTestId('request-session').click();
  await sendBookingRequest(page);
  await waitForEvent(page, 'book_session');

  const book = await lastOf(page, 'book_session');
  expect(book).toMatchObject({
    interaction_type: 'coach_player',
    requester_role: 'coach',
    receiver_id: playerId,
    receiver_role: 'player',
    coach_id: coachId,
    session_type: 'coaching',
    player_level: items(list)[1]['item_variant'],
    duration_minutes: 60,
    currency: 'EUR',
    rec_list_id: 'rec_players',
    rec_algorithm: 'skill_match',
    rec_index: 2,
  });
  expect(book['value']).toBeGreaterThan(0); // priced at the coach's own rate, as in the real backend
  expect(String(book['session_request_id'])).toMatch(/^[0-9a-f-]{36}$/);
});

test('seeded player logs in, books a practice partner (free), no checkout', async ({ page }) => {
  const seeded = SEEDED_PLAYERS[0];
  await start(page);
  await logIn(page, seeded.email);
  await waitForEvent(page, 'set_user_properties', 2);

  expect(await events(page, 'sign_up')).toHaveLength(0);
  expect(await lastOf(page, 'login')).toMatchObject({ method: 'email', user_role: 'player' });
  expect((await userKeys(page))['player_level']).toBe(band(seeded.skillLevel));

  await showPlayerRecommendations(page);
  await page.getByTestId('rec-1').click();
  await page.waitForURL(/\/players\/[0-9a-f-]+$/);
  await page.getByTestId('request-session').click();
  await sendBookingRequest(page);
  await waitForEvent(page, 'book_session');

  expect(await lastOf(page, 'book_session')).toMatchObject({
    interaction_type: 'player_player',
    requester_role: 'player',
    receiver_role: 'player',
    coach_id: 'none',
    session_type: 'practice',
    player_level: band(seeded.skillLevel),
    value: 0,
    rec_list_id: 'rec_players',
    rec_algorithm: 'skill_match',
    rec_index: 1,
  });
  expect(page.url()).toMatch(/\/players\/[0-9a-f-]+$/);
});

test('booking without a recommendation click leaves rec_* empty', async ({ page }) => {
  await start(page);
  await logIn(page, SEEDED_PLAYERS[1].email);
  await page.getByRole('link', { name: 'Coaches', exact: true }).click();
  await page.waitForURL(/\/coaches$/);
  await page.locator('app-coach-card').first().getByRole('button', { name: 'View Profile' }).click();
  await page.waitForURL(/\/coaches\/[0-9a-f-]+$/);
  await page.getByTestId('request-session').click();
  await sendBookingRequest(page);
  await waitForEvent(page, 'book_session');
  expect(await lastOf(page, 'book_session')).toMatchObject({
    interaction_type: 'player_coach', rec_list_id: '', rec_algorithm: '', rec_index: '',
  });
});

test('unknown email at login is a sign_up with method auto_login, not a login', async ({ page }) => {
  await start(page);
  await logIn(page, `walk-in.${Date.now()}@example.test`);
  await waitForEvent(page, 'sign_up');
  expect(await lastOf(page, 'sign_up')).toMatchObject({ method: 'auto_login', user_role: 'player' });
  expect(await events(page, 'login')).toHaveLength(0);
});

test('decline and reschedule fire session_request_responded', async ({ page }) => {
  await start(page);
  await signUp(page, `coach.${Date.now()}@example.test`, 'Coach');
  const player = 'p-seeded-requester';
  await seedIncomingRequest(page, { id: player, role: 'Player' });
  const second = await seedIncomingRequest(page, { id: player, role: 'Player' });

  await page.getByRole('link', { name: 'Requests' }).first().click();
  await page.waitForURL(/\/requests$/);
  await page.getByTestId('request-decline').first().click();
  await waitForEvent(page, 'session_request_responded');
  expect(await lastOf(page, 'session_request_responded')).toMatchObject({
    response: 'declined', responder_role: 'coach', interaction_type: 'player_coach',
  });

  await expect(page.getByTestId('request-reschedule')).toHaveCount(1);
  await page.getByTestId('request-reschedule').click();
  await page.locator('app-reschedule-modal .club-select').selectOption({ index: 1 });
  await page.locator('app-reschedule-modal').getByRole('button', { name: 'Next month' }).click();
  await page.locator('app-reschedule-modal .day-btn:not([disabled])').first().click();
  await page.locator('app-reschedule-modal .slot', { hasText: /^\s*11:00\s*$/ }).click();
  await page.locator('app-reschedule-modal').getByRole('button', { name: /Propose new time/ }).click();
  await waitForEvent(page, 'session_request_responded', 2);
  expect(await lastOf(page, 'session_request_responded')).toMatchObject({
    session_request_id: second, response: 'rescheduled', responder_role: 'coach', interaction_type: 'player_coach',
  });
});
