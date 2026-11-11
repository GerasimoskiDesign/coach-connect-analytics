// Coach Connect+ traffic simulation for GA4. Drives the real app in a headed
// Chromium, one fresh browser context per simulated user, with analytics
// consent granted, so Google Tag Manager sends the events to GA4.
//
//   node simulation/simulate.mjs [options]          (see --help or simulation/README.md)
//
// Safety rails: only the live demo URL or a localhost URL can be targeted; hard
// caps on users, events per user and runtime; the run stops on a consent
// failure, on leaving the site and on repeated errors; nothing is retried.

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://gerasimoskidesign.github.io/coach-connect-analytics/';
const GTM_ID = 'GTM-M69PG8QQ';
const GA_COLLECT = /^https:\/\/([a-z0-9-]+\.)*(google-analytics\.com|analytics\.google\.com)\/g\/collect/;

// ── Options ──────────────────────────────────────────────────────────────────

const HELP = `
Usage: node simulation/simulate.mjs [options]

  --base-url <url>      Site to drive. Default ${LIVE_URL}
                        Only that URL or http://localhost / http://127.0.0.1 are accepted.   (env BASE_URL)
  --max-users <n>       Simulated users, default 150                                          (env MAX_USERS)
  --max-events <n>      Tracked dataLayer events per user before the journey stops, default 40 (env MAX_EVENTS_PER_USER)
  --max-minutes <n>     Wall-clock cap for the whole run, default 360                          (env MAX_RUNTIME_MINUTES)
  --pace <x>            Multiplier for the pauses between actions, default 1 (0.3 = fast test) (env PACE)
  --seed <n>            Random seed, to replay the same mix of journeys                        (env SEED)
  --block-ga            Abort GA4 collect requests (still logged). For local tests, so test
                        traffic never reaches the GA4 property.                                (env BLOCK_GA=1)
  --no-keep-awake       Do not keep the machine awake                                          (env NO_KEEP_AWAKE=1)
`;

const { values: opt } = parseArgs({
  options: {
    'base-url': { type: 'string' }, 'max-users': { type: 'string' }, 'max-events': { type: 'string' },
    'max-minutes': { type: 'string' }, pace: { type: 'string' }, seed: { type: 'string' },
    'block-ga': { type: 'boolean' }, 'no-keep-awake': { type: 'boolean' }, help: { type: 'boolean' },
  },
});
if (opt.help) { console.log(HELP); process.exit(0); }

const env = process.env;
const positiveInt = (v, fallback, name) => {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) stop(`${name} must be a positive integer, got "${v}"`);
  return n;
};

const cfg = {
  baseUrl: checkedBaseUrl(opt['base-url'] ?? env.BASE_URL ?? LIVE_URL),
  maxUsers: positiveInt(opt['max-users'] ?? env.MAX_USERS, 150, 'MAX_USERS'),
  maxEvents: positiveInt(opt['max-events'] ?? env.MAX_EVENTS_PER_USER, 40, 'MAX_EVENTS_PER_USER'),
  maxMinutes: positiveInt(opt['max-minutes'] ?? env.MAX_RUNTIME_MINUTES, 360, 'MAX_RUNTIME_MINUTES'),
  pace: Number(opt.pace ?? env.PACE ?? 1),
  seed: positiveInt(opt.seed ?? env.SEED, Date.now() % 2147483647, 'SEED'),
  blockGa: Boolean(opt['block-ga'] || env.BLOCK_GA === '1'),
  keepAwake: !(opt['no-keep-awake'] || env.NO_KEEP_AWAKE === '1'),
  maxConsecutiveFailures: 3,
  maxTotalFailures: 10,
  userTimeoutMs: 6 * 60_000,
};
if (!(cfg.pace >= 0)) stop(`PACE must be a number >= 0, got "${opt.pace ?? env.PACE}"`);

function checkedBaseUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { stop(`BASE_URL is not a URL: ${raw}`); }
  u.search = ''; u.hash = '';
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  const url = u.toString();
  const local = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (url !== LIVE_URL && !local) stop(`Refusing to target ${url}. Allowed: ${LIVE_URL} or a localhost URL.`);
  return url;
}

function stop(message) {
  console.error(`\n[sim] ${message}`);
  process.exit(2);
}

// ── Randomness (seeded, so a run can be replayed) ────────────────────────────

let rngState = cfg.seed >>> 0;
const rand = () => {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p) => rand() < p;
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
/** weights: { key: weight } -> key */
const weighted = (weights) => {
  const entries = Object.entries(weights);
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
  return entries.at(-1)[0];
};
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ── Mix of users ─────────────────────────────────────────────────────────────

const SEEDED = JSON.parse(readFileSync(join(HERE, 'seeded-players.json'), 'utf8'));
const MIX = { seeded_player: 0.7, new_player: 0.2, new_coach: 0.1 };

/** Exact proportions (largest remainder), at least one of each type when there are 3+ users, shuffled. */
function schedule(n) {
  const types = Object.keys(MIX);
  const counts = Object.fromEntries(types.map(t => [t, Math.floor(MIX[t] * n)]));
  if (n >= types.length) for (const t of types) counts[t] = Math.max(1, counts[t]);
  let left = n - Object.values(counts).reduce((a, b) => a + b, 0);
  const byRemainder = [...types].sort((a, b) => (MIX[b] * n % 1) - (MIX[a] * n % 1));
  for (let i = 0; left > 0; i++, left--) counts[byRemainder[i % types.length]]++;
  while (Object.values(counts).reduce((a, b) => a + b, 0) > n) counts.seeded_player--;
  return shuffle(types.flatMap(t => Array(counts[t]).fill(t)));
}

const VARIANTS = ['content_based', 'popularity'];
let newUserVariant = 0;
/** Seeded players keep one arm for the whole run (same user_id, same variant); new users alternate. */
const variantFor = (type, seededIndex) =>
  type === 'seeded_player' ? VARIANTS[seededIndex % 2] : VARIANTS[newUserVariant++ % 2];

const PLAYER_JOURNEYS = {
  full_booking: 28,          // recommendation -> profile -> book -> pay
  search_then_book: 8,       // search, then a recommendation -> book -> pay
  browse_list_book: 6,       // coach list (not a recommendation) -> book -> pay
  practice_partner: 8,       // recommended player -> free practice request
  abandon_dashboard: 14,     // sees recommendations, leaves
  abandon_search: 8,         // searches, leaves
  abandon_profile: 14,       // clicks a recommendation, leaves on the profile
  abandon_booking_modal: 7,  // opens the booking form, closes it
  abandon_checkout: 7,       // sends the request, does not pay
};
const COACH_JOURNEYS = {
  rec_player_book: 50,       // recommended player -> request a session
  browse_players_book: 20,   // players list -> request a session
  abandon_player_profile: 20,
  abandon_dashboard: 10,
};
const REC_POSITION = { 1: 38, 2: 24, 3: 16, 4: 12, 5: 10 };
const DURATION_INDEX = { 0: 50, 1: 28, 2: 14, 3: 4, 4: 4 };   // 60, 90, 120, 150, 180 minutes
const SEARCH_TERMS = ['serve', 'forehand', 'backhand', 'footwork', 'fitness', 'tournament', 'beginner', 'clay', 'technique', ''];

// ── Run state and log ────────────────────────────────────────────────────────

const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const LOG_DIR = join(HERE, 'logs');
mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = join(LOG_DIR, `run-${runId}.jsonl`);
const SUMMARY_FILE = join(LOG_DIR, `run-${runId}-summary.json`);
const log = (record) => appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');

class Fatal extends Error {}
class EventCap extends Error {}
class LoadError extends Error {}

const startedAt = Date.now();
const deadline = startedAt + cfg.maxMinutes * 60_000;
const summary = {
  runId, config: { ...cfg }, startedAt: new Date(startedAt).toISOString(), finishedAt: null, stopReason: null,
  users: 0, byType: {}, byJourney: {}, outcomes: {}, events: {}, gaHits: 0, gaEvents: {}, missingInGa: {}, failures: 0,
};
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };

// ── Keep the machine awake ───────────────────────────────────────────────────

function keepAwake() {
  if (!cfg.keepAwake) return null;
  if (process.platform === 'win32') {
    // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED, held while this process lives.
    const ps = `
      $sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
      $k = Add-Type -MemberDefinition $sig -Name Power -Namespace CcSim -PassThru
      [void]$k::SetThreadExecutionState([uint32]2147483651)
      while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 30 }`;
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    return spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'ignore', windowsHide: true });
  }
  if (process.platform === 'darwin') return spawn('caffeinate', ['-dims', '-w', String(process.pid)], { stdio: 'ignore' });
  console.log('[sim] keep-awake is only implemented for Windows and macOS; make sure this machine does not sleep.');
  return null;
}

// ── Page helpers ─────────────────────────────────────────────────────────────

const pause = (page, minMs, maxMs) => page.waitForTimeout(Math.round(between(minMs, maxMs) * cfg.pace));

/**
 * gtag batches hits and sends them a few seconds later, or when the page is
 * hidden. Closing a page right after the last action loses those hits, so stay
 * a moment (not scaled by --pace) and close with unload handlers, which makes
 * gtag flush.
 */
async function leavePage(page) {
  await page.waitForTimeout(between(5000, 7000)).catch(() => {});
  await page.close({ runBeforeUnload: true }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
}

/** dataLayer events that GTM should have sent to GA4 but that no collect request carried. */
function missingInGa(journey) {
  const sent = {};
  for (const en of journey.gaEvents) sent[en] = (sent[en] ?? 0) + 1;
  const missing = {};
  for (const e of journey.events) {
    const name = e.event === 'page_view_spa' ? 'page_view' : e.event;
    if (sent[name] > 0) sent[name]--;
    else missing[name] = (missing[name] ?? 0) + 1;
  }
  return missing;
}

/** Tracked events pushed to window.dataLayer since `from` (gtm.* and gtag commands excluded). */
async function newEvents(page, from) {
  return page.evaluate((start) => {
    const dl = window.dataLayer || [];
    const out = [];
    for (let i = start; i < dl.length; i++) {
      const e = dl[i];
      if (!e || Object.prototype.toString.call(e) === '[object Arguments]') continue;
      if (typeof e.event !== 'string' || e.event.startsWith('gtm.')) continue;
      const compact = {};
      for (const [k, v] of Object.entries(e)) {
        if (v === undefined) continue;
        if (k === 'ecommerce' && v) {
          const items = Array.isArray(v.items) ? v.items : [];
          compact.ecommerce = {
            item_list_id: v.item_list_id, transaction_id: v.transaction_id, value: v.value, items: items.length,
            first_item: items[0] ? { item_id: items[0].item_id, index: items[0].index, item_list_id: items[0].item_list_id, rec_algorithm: items[0].rec_algorithm } : undefined,
          };
        } else compact[k] = v;
      }
      out.push(compact);
    }
    return { events: out, length: dl.length };
  }, from);
}

function assertOnSite(page) {
  const url = page.url();
  if (url !== 'about:blank' && !url.startsWith(cfg.baseUrl)) throw new Fatal(`left the site: ${url}`);
}

async function load(page, path, variant) {
  const url = new URL(path, cfg.baseUrl);
  if (variant) url.searchParams.set('rec_variant', variant);
  try {
    const res = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (res && !res.ok() && res.status() !== 404) throw new Error(`HTTP ${res.status()}`); // 404.html is the SPA fallback
    // Angular has rendered when the router outlet has a page next to it.
    await page.waitForFunction(() => document.querySelector('app-root > router-outlet + *') !== null, null, { timeout: 30_000 });
  } catch (e) {
    throw new LoadError(`page not loading (${url.pathname}): ${e.message.split('\n')[0]}`);
  }
  assertOnSite(page);
}

/** Consent must be granted before GTM starts, and the banner must not be shown. */
async function checkConsentAndGtm(page, journey) {
  const state = await page.evaluate(() => {
    const dl = window.dataLayer || [];
    const isArgs = (e) => Object.prototype.toString.call(e) === '[object Arguments]';
    let stored = null;
    try { stored = localStorage.getItem('cc_consent'); } catch { /* ignore */ }
    return {
      stored,
      update: dl.findIndex(e => isArgs(e) && e[0] === 'consent' && e[1] === 'update' && e[2] && e[2].analytics_storage === 'granted'),
      gtm: dl.findIndex(e => e && e.event === 'gtm.js'),
    };
  });
  const banner = await page.getByTestId('consent-accept').count();
  if (state.stored !== 'granted' || state.update < 0 || state.update > state.gtm || banner > 0) {
    throw new Fatal(`consent not applied (stored=${state.stored}, update@${state.update}, gtm.js@${state.gtm}, banner=${banner})`);
  }
  try {
    await page.waitForFunction((id) => Boolean(window.google_tag_manager && window.google_tag_manager[id]), GTM_ID, { timeout: 20_000 });
  } catch {
    const message = `GTM container ${GTM_ID} did not load`;
    if (journey.n === 1) throw new Fatal(message);
    throw new Error(message);
  }
}

// ── One simulated user ───────────────────────────────────────────────────────

async function simulateUser(browser, n, type) {
  const seededIndex = type === 'seeded_player' ? Math.floor(rand() * SEEDED.length) : -1;
  const variant = variantFor(type, seededIndex);
  const role = type === 'new_coach' ? 'Coach' : 'Player';
  const journeyName = role === 'Coach' ? weighted(COACH_JOURNEYS) : weighted(PLAYER_JOURNEYS);
  const repeatVisit = chance(0.2);
  const logoutAtEnd = chance(0.3);

  const journey = {
    n, type, variant, journey: journeyName, repeatVisit, logoutAtEnd,
    account: type === 'seeded_player' ? SEEDED[seededIndex].email : `sim.${runId}.${n}@example.test`,
    steps: [], events: [], gaEvents: [], pageErrors: [], outcome: null, error: null, ms: 0,
  };

  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-GB', timezoneId: 'Europe/Skopje' });
  // Consent before the first page load: index.html re-applies it before GTM starts.
  await context.addInitScript(() => { try { window.localStorage.setItem('cc_consent', 'granted'); } catch { /* ignore */ } });
  context.on('request', req => {
    if (!GA_COLLECT.test(req.url())) return;
    const lines = [new URL(req.url()).search.slice(1), ...(req.postData() ?? '').split('\n')];
    for (const line of lines) {
      const en = new URLSearchParams(line).get('en');
      if (en) journey.gaEvents.push(en);
    }
  });
  if (cfg.blockGa) await context.route(GA_COLLECT, route => route.abort());

  let page = await context.newPage();
  let dlIndex = 0;
  const watch = (p) => p.on('pageerror', e => journey.pageErrors.push(e.message.slice(0, 200)));
  watch(page);

  const sync = async () => {
    const { events, length } = await newEvents(page, dlIndex);
    dlIndex = length;
    journey.events.push(...events);
    if (journey.events.length >= cfg.maxEvents) throw new EventCap(`${journey.events.length} events`);
  };
  const step = async (name, fn) => {
    const t = Date.now();
    journey.steps.push(name);
    await fn();
    assertOnSite(page);
    await sync();
    journey.steps[journey.steps.length - 1] = `${name} (${Date.now() - t} ms)`;
  };
  // Only events pushed since the current step started count.
  const waitFor = async (event, predicate = () => true, timeout = 15_000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const { events } = await newEvents(page, dlIndex);
      if (events.some(e => e.event === event && predicate(e))) return;
      await page.waitForTimeout(150);
    }
    throw new Error(`${event} was not pushed`);
  };

  // Reusable pieces of a journey.
  const dashboardRecs = async () => {
    await waitFor('view_item_list', e => e.ecommerce?.item_list_id === 'rec_coaches');
    await page.getByTestId('rec-1').waitFor();
  };
  const togglePlayers = async () => {
    await page.getByRole('button', { name: /Players/ }).click();
    await waitFor('view_item_list', e => e.ecommerce?.item_list_id === 'rec_players');
    await page.waitForFunction(() => document.querySelector('[data-testid="rec-1"]')?.getAttribute('href')?.includes('/players/'));
  };
  const clickRec = async (kind) => {
    const pos = Number(weighted(REC_POSITION));
    await page.getByTestId(`rec-${pos}`).click();
    await page.waitForURL(kind === 'coach' ? /\/coaches\/[0-9a-f-]+$/ : /\/players\/[0-9a-f-]+$/, { timeout: 15_000 });
    if (kind === 'coach') await waitFor('view_item');
    return pos;
  };
  const openBooking = async () => {
    const button = page.getByTestId('request-session');
    if (await button.count() === 0) return false; // e.g. coach not accepting new players
    await button.click();
    await page.locator('.club-select').waitFor();
    return true;
  };
  const fillAndSend = async () => {
    const clubs = await page.locator('.club-select option').count();
    await page.locator('.club-select').selectOption({ index: between(1, Math.max(1, clubs - 1)) });
    await pause(page, 500, 1500);
    await page.getByRole('button', { name: 'Next month' }).click();
    const days = page.locator('.day-btn:not([disabled])');
    await days.nth(between(0, Math.max(0, (await days.count()) - 1))).click();
    const slots = page.locator('.slot');
    await slots.nth(between(0, Math.max(0, (await slots.count()) - 1))).click();
    await page.locator('.dur-chip').nth(Number(weighted(DURATION_INDEX))).click();
    await pause(page, 800, 2500);
    await page.getByRole('button', { name: 'Send request' }).click();
    await waitFor('book_session', () => true, 15_000);
  };
  const pay = async () => {
    await page.waitForURL(/\/checkout\/[0-9a-f-]+$/, { timeout: 15_000 });
    await page.getByTestId('pay-now').waitFor();
    await pause(page, 1500, 4000);
    await page.getByTestId('pay-now').click();
    await page.getByTestId('payment-confirmed').waitFor({ timeout: 15_000 });
    await waitFor('purchase');
  };
  const search = async () => {
    await page.getByRole('link', { name: 'Coaches', exact: true }).click();
    await page.waitForURL(/\/coaches$/);
    await page.getByTestId('coach-search-input').waitFor();
    if (chance(0.5)) await page.getByTestId('filter-city').selectOption({ index: between(0, 3) });
    if (chance(0.4)) await page.getByTestId('filter-level').selectOption({ index: between(0, 4) });
    await page.getByTestId('coach-search-input').fill(pick(SEARCH_TERMS));
    await pause(page, 800, 2000);
    await page.getByTestId('coach-search-submit').click();
    await waitFor('search');
  };
  const backToDashboard = async () => {
    await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
    await page.waitForURL(/\/dashboard$/);
  };

  const t0 = Date.now();
  // Hard per-user timeout: closing the context makes every pending call fail.
  let timedOut = false;
  const killer = setTimeout(() => { timedOut = true; context.close().catch(() => {}); }, cfg.userTimeoutMs);
  try {
    // 1. Arrive and authenticate.
    await step('open login', async () => {
      await load(page, 'login', variant);
      await checkConsentAndGtm(page, journey);
    });
    await pause(page, 1500, 4000);

    if (type === 'seeded_player') {
      await step('log in', async () => {
        await page.getByLabel('Email', { exact: true }).fill(journey.account);
        await page.getByLabel('Password', { exact: true }).fill(`sim-${between(100000, 999999)}`);
        await pause(page, 500, 1500);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
        await waitFor('login');
      });
    } else {
      await step(`sign up as ${role.toLowerCase()}`, async () => {
        await page.getByRole('link', { name: 'Create one' }).click();
        await page.waitForURL(/\/register$/);
        await page.getByLabel('Email', { exact: true }).fill(journey.account);
        await page.getByLabel('First name').fill('Sim');
        await page.getByLabel('Last name').fill(role === 'Coach' ? 'Coach' : 'Player');
        await page.getByLabel('Phone number').fill('+000 00 000 000');
        await page.getByLabel('City').selectOption({ index: between(1, 10) });
        const password = `Sim-${between(100000, 999999)}a`;
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByLabel('Confirm password').fill(password);
        if (role === 'Coach') await page.locator('label.role-card:has(input[value="Coach"])').click();
        await pause(page, 800, 2000);
        await page.getByRole('button', { name: 'Create account' }).click();
        await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
        await waitFor('sign_up');
      });
    }
    await step('dashboard recommendations', dashboardRecs);
    await pause(page, 2000, 6000);

    // 2. The journey itself.
    if (role === 'Coach') {
      await step('player recommendations', togglePlayers);
      await pause(page, 1500, 4000);
      switch (journeyName) {
        case 'rec_player_book':
          await step('select recommended player', () => clickRec('player'));
          await pause(page, 2000, 5000);
          if (await openBooking()) await step('request session with player', fillAndSend);
          break;
        case 'browse_players_book':
          await step('players list', async () => {
            await page.getByRole('link', { name: 'Players', exact: true }).first().click();
            await page.waitForURL(/\/players$/);
            await page.locator('app-player-card').first().waitFor();
          });
          await pause(page, 2000, 5000);
          await step('open player profile', async () => {
            const cards = page.locator('app-player-card');
            await cards.nth(between(0, Math.min(5, (await cards.count()) - 1))).getByRole('button', { name: 'View Profile' }).click();
            await page.waitForURL(/\/players\/[0-9a-f-]+$/);
          });
          await pause(page, 2000, 5000);
          if (await openBooking()) await step('request session with player', fillAndSend);
          break;
        case 'abandon_player_profile':
          await step('select recommended player', () => clickRec('player'));
          await pause(page, 3000, 8000);
          break;
        default: // abandon_dashboard
          break;
      }
    } else {
      switch (journeyName) {
        case 'full_booking':
        case 'search_then_book':
          if (journeyName === 'search_then_book') {
            await step('search coaches', search);
            await pause(page, 2000, 5000);
            await step('back to dashboard', async () => { await backToDashboard(); await page.getByTestId('rec-1').waitFor(); });
          }
          await step('select recommended coach', () => clickRec('coach'));
          await pause(page, 3000, 8000);
          if (await openBooking()) {
            await step('send booking request', fillAndSend);
            await step('pay', pay);
          }
          break;
        case 'browse_list_book':
          await step('search coaches', search);
          await pause(page, 2000, 5000);
          await step('open coach from list', async () => {
            const cards = page.locator('app-coach-card');
            await cards.first().waitFor();
            await cards.nth(between(0, Math.min(5, (await cards.count()) - 1))).getByRole('button', { name: 'View Profile' }).click();
            await page.waitForURL(/\/coaches\/[0-9a-f-]+$/);
            await waitFor('view_item');
          });
          await pause(page, 3000, 8000);
          if (await openBooking()) {
            await step('send booking request', fillAndSend);
            await step('pay', pay);
          }
          break;
        case 'practice_partner':
          await step('player recommendations', togglePlayers);
          await pause(page, 1500, 4000);
          await step('select recommended player', () => clickRec('player'));
          await pause(page, 2000, 5000);
          if (await openBooking()) await step('request practice session', fillAndSend);
          break;
        case 'abandon_search':
          await step('search coaches', search);
          await pause(page, 2000, 6000);
          break;
        case 'abandon_profile':
          await step('select recommended coach', () => clickRec('coach'));
          await pause(page, 3000, 9000);
          break;
        case 'abandon_booking_modal':
          await step('select recommended coach', () => clickRec('coach'));
          await pause(page, 2000, 5000);
          if (await openBooking()) {
            await pause(page, 2000, 5000);
            await step('close booking form', () => page.locator('.modal-close').first().click({ timeout: 5000 }));
          }
          break;
        case 'abandon_checkout':
          await step('select recommended coach', () => clickRec('coach'));
          await pause(page, 2000, 5000);
          if (await openBooking()) {
            await step('send booking request', fillAndSend);
            await step('leave checkout unpaid', async () => { await page.waitForURL(/\/checkout\//); await pause(page, 2000, 5000); });
          }
          break;
        default: // abandon_dashboard
          break;
      }
    }

    // 3. A second page load in the same browser, still signed in (same GA4 client, same user_id).
    if (repeatVisit) {
      await step('repeat visit', async () => {
        await leavePage(page);
        page = await context.newPage();
        watch(page);
        dlIndex = 0;
        await pause(page, 3000, 10_000);
        await load(page, 'dashboard');
        await checkConsentAndGtm(page, journey);
        await dashboardRecs();
      });
      await pause(page, 2000, 6000);
      if (role === 'Player' && chance(0.5)) {
        await step('select recommended coach', () => clickRec('coach'));
        await pause(page, 2000, 6000);
      }
    }

    if (logoutAtEnd) {
      await step('log out', async () => {
        await page.getByRole('button', { name: 'Log out' }).click();
        await page.waitForURL(/\/login$/);
      });
    }
    journey.outcome = 'completed';
  } catch (e) {
    if (e instanceof EventCap) {
      journey.outcome = 'event_cap';
      journey.error = e.message;
    } else {
      journey.outcome = e instanceof Fatal ? 'fatal' : 'failed';
      const why = timedOut ? `timed out after ${cfg.userTimeoutMs / 1000} s` : e.message.split('\n')[0];
      journey.error = `${journey.steps.at(-1) ?? 'start'}: ${why}`;
      journey.loadFailure = e instanceof LoadError;
      if (!(e instanceof Fatal) && !timedOut) await sync().catch(() => {});
      if (e instanceof Fatal) { journey.ms = Date.now() - t0; return { journey, fatal: e }; }
    }
  } finally {
    clearTimeout(killer);
    if (!timedOut) await leavePage(page);
    await context.close().catch(() => {});
  }
  journey.ms = Date.now() - t0;
  journey.missingInGa = missingInGa(journey);
  return { journey };
}

// ── Main loop ────────────────────────────────────────────────────────────────

function finish(reason, code = 0) {
  summary.finishedAt = new Date().toISOString();
  summary.stopReason = reason;
  summary.minutes = Math.round((Date.now() - startedAt) / 6000) / 10;
  writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2) + '\n');
  console.log(`\n[sim] stopped: ${reason}`);
  console.log(`[sim] users ${summary.users}, failures ${summary.failures}, dataLayer events ${Object.values(summary.events).reduce((a, b) => a + b, 0)}, GA4 hits ${summary.gaHits}${cfg.blockGa ? ' (blocked)' : ''}`);
  console.log('[sim] events:', JSON.stringify(summary.events));
  console.log('[sim] pushed but not seen in GA4 requests:', JSON.stringify(summary.missingInGa));
  console.log(`[sim] journey log: ${LOG_FILE}`);
  console.log(`[sim] summary:     ${SUMMARY_FILE}`);
  process.exitCode = code;
}

async function main() {
  console.log(`[sim] run ${runId}: ${cfg.maxUsers} users max, ${cfg.maxEvents} events/user max, ${cfg.maxMinutes} min max, pace ${cfg.pace}, seed ${cfg.seed}`);
  console.log(`[sim] target ${cfg.baseUrl}${cfg.blockGa ? '  (GA4 collect requests blocked)' : '  (events WILL be sent to GA4)'}`);
  const awake = keepAwake();
  const browser = await chromium.launch({ headless: false });
  let interrupted = false;
  process.on('SIGINT', () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log('\n[sim] Ctrl+C: stopping after the current user (press again to quit now)');
  });

  const plan = schedule(cfg.maxUsers);
  let consecutive = 0;
  let consecutiveLoad = 0;
  let reason = 'all users done';
  let code = 0;
  try {
    for (let i = 0; i < plan.length; i++) {
      if (interrupted) { reason = 'interrupted'; break; }
      if (Date.now() >= deadline) { reason = `runtime cap of ${cfg.maxMinutes} min reached`; break; }

      let result;
      try {
        result = await simulateUser(browser, i + 1, plan[i]);
      } catch (e) {
        result = { journey: { n: i + 1, type: plan[i], outcome: 'failed', error: e.message, steps: [], events: [], gaEvents: [] } };
      }
      const j = result.journey;
      log(j);
      summary.users++;
      bump(summary.byType, j.type);
      if (j.journey) bump(summary.byJourney, j.journey);
      bump(summary.outcomes, j.outcome);
      for (const e of j.events) bump(summary.events, e.event);
      for (const en of j.gaEvents) bump(summary.gaEvents, en);
      summary.gaHits += j.gaEvents.length;
      for (const [k, v] of Object.entries(j.missingInGa ?? {})) bump(summary.missingInGa, k, v);

      const names = j.events.map(e => e.event).join(' > ');
      const missing = Object.entries(j.missingInGa ?? {}).map(([k, v]) => `${k} x${v}`).join(', ');
      console.log(`[sim] ${String(j.n).padStart(3)} ${j.type.padEnd(13)} ${String(j.journey ?? '').padEnd(22)} ${String(j.variant ?? '').padEnd(13)} ${j.outcome.padEnd(9)} ${Math.round((j.ms ?? 0) / 1000)}s  ${names}`
        + (j.error ? `\n      ! ${j.error}` : '')
        + (missing ? `\n      ~ pushed but not seen in a GA4 request: ${missing}` : ''));

      if (result.fatal) { reason = `fatal: ${result.fatal.message}`; code = 1; break; }
      if (j.outcome === 'failed') {
        summary.failures++;
        consecutive++;
        consecutiveLoad = j.loadFailure ? consecutiveLoad + 1 : 0;
        if (j.loadFailure && (j.n === 1 || consecutiveLoad >= 2)) { reason = `site not loading: ${j.error}`; code = 1; break; }
        if (consecutive >= cfg.maxConsecutiveFailures) { reason = `${consecutive} journeys failed in a row`; code = 1; break; }
        if (summary.failures >= cfg.maxTotalFailures) { reason = `${summary.failures} failed journeys in total`; code = 1; break; }
      } else { consecutive = 0; consecutiveLoad = 0; }

      if (i < plan.length - 1) await new Promise(r => setTimeout(r, Math.round(between(2000, 8000) * cfg.pace)));
    }
  } finally {
    await browser.close().catch(() => {});
    awake?.kill();
  }
  finish(reason, code);
}

main().catch(e => {
  console.error('[sim] crashed:', e);
  finish(`crashed: ${e.message}`, 1);
});
