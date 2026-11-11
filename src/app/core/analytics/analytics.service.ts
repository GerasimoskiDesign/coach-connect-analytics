import { DestroyRef, Injectable, inject, isDevMode } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { catchError, distinctUntilChanged, filter, map, of } from 'rxjs';
import { readJson, readStorage, writeJson, writeStorage } from '../storage/safe-storage';
import { AuthService } from '../services/auth.service';
import { UserDto } from '../models/auth.models';
import { ProfileService } from '../../features/profile/profile.service';
import { ExperimentService } from './experiment.service';
import { interactionType, playerLevel, roleParam } from './analytics-items';
import {
  ConsentState,
  DataLayerEntry,
  GaItem,
  REC_LISTS,
  RecAlgorithm,
  RecListId,
  RequestResponse,
  RoleParam,
  SearchEvent,
  SignUpMethod,
  TrackedEvent,
  UserKeys,
} from './analytics.models';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** sessionStorage: JSON of the user properties last sent with set_user_properties. */
const USER_PROPS_SENT_KEY = 'cc_user_props_sent';
/** sessionStorage: recommendation clicks by target user ID, consumed by the next booking. */
const REC_CLICKS_KEY = 'cc_rec_clicks';
/** sessionStorage: recommendation context of bookings by session request ID, read at purchase. */
const REC_BOOKINGS_KEY = 'cc_rec_bookings';
const PURCHASES_SENT_KEY = 'cc_purchases_sent';

/**
 * Event-level keys mapped to GA4 parameters in GTM. GTM keeps every pushed key
 * in its data model until it is overwritten, so a `value` or `search_term` from
 * an earlier event would otherwise be attached to every later event. Each event
 * push sets the keys it does not use to undefined, which GTM treats as "not set".
 * Page keys, `rec_variant` and `user` are left alone: they describe the current
 * page, browser and account. Must match the tracking plan (a unit test checks it).
 */
const EVENT_SCOPED_KEYS = [
  'method', 'user_role', 'search_term', 'filter_level', 'filter_city',
  'rec_algorithm', 'rec_score', 'rec_list_id', 'rec_index',
  'session_request_id', 'interaction_type', 'requester_role', 'receiver_id', 'receiver_role',
  'coach_id', 'session_type', 'player_level', 'duration_minutes', 'value', 'currency',
  'response', 'responder_role',
] as const;

// ── Allow-list ─────────────────────────────────────────────────────────────
// Only these keys can reach the dataLayer. Anything else is dropped, so a
// careless call site cannot send an email, a name or a phone number to GA4.
const PAGE_KEYS = ['page_path', 'page_title', 'page_location'];
const TOP_LEVEL_KEYS = new Set<string>(['event', 'ecommerce', 'rec_variant', 'user', ...PAGE_KEYS, ...EVENT_SCOPED_KEYS]);
const USER_KEYS: readonly (keyof UserKeys)[] = ['user_id', 'user_role', 'signup_date', 'player_level'];
const ECOMMERCE_KEYS = new Set(['item_list_id', 'item_list_name', 'items', 'currency', 'value', 'transaction_id']);
const ITEM_KEYS = new Set([
  'item_id', 'item_name', 'item_category', 'item_variant', 'item_list_id', 'item_list_name',
  'index', 'price', 'quantity', 'rec_algorithm',
]);
const REDACTED = '(redacted)';
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /\+?\d[\d\s().-]{6,}\d/;

const EMPTY_USER: Required<Record<keyof UserKeys, undefined>> = {
  user_id: undefined, user_role: undefined, signup_date: undefined, player_level: undefined,
};

interface RecContext {
  rec_list_id: RecListId;
  rec_algorithm: RecAlgorithm;
  rec_index: number;
}

/** What the booking modal knows about a request it has just sent. */
export interface BookingInput {
  sessionRequestId: string;
  requesterId: string;
  requesterRole: RoleParam;
  receiverId: string;
  receiverRole: RoleParam;
  /** Skill level (1-10) of the receiver, when the receiver is a player. */
  receiverSkillLevel?: number;
  durationMinutes: number;
  value: number;
}

/**
 * The only code in the app that writes to window.dataLayer. Components call
 * typed methods; this service shapes the payload, clears the previous
 * ecommerce object before every ecommerce event and pushes. Google Tag Manager
 * picks the events up from there (see gtm/container.json).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly experiment = inject(ExperimentService);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;
  /** Account keys of the signed-in user, {} when signed out. */
  private user: UserKeys = {};

  /** Called once at bootstrap (app.config.ts). */
  start(): void {
    if (this.started) return;
    this.started = true;

    // The variant is known immediately; publish it before anything else so the
    // first page view carries it even while the account keys are still resolving.
    this.push({ rec_variant: this.experiment.recVariant });

    // currentUser$ is a BehaviorSubject: the first value is the cached user on
    // app start (or null), later values come from login, sign-up and logout.
    let first = true;
    this.auth.currentUser$.pipe(
      distinctUntilChanged((a, b) => (a?.userId ?? null) === (b?.userId ?? null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(user => {
      this.onUserChange(user, first);
      first = false;
    });

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.pageView());
  }

  // ── Consent ──────────────────────────────────────────────────────────────

  /** Consent Mode v2 update for all four signals. The default (all denied) is set in index.html. */
  updateConsent(state: ConsentState): void {
    this.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }

  // ── Events ───────────────────────────────────────────────────────────────

  /** 'auto_login' is an account the demo backend created on the first login with an unknown email. */
  signUp(user: UserDto, method: SignUpMethod = 'email'): void {
    this.push({ event: 'sign_up', method, user_role: roleParam(user.role) });
  }

  login(user: UserDto): void {
    this.push({ event: 'login', method: 'email', user_role: roleParam(user.role) });
  }

  search(params: Omit<SearchEvent, 'event'>): void {
    this.push({ event: 'search', ...params });
  }

  viewRecommendedList(listId: RecListId, items: GaItem[], algorithm: RecAlgorithm): void {
    this.pushEcommerce({
      event: 'view_item_list',
      ecommerce: { ...REC_LISTS[listId], items },
      rec_algorithm: algorithm,
    });
  }

  /** Also remembers the click, so a booking of the same coach or player can be attributed to it. */
  selectRecommendedItem(listId: RecListId, item: GaItem, algorithm: RecAlgorithm, score: number): void {
    this.pushEcommerce({
      event: 'select_item',
      ecommerce: {
        ...REC_LISTS[listId],
        items: [{ item_id: item.item_id, item_name: item.item_name, index: item.index }],
      },
      rec_algorithm: algorithm,
      rec_score: score,
    });
    const clicks = readJson<Record<string, RecContext>>(REC_CLICKS_KEY, {}, 'session');
    clicks[item.item_id] = { rec_list_id: listId, rec_algorithm: algorithm, rec_index: item.index ?? 0 };
    writeJson(REC_CLICKS_KEY, clicks, 'session');
  }

  viewItem(item: GaItem): void {
    this.pushEcommerce({
      event: 'view_item',
      ecommerce: { currency: 'EUR', value: item.price ?? 0, items: [item] },
    });
  }

  /** Key event: a session request was sent, by a player or by a coach. */
  bookSession(b: BookingInput): void {
    const coachId = b.requesterRole === 'coach' ? b.requesterId
      : b.receiverRole === 'coach' ? b.receiverId
      : 'none';
    // The player in the session: the requester when it is a player, otherwise the receiver.
    const level = b.requesterRole === 'player'
      ? this.user.player_level
      : b.receiverSkillLevel !== undefined ? playerLevel(b.receiverSkillLevel) : undefined;
    const rec = this.takeRecClick(b.receiverId);
    if (rec) {
      const bookings = readJson<Record<string, RecContext>>(REC_BOOKINGS_KEY, {}, 'session');
      bookings[b.sessionRequestId] = rec;
      writeJson(REC_BOOKINGS_KEY, bookings, 'session');
    }
    this.push({
      event: 'book_session',
      session_request_id: b.sessionRequestId,
      interaction_type: interactionType(b.requesterRole, b.receiverRole),
      requester_role: b.requesterRole,
      receiver_id: b.receiverId,
      receiver_role: b.receiverRole,
      coach_id: coachId,
      session_type: coachId === 'none' ? 'practice' : 'coaching',
      player_level: level ?? '',
      duration_minutes: b.durationMinutes,
      value: b.value,
      currency: 'EUR',
      rec_list_id: rec?.rec_list_id ?? '',
      rec_algorithm: rec?.rec_algorithm ?? '',
      rec_index: rec?.rec_index ?? '',
    });
  }

  /** The receiver of a session request accepted, declined or rescheduled it. */
  sessionRequestResponded(p: {
    sessionRequestId: string;
    response: RequestResponse;
    responderRole: RoleParam;
    requesterRole: RoleParam;
  }): void {
    this.push({
      event: 'session_request_responded',
      session_request_id: p.sessionRequestId,
      response: p.response,
      responder_role: p.responderRole,
      interaction_type: interactionType(p.requesterRole, p.responderRole),
    });
  }

  /**
   * Key event: a paid booking was confirmed. Deduplicated per transaction so a
   * reload of the confirmation screen cannot report the same revenue twice.
   * The item carries the recommendation list, position and algorithm when the
   * booking came from a recommendation.
   */
  purchase(transactionId: string, sessionRequestId: string, value: number, item: GaItem): void {
    const sent = (readStorage(PURCHASES_SENT_KEY, 'session') ?? '').split(',');
    if (sent.includes(transactionId)) return;
    const rec = readJson<Record<string, RecContext>>(REC_BOOKINGS_KEY, {}, 'session')[sessionRequestId];
    const purchased: GaItem = rec
      ? {
        ...item,
        item_list_id: rec.rec_list_id,
        item_list_name: REC_LISTS[rec.rec_list_id].item_list_name,
        index: rec.rec_index,
        rec_algorithm: rec.rec_algorithm,
      }
      : item;
    this.pushEcommerce({
      event: 'purchase',
      ecommerce: { transaction_id: transactionId, value, currency: 'EUR', items: [purchased] },
      player_level: this.user.player_level ?? '',
    });
    writeStorage(PURCHASES_SENT_KEY, [...sent.filter(Boolean), transactionId].join(','), 'session');
  }

  // ── User properties ──────────────────────────────────────────────────────

  /**
   * Account keys follow the rec_variant pattern: a set_user_properties event
   * when they change in this browser session (app start, sign-up, login), a
   * plain push otherwise, so the GTM variables always resolve. Logout clears
   * them without an event.
   */
  private onUserChange(user: UserDto | null, isAppStart: boolean): void {
    if (!user) {
      if (isAppStart) {
        this.commitUserProps({});
        return;
      }
      this.user = {};
      this.push({ user: { ...EMPTY_USER } });
      writeStorage(USER_PROPS_SENT_KEY, this.propsSignature({}), 'session');
      return;
    }

    const sent = readJson<{ user?: UserKeys } | null>(USER_PROPS_SENT_KEY, null, 'session');
    const base: UserKeys = {
      user_id: user.userId,
      user_role: roleParam(user.role),
      signup_date: user.createdAt ? user.createdAt.slice(0, 10) : undefined,
      // Same account later in this session: reuse the level already resolved.
      player_level: user.role === 'Player' && sent?.user?.user_id === user.userId ? sent.user.player_level : undefined,
    };
    // Plain push first, so an event pushed right after (login, sign_up) already carries the account.
    this.user = base;
    this.push({ user: { ...EMPTY_USER, ...base } });

    if (user.role !== 'Player' || base.player_level !== undefined) {
      this.commitUserProps(base);
      return;
    }
    // The level is on the player profile, not on the user.
    this.profiles.getMyPlayerProfile().pipe(
      map(p => playerLevel(p.skillLevel)),
      catchError(() => of(undefined)),
    ).subscribe(level => {
      if (this.user.user_id !== user.userId) return; // logged out in the meantime
      this.commitUserProps({ ...base, player_level: level });
    });
  }

  private commitUserProps(user: UserKeys): void {
    this.user = user;
    const props = { rec_variant: this.experiment.recVariant, user: { ...EMPTY_USER, ...user } };
    const signature = this.propsSignature(user);
    if (readStorage(USER_PROPS_SENT_KEY, 'session') === signature) {
      this.push(props);
      return;
    }
    this.push({ event: 'set_user_properties', ...props });
    writeStorage(USER_PROPS_SENT_KEY, signature, 'session');
  }

  /** JSON drops undefined values, so a signed-out visitor is {"rec_variant":..,"user":{}}. */
  private propsSignature(user: UserKeys): string {
    return JSON.stringify({ rec_variant: this.experiment.recVariant, user });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private takeRecClick(targetId: string): RecContext | undefined {
    const clicks = readJson<Record<string, RecContext>>(REC_CLICKS_KEY, {}, 'session');
    const rec = clicks[targetId];
    if (rec) {
      delete clicks[targetId];
      writeJson(REC_CLICKS_KEY, clicks, 'session');
    }
    return rec;
  }

  private pageView(): void {
    this.push({
      event: 'page_view_spa',
      page_path: window.location.pathname + window.location.search,
      page_title: this.routeTitle() ?? document.title,
      page_location: window.location.href,
    });
  }

  // The router emits NavigationEnd before it updates document.title, so read
  // the title from the activated route instead of from the document.
  private routeTitle(): string | undefined {
    let snap: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title: string | undefined;
    while (snap) {
      if (typeof snap.title === 'string') title = snap.title;
      snap = snap.firstChild;
    }
    return title;
  }

  private pushEcommerce(event: TrackedEvent & { ecommerce: object }): void {
    // GTM merges pushes into one data model; without this reset, items from
    // the previous ecommerce event would leak into this one.
    this.push({ ecommerce: null });
    this.push(event);
  }

  private push(entry: DataLayerEntry): void {
    const safe = sanitize(entry as unknown as Record<string, unknown>);
    const payload: Record<string, unknown> = 'event' in safe
      ? { event: safe['event'], ...Object.fromEntries(EVENT_SCOPED_KEYS.map(k => [k, undefined])), ...safe }
      : safe;
    (window.dataLayer = window.dataLayer ?? []).push(payload);
  }

  private gtag(...args: unknown[]): void {
    if (typeof window.gtag === 'function') {
      window.gtag(...args);
      return;
    }
    // Same shape as the stub in index.html: gtag commands are pushed as an
    // Arguments object, which is what GTM looks for.
    (function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer = window.dataLayer ?? []).push(arguments);
    }).apply(null, args as []);
  }
}

// ── Sanitising ─────────────────────────────────────────────────────────────

function sanitize(entry: Record<string, unknown>): Record<string, unknown> {
  const dropped: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!TOP_LEVEL_KEYS.has(key)) { dropped.push(key); continue; }
    if (key === 'user') out[key] = pick(value, new Set<string>(USER_KEYS), dropped, 'user.');
    else if (key === 'ecommerce') out[key] = value === null ? null : sanitizeEcommerce(value, dropped);
    else out[key] = scrub(value);
  }
  // Free text typed by the visitor: also catch phone numbers.
  if (typeof out['search_term'] === 'string' && PHONE.test(out['search_term'])) out['search_term'] = REDACTED;
  if (dropped.length && isDevMode()) console.warn('[analytics] dropped keys not in the allow-list:', dropped);
  return out;
}

function sanitizeEcommerce(value: unknown, dropped: string[]): Record<string, unknown> {
  const eco = pick(value, ECOMMERCE_KEYS, dropped, 'ecommerce.');
  if (Array.isArray(eco['items'])) {
    eco['items'] = eco['items'].map(item => pick(item, ITEM_KEYS, dropped, 'ecommerce.items[].'));
  }
  return eco;
}

/** Keeps allowed keys, including ones set to undefined on purpose (that is how values are cleared). */
function pick(value: unknown, allowed: Set<string>, dropped: string[], prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (value === null || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value)) {
    if (allowed.has(k)) out[k] = k === 'items' ? v : scrub(v);
    else dropped.push(prefix + k);
  }
  return out;
}

function scrub(value: unknown): unknown {
  return typeof value === 'string' && EMAIL.test(value) ? REDACTED : value;
}
