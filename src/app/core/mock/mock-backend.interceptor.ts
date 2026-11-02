import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, switchMap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExperimentService } from '../analytics/experiment.service';
import { CoachOnboardingDto, PlayerOnboardingDto, UserDto } from '../models/auth.models';
import { CoachProfileDto, PlayerProfileDto } from '../models/discovery.models';
import { RecVariant } from '../models/recommendation.models';
import {
  CompletedSessionDto,
  CreateSessionRequestDto,
  PaymentDto,
  RescheduleSessionRequestDto,
  SessionRequestDto,
  UpcomingSessionDto,
} from '../models/session-request.models';
import { readJson, writeJson } from '../storage/safe-storage';
import { COACHES, MockCoach, PLAYERS, TENNIS_CLUBS, defaultPlayerProfile } from './mock-data';
import { recommendCoaches, recommendPlayers } from './mock-recommender';

/**
 * Replaces the .NET API. Every request under `environment.apiUrl` is answered
 * here from synthetic data and never reaches the network. The app's own JWT and
 * 401-refresh interceptors still run in front of this one, so auth behaves the
 * same way it does against the real backend.
 */

const USERS_KEY = 'cc_mock_users';
const REQUESTS_KEY = 'cc_mock_requests';

interface StoredUser extends UserDto {
  playerProfile: PlayerProfileDto | null;
  coachProfile: CoachProfileDto | null;
}

class HttpError {
  constructor(readonly status: number, readonly detail: string) {}
}

// ── State ───────────────────────────────────────────────────────────────────

function seedUsers(): StoredUser[] {
  const coaches = COACHES.map((c): StoredUser => ({
    userId: c.userId, email: c.email, firstName: c.firstName, lastName: c.lastName,
    role: 'Coach', city: c.city, phoneNumber: '+000 00 000 000', emailConfirmed: true,
    isOnboarded: true, createdAt: c.createdAt, playerProfile: null, coachProfile: c,
  }));
  const players = PLAYERS.map((p): StoredUser => ({
    userId: p.userId, email: p.email, firstName: p.firstName, lastName: p.lastName,
    role: 'Player', city: p.city, phoneNumber: '+000 00 000 000', emailConfirmed: true,
    isOnboarded: true, createdAt: p.createdAt, playerProfile: p, coachProfile: null,
  }));
  return [...coaches, ...players];
}

const seeded = seedUsers();
const visitors = (): StoredUser[] => readJson<StoredUser[]>(USERS_KEY, []);
const allUsers = (): StoredUser[] => [...seeded, ...visitors()];
const findUser = (id: string): StoredUser | undefined => allUsers().find(u => u.userId === id);
const findByEmail = (email: string): StoredUser | undefined =>
  allUsers().find(u => u.email.toLowerCase() === email.toLowerCase());

function saveVisitor(user: StoredUser): void {
  writeJson(USERS_KEY, [...visitors().filter(u => u.userId !== user.userId), user]);
}

const requests = (): SessionRequestDto[] => readJson<SessionRequestDto[]>(REQUESTS_KEY, []);
function saveRequest(r: SessionRequestDto): void {
  writeJson(REQUESTS_KEY, [...requests().filter(x => x.id !== r.id), r]);
}

function toUserDto(u: StoredUser): UserDto {
  const { playerProfile: _p, coachProfile: _c, ...dto } = u;
  return dto;
}

function withoutEmail<T extends { email?: string }>(record: T): Omit<T, 'email'> {
  const { email: _e, ...rest } = record;
  return rest;
}

const coachById = (id: string): MockCoach | undefined => COACHES.find(c => c.userId === id);

function randomId(): string {
  return crypto.randomUUID();
}

// ── Auth ────────────────────────────────────────────────────────────────────

function issueTokens(u: StoredUser) {
  const payload = btoa(JSON.stringify({ sub: u.userId, exp: Math.floor(Date.now() / 1000) + 365 * 86400 }));
  return {
    userId: u.userId, email: u.email, role: u.role,
    accessToken: `mock.${payload}.demo`, refreshToken: `mock-refresh.${payload}.demo`,
    expiresIn: 365 * 86400, emailConfirmed: u.emailConfirmed, isOnboarded: u.isOnboarded,
  };
}

function subjectOf(token: string | null): string | null {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).sub ?? null;
  } catch {
    return null;
  }
}

function currentUser(req: HttpRequest<unknown>): StoredUser {
  const header = req.headers.get('Authorization');
  const id = subjectOf(header?.startsWith('Bearer ') ? header.slice(7) : null);
  const user = id ? findUser(id) : undefined;
  if (!user) throw new HttpError(401, 'Not authenticated.');
  return user;
}

function nameFromEmail(email: string): [string, string] {
  const parts = email.split('@')[0].split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return [cap(parts[0] ?? 'Demo'), cap(parts[1] ?? 'Player')];
}

function newPlayer(email: string, firstName: string, lastName: string, city: string, phone: string, role: 'Player' | 'Coach'): StoredUser {
  const userId = randomId();
  const createdAt = new Date().toISOString();
  const playerProfile: PlayerProfileDto | null = role === 'Player'
    ? { ...defaultPlayerProfile(), userId, firstName, lastName, city, createdAt }
    : null;
  const coachProfile: CoachProfileDto | null = role === 'Coach'
    ? { ...withoutEmail(COACHES[0]), userId, firstName, lastName, city, createdAt, bio: null }
    : null;
  const user: StoredUser = {
    userId, email, firstName, lastName, role, city, phoneNumber: phone,
    emailConfirmed: true, isOnboarded: true, createdAt, playerProfile, coachProfile,
  };
  saveVisitor(user);
  return user;
}

// ── Sessions ────────────────────────────────────────────────────────────────

function priceFor(receiverId: string, durationMinutes: number): number | null {
  const coach = coachById(receiverId);
  return coach ? Math.round(coach.hourlyRate * durationMinutes / 60) : null;
}

function counterpart(r: SessionRequestDto, me: StoredUser) {
  const mine = r.requesterId === me.userId;
  const id = mine ? r.receiverId : r.requesterId;
  const other = findUser(id);
  return {
    counterpartUserId: id,
    counterpartFirstName: mine ? r.receiverFirstName : r.requesterFirstName,
    counterpartLastName: mine ? r.receiverLastName : r.requesterLastName,
    counterpartRole: (other?.role ?? 'Player') as 'Player' | 'Coach',
  };
}

function toSession(r: SessionRequestDto, me: StoredUser): UpcomingSessionDto & CompletedSessionDto {
  return {
    id: r.id, ...counterpart(r, me), tennisClubName: r.tennisClubName,
    proposedDateTime: r.proposedDateTime, durationMinutes: r.durationMinutes,
    sessionType: r.sessionType, estimatedPriceMkd: r.estimatedPriceMkd,
  };
}

const involves = (r: SessionRequestDto, me: StoredUser) => r.requesterId === me.userId || r.receiverId === me.userId;

function myRequest(id: string, me: StoredUser): SessionRequestDto {
  const r = requests().find(x => x.id === id);
  if (!r || !involves(r, me)) throw new HttpError(404, 'Session request not found.');
  return r;
}

// ── Router ──────────────────────────────────────────────────────────────────

interface Ctx {
  recVariant: RecVariant;
}
type Handler = (req: HttpRequest<any>, params: string[], ctx: Ctx) => unknown;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${pattern}$`), handler]);

on('POST', '/auth/register', req => {
  const b = req.body;
  if (!b?.email || !b?.password) throw new HttpError(400, 'Email and password are required.');
  if (findByEmail(b.email)) throw new HttpError(409, 'An account with this email already exists.');
  return issueTokens(newPlayer(b.email, b.firstName, b.lastName, b.city, b.phoneNumber, b.role));
});

// Demo rule: any email and any non-empty password log in. Unknown emails get a
// fresh synthetic player account so a visitor can try the app without signing up.
on('POST', '/auth/login', req => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw new HttpError(401, 'Incorrect email or password.');
  const existing = findByEmail(email);
  if (existing) return issueTokens(existing);
  const [first, last] = nameFromEmail(email);
  return issueTokens(newPlayer(email, first, last, 'Skopje', '+000 00 000 000', 'Player'));
});

on('POST', '/auth/refresh', req => {
  const user = findUser(subjectOf(req.body?.refreshToken) ?? '');
  if (!user) throw new HttpError(401, 'Invalid refresh token.');
  return issueTokens(user);
});
on('POST', '/auth/logout', () => null);
on('POST', '/auth/confirm-email', () => null);
on('POST', '/auth/forgot-password', () => null);
on('POST', '/auth/reset-password', () => null);
on('GET', '/auth/me', req => toUserDto(currentUser(req)));

on('POST', '/players/me/onboarding', req => {
  const me = currentUser(req);
  const dto = req.body as PlayerOnboardingDto;
  const updated: StoredUser = {
    ...me, isOnboarded: true,
    playerProfile: { ...(me.playerProfile ?? { ...defaultPlayerProfile() }), ...dto, bio: dto.bio ?? null,
      userId: me.userId, firstName: me.firstName, lastName: me.lastName, city: me.city, createdAt: me.createdAt } as PlayerProfileDto,
  };
  saveVisitor(updated);
  return toUserDto(updated);
});
on('POST', '/coaches/me/onboarding', req => {
  const me = currentUser(req);
  const dto = req.body as CoachOnboardingDto;
  const updated: StoredUser = {
    ...me, isOnboarded: true,
    coachProfile: { ...(me.coachProfile ?? COACHES[0]), ...dto, bio: dto.bio ?? null,
      userId: me.userId, firstName: me.firstName, lastName: me.lastName, city: me.city, createdAt: me.createdAt },
  };
  saveVisitor(updated);
  return toUserDto(updated);
});
on('GET', '/players/me/profile', req => {
  const p = currentUser(req).playerProfile;
  if (!p) throw new HttpError(404, 'No player profile.');
  return p;
});
on('GET', '/coaches/me/profile', req => {
  const c = currentUser(req).coachProfile;
  if (!c) throw new HttpError(404, 'No coach profile.');
  return c;
});

function paged<T>(list: T[], req: HttpRequest<unknown>): T[] {
  const page = Number(req.params.get('page') ?? 1);
  const size = Number(req.params.get('pageSize') ?? 50);
  return list.slice((page - 1) * size, page * size);
}

on('GET', '/coaches', req => {
  currentUser(req);
  const p = req.params;
  const q = (p.get('q') ?? '').trim().toLowerCase();
  const list = COACHES.filter(c =>
    (!p.has('surface') || c.preferredSurfaces.includes(p.get('surface') as never)) &&
    (!p.has('skillLevelGroup') || c.skillLevelGroups.includes(p.get('skillLevelGroup') as never)) &&
    (!p.has('ageGroup') || c.ageGroups.includes(p.get('ageGroup') as never)) &&
    (!p.has('trainingStyle') || c.trainingStyle === p.get('trainingStyle')) &&
    (!p.has('acceptingNewPlayers') || String(c.acceptingNewPlayers) === p.get('acceptingNewPlayers')) &&
    (!p.has('city') || c.city === p.get('city')) &&
    (!q || `${c.firstName} ${c.lastName} ${c.city} ${c.level} ${c.specialties.join(' ')}`.toLowerCase().includes(q)),
  );
  return paged(list.map(withoutEmail), req);
});
on('GET', '/coaches/([^/]+)', (req, [id]) => {
  currentUser(req);
  const c = coachById(id);
  if (!c) throw new HttpError(404, 'Coach not found.');
  return withoutEmail(c);
});

on('GET', '/players', req => {
  currentUser(req);
  const p = req.params;
  const list = allUsers()
    .map(u => u.playerProfile)
    .filter((x): x is PlayerProfileDto => x !== null)
    .filter(pl =>
      (!p.has('minSkillLevel') || pl.skillLevel >= Number(p.get('minSkillLevel'))) &&
      (!p.has('maxSkillLevel') || pl.skillLevel <= Number(p.get('maxSkillLevel'))) &&
      (!p.has('preferredSurface') || pl.preferredSurface === p.get('preferredSurface')) &&
      (!p.has('city') || pl.city === p.get('city')) &&
      (!p.has('excludeUserId') || pl.userId !== p.get('excludeUserId')),
    )
    .map(pl => withoutEmail(pl as PlayerProfileDto & { email?: string }));
  return paged(list, req);
});
on('GET', '/players/([^/]+)', (req, [id]) => {
  currentUser(req);
  const pl = findUser(id)?.playerProfile;
  if (!pl) throw new HttpError(404, 'Player not found.');
  return withoutEmail(pl as PlayerProfileDto & { email?: string });
});

on('GET', '/recommendations/me', (req, _params, ctx) => {
  const me = currentUser(req);
  const profile = me.playerProfile ?? { ...defaultPlayerProfile(), userId: me.userId, firstName: me.firstName,
    lastName: me.lastName, city: me.city, createdAt: me.createdAt };
  return req.params.get('type') === 'players'
    ? recommendPlayers({ userId: me.userId, city: me.city, skillLevel: profile.skillLevel })
    : recommendCoaches(profile, ctx.recVariant);
});

on('GET', '/progression/me', req => { currentUser(req); return []; });
on('GET', '/progression/me/events', req => { currentUser(req); return []; });
on('GET', '/tennis-clubs', req => { currentUser(req); return TENNIS_CLUBS; });

on('POST', '/session-requests', req => {
  const me = currentUser(req);
  const dto = req.body as CreateSessionRequestDto;
  const receiver = findUser(dto.receiverId);
  const club = TENNIS_CLUBS.find(c => c.id === dto.tennisClubId);
  if (!receiver || !club) throw new HttpError(400, 'Unknown receiver or club.');
  const r: SessionRequestDto = {
    id: randomId(), requesterId: me.userId, requesterFirstName: me.firstName, requesterLastName: me.lastName,
    receiverId: receiver.userId, receiverFirstName: receiver.firstName, receiverLastName: receiver.lastName,
    tennisClubId: club.id, tennisClubName: club.name, parentRequestId: null, rescheduleCount: 0,
    status: 'Pending', sessionType: receiver.role === 'Coach' || me.role === 'Coach' ? 'CoachPlayer' : 'PlayerPlayer',
    proposedDateTime: dto.proposedDateTime, durationMinutes: dto.durationMinutes, note: dto.note ?? null,
    createdAt: new Date().toISOString(), estimatedPriceMkd: priceFor(receiver.userId, dto.durationMinutes),
  };
  saveRequest(r);
  return r;
});
on('GET', '/session-requests/inbox', req => {
  const me = currentUser(req);
  return requests().filter(r => r.receiverId === me.userId && r.status === 'Pending');
});
on('GET', '/session-requests/pending', req => {
  const me = currentUser(req);
  return requests().filter(r => r.requesterId === me.userId && r.status === 'Pending');
});
on('GET', '/session-requests/upcoming', req => {
  const me = currentUser(req);
  return requests()
    .filter(r => involves(r, me) && r.status === 'Accepted' && new Date(r.proposedDateTime) > new Date())
    .sort((a, b) => a.proposedDateTime.localeCompare(b.proposedDateTime))
    .map(r => toSession(r, me));
});
const completed = (me: StoredUser) => requests()
  .filter(r => involves(r, me) && r.status === 'Accepted' && new Date(r.proposedDateTime) <= new Date())
  .map(r => toSession(r, me));
on('GET', '/session-requests/completed', req => completed(currentUser(req)));
on('GET', '/session-requests/activity', req => paged(completed(currentUser(req)), req));
on('GET', '/session-requests/([^/]+)', (req, [id]) => myRequest(id, currentUser(req)));
on('POST', '/session-requests/([^/]+)/(accept|decline)', (req, [id, action]) => {
  const r = { ...myRequest(id, currentUser(req)), status: action === 'accept' ? 'Accepted' : 'Declined' } as SessionRequestDto;
  saveRequest(r);
  return r;
});
on('POST', '/session-requests/([^/]+)/reschedule', (req, [id]) => {
  const old = myRequest(id, currentUser(req));
  const dto = req.body as RescheduleSessionRequestDto;
  const club = TENNIS_CLUBS.find(c => c.id === dto.tennisClubId) ?? TENNIS_CLUBS[0];
  saveRequest({ ...old, status: 'Rescheduled' });
  const next: SessionRequestDto = {
    ...old, id: randomId(), parentRequestId: old.id, rescheduleCount: old.rescheduleCount + 1,
    status: 'Pending', tennisClubId: club.id, tennisClubName: club.name,
    proposedDateTime: dto.proposedDateTime, durationMinutes: dto.durationMinutes, note: dto.note ?? null,
    createdAt: new Date().toISOString(), estimatedPriceMkd: priceFor(old.receiverId, dto.durationMinutes),
  };
  saveRequest(next);
  return next;
});

// Demo-only checkout. No card data is collected: paying confirms the session.
on('POST', '/payments', req => {
  const me = currentUser(req);
  const r = myRequest(req.body?.sessionRequestId, me);
  if (r.estimatedPriceMkd == null) throw new HttpError(400, 'This session is free.');
  saveRequest({ ...r, status: 'Accepted' });
  const payment: PaymentDto = {
    transactionId: `CC-${randomId().slice(0, 8).toUpperCase()}`,
    sessionRequestId: r.id, amount: r.estimatedPriceMkd, currency: 'EUR', status: 'paid',
    paidAt: new Date().toISOString(),
  };
  return payment;
});

// ── Interceptor ─────────────────────────────────────────────────────────────

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiUrl;
  const path = req.url.split('?')[0];
  if (!path.startsWith(base)) return next(req);

  const ctx: Ctx = { recVariant: inject(ExperimentService).recVariant };

  const sub = path.slice(base.length) || '/';
  const latency = 80 + Math.floor(Math.random() * 160);

  for (const [method, pattern, handler] of routes) {
    const match = req.method === method ? pattern.exec(sub) : null;
    if (!match) continue;
    try {
      const body = handler(req, match.slice(1), ctx);
      return of(new HttpResponse({ status: 200, body, url: req.url })).pipe(delay(latency));
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      return fail(req, e.status, e.detail, latency);
    }
  }
  return fail(req, 404, `No mock for ${req.method} ${sub}`, latency);
};

function fail(req: HttpRequest<unknown>, status: number, detail: string, latency: number): Observable<never> {
  // delay() does not delay errors, so wait on a timer and then throw.
  return timer(latency).pipe(
    switchMap(() => throwError(() => new HttpErrorResponse({ status, error: { detail }, url: req.url }))),
  );
}
