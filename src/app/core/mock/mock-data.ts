// Synthetic seed data for the mock backend. Every name, club and number here is
// generated: no real people, clubs or bookings. A fixed seed keeps the data
// identical on every load, which keeps the demo and the Playwright tests stable.

import {
  AgeGroup,
  CoachingApproach,
  CoachingStyle,
  MainGoal,
  SkillLevelGroup,
  Specialty,
  Surface,
} from '../models/auth.models';
import { CoachLevel, CoachProfileDto, PlayerProfileDto } from '../models/discovery.models';
import { TennisClubDto } from '../models/session-request.models';

/** mulberry32: tiny deterministic PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRandom(20261102);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
function pickSome<T>(list: readonly T[], min: number, max: number): T[] {
  const pool = [...list];
  const count = between(min, Math.min(max, pool.length));
  const out: T[] = [];
  while (out.length < count) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/** Deterministic UUID-shaped id, so ids look like the real API's Guids. */
export function mockId(prefix: 'c' | 'p' | 'u' | 'k', n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  const p = { c: 'c0ac', p: 'b1a7', u: 'a5e4', k: 'c1b0' }[prefix];
  return `${p}0000-0000-4000-8000-${hex}`;
}

export const CITIES = [
  'Skopje', 'Bitola', 'Kumanovo', 'Prilep',
  'Tetovo', 'Veles', 'Ohrid', 'Gostivar', 'Strumica', 'Shtip',
] as const;

const FIRST_NAMES = [
  'Ana', 'Marko', 'Elena', 'Stefan', 'Ivana', 'Nikola', 'Sara', 'Luka', 'Mila', 'David',
  'Tea', 'Filip', 'Jana', 'Petar', 'Lea', 'Andrej', 'Nora', 'Viktor', 'Iris', 'Daniel',
  'Maja', 'Teo', 'Vera', 'Bojan', 'Kaja', 'Leon', 'Dora', 'Martin', 'Ema', 'Pavel',
];

// Uncommon surnames combined with first names at random. No record is a real person.
const LAST_NAMES = [
  'Arvenski', 'Belovar', 'Corvin', 'Dalmen', 'Esterov', 'Faltin', 'Gorvan', 'Halden',
  'Ivarsen', 'Jorvik', 'Kestrel', 'Lindov', 'Maroni', 'Nesterin', 'Ondrell', 'Pellan',
  'Quirin', 'Rostan', 'Selvik', 'Tarvel', 'Ulmen', 'Varnov', 'Wexler', 'Zelenko',
];

export const TENNIS_CLUBS: TennisClubDto[] = [
  'Riverside Tennis Club',
  'Old Town Courts',
  'Hillside Racquet Club',
  'Lakeside Tennis Center',
  'City Park Courts',
  'North Gate Indoor Arena',
].map((name, i) => ({ id: mockId('k', i + 1), name }));

const SPECIALTIES: Specialty[] = [
  'Technique', 'Serve', 'Forehand', 'Backhand', 'Footwork', 'Fitness',
  'MatchStrategy', 'TournamentPreparation', 'JuniorDevelopment', 'BeginnerCoaching',
];
const SURFACES: Surface[] = ['Clay', 'HardCourt', 'Grass'];
const STYLES: CoachingStyle[] = ['Demanding', 'Balanced', 'Relaxed'];
const SKILL_GROUPS: SkillLevelGroup[] = ['Group1To3', 'Group4To6', 'Group7To8', 'Group9To10'];
const AGE_GROUPS: AgeGroup[] = ['Children6To12', 'Juniors13To18', 'Adults18Plus', 'Seniors35Plus'];
const APPROACHES: CoachingApproach[] = [
  'BeginnerFriendly', 'InjuryRehabilitation', 'MentalGame', 'TournamentPreparation',
  'RecreationalFocus', 'FitnessOriented', 'ReturnToSport', 'ConsistencyBuilding',
  'AdvancedTechnique', 'YouthDevelopment',
];
const GOALS: MainGoal[] = [
  'ImproveTechnique', 'ImproveFitness', 'PrepareForTournaments', 'FindHittingPartners',
  'ReturnToTennis', 'TrainRecreationally', 'ImproveServe', 'ImproveConsistency',
];

const LEVEL_BY_GROUP: Record<SkillLevelGroup, CoachLevel> = {
  Group1To3: 'Beginner',
  Group4To6: 'Intermediate',
  Group7To8: 'Advanced',
  Group9To10: 'Elite',
};

export const SKILL_GROUP_FOR_LEVEL = (level: number): SkillLevelGroup =>
  level <= 3 ? 'Group1To3' : level <= 6 ? 'Group4To6' : level <= 8 ? 'Group7To8' : 'Group9To10';

const usedNames = new Set<string>();
function uniqueName(): [string, string] {
  for (;;) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    if (!usedNames.has(first + last)) {
      usedNames.add(first + last);
      return [first, last];
    }
  }
}

export interface MockCoach extends CoachProfileDto {
  email: string;
  rating: number;
  reviewCount: number;
  level: CoachLevel;
}

export const COACHES: MockCoach[] = Array.from({ length: 40 }, (_, i) => {
  const [firstName, lastName] = uniqueName();
  const specialties = pickSome(SPECIALTIES, 2, 4);
  const skillLevelGroups = pickSome(SKILL_GROUPS, 1, 3).sort(
    (a, b) => SKILL_GROUPS.indexOf(a) - SKILL_GROUPS.indexOf(b),
  );
  const yearsCoaching = between(2, 25);
  const level = LEVEL_BY_GROUP[skillLevelGroups[skillLevelGroups.length - 1]];
  const levelPremium = { Beginner: 0, Intermediate: 6, Advanced: 14, Elite: 24 }[level];
  return {
    userId: mockId('c', i + 1),
    email: `${firstName}.${lastName}@coaches.example`.toLowerCase(),
    firstName,
    lastName,
    city: i < 16 ? 'Skopje' : pick(CITIES),
    profileImageUrl: null,
    hourlyRate: 20 + levelPremium + Math.min(yearsCoaching, 15) + between(0, 6),
    yearsCoaching,
    diplomas: pick([
      'National Tennis Federation Level 2 coaching certificate',
      'ITF Level 1 Coaching Beginner and Intermediate Players',
      'Sports Science degree, federation Level 3 coach',
      'Certified club coach, strength and conditioning diploma',
    ]),
    coachingHistory:
      `${yearsCoaching} years of coaching at club level. Works mostly with ` +
      `${level.toLowerCase()} players on ${specialties.map(s => s.replace(/([A-Z])/g, ' $1').trim().toLowerCase()).join(', ')}.`,
    trainingStyle: pick(STYLES),
    acceptingNewPlayers: rand() > 0.15,
    bio: rand() > 0.4 ? 'Synthetic demo coach. Sessions focus on clear goals and steady progress.' : null,
    specialties,
    preferredSurfaces: pickSome(SURFACES, 1, 2),
    skillLevelGroups,
    ageGroups: pickSome(AGE_GROUPS, 1, 3),
    coachingApproaches: pickSome(APPROACHES, 1, 3),
    createdAt: new Date(Date.UTC(2025, between(0, 11), between(1, 28))).toISOString(),
    rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
    reviewCount: between(3, 180),
    level,
  };
});

export interface MockPlayer extends PlayerProfileDto {
  email: string;
}

export const PLAYERS: MockPlayer[] = Array.from({ length: 24 }, (_, i) => {
  const [firstName, lastName] = uniqueName();
  return {
    userId: mockId('p', i + 1),
    email: `${firstName}.${lastName}@players.example`.toLowerCase(),
    firstName,
    lastName,
    city: i < 10 ? 'Skopje' : pick(CITIES),
    profileImageUrl: null,
    dateOfBirth: `${between(1975, 2008)}-0${between(1, 9)}-1${between(0, 9)}`,
    skillLevel: between(1, 9),
    preferredHand: rand() > 0.85 ? 'Left' : 'Right',
    backhandType: rand() > 0.3 ? 'TwoHanded' : 'OneHanded',
    yearsPlaying: between(0, 20),
    mainGoals: pickSome(GOALS, 1, 3),
    preferredSurface: pick([...SURFACES, 'NoPreference'] as Surface[]),
    trainingDaysPerWeek: between(1, 5),
    trainingFrequencyPerDay: 'OncePerDay',
    preferredSessionDurationMinutes: pick([60, 90, 120]),
    preferredCoachingStyle: pick(STYLES),
    favoritePlayer: '',
    favoritePlayerNone: true,
    wantsToPlayLike: '',
    wantsToPlayLikeNone: true,
    bio: null,
    createdAt: new Date(Date.UTC(2025, between(0, 11), between(1, 28))).toISOString(),
  };
});

/** Profile given to a visitor who signs up or logs in with an unknown email. */
export function defaultPlayerProfile(): Omit<PlayerProfileDto, 'userId' | 'firstName' | 'lastName' | 'city' | 'createdAt'> {
  return {
    profileImageUrl: null,
    dateOfBirth: '1996-05-14',
    skillLevel: 5,
    preferredHand: 'Right',
    backhandType: 'TwoHanded',
    yearsPlaying: 4,
    mainGoals: ['ImproveTechnique', 'ImproveServe'],
    preferredSurface: 'Clay',
    trainingDaysPerWeek: 3,
    trainingFrequencyPerDay: 'OncePerDay',
    preferredSessionDurationMinutes: 60,
    preferredCoachingStyle: 'Balanced',
    favoritePlayer: '',
    favoritePlayerNone: true,
    wantsToPlayLike: '',
    wantsToPlayLikeNone: true,
    bio: null,
  };
}
