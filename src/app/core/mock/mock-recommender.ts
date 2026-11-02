// Stand-in for the excluded Python ML service. Two ranking algorithms, one per
// A/B variant, so GA4 can compare click-through and bookings between them.

import { PlayerProfileDto } from '../models/discovery.models';
import { RecVariant, RecommendedCoachDto, RecommendedPlayerDto } from '../models/recommendation.models';
import { MainGoal, Specialty } from '../models/auth.models';
import { COACHES, MockCoach, PLAYERS, SKILL_GROUP_FOR_LEVEL } from './mock-data';

const RESULT_SIZE = 10;

const GOAL_TO_SPECIALTIES: Partial<Record<MainGoal, Specialty[]>> = {
  ImproveTechnique: ['Technique', 'Forehand', 'Backhand'],
  ImproveFitness: ['Fitness', 'Footwork'],
  PrepareForTournaments: ['TournamentPreparation', 'MatchStrategy'],
  ReturnToTennis: ['Technique', 'BeginnerCoaching'],
  TrainRecreationally: ['BeginnerCoaching', 'Technique'],
  ImproveServe: ['Serve'],
  ImproveFootwork: ['Footwork'],
  ImproveConsistency: ['Technique', 'Forehand', 'Backhand'],
  ImproveMatchPlay: ['MatchStrategy'],
  LearnTennis: ['BeginnerCoaching'],
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const label = (s: string): string => s.replace(/([A-Z])/g, ' $1').trim();

/** Content-based: how well the coach's profile fits the player's own profile. */
function contentScore(c: MockCoach, me: PlayerProfileDto): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (c.skillLevelGroups.includes(SKILL_GROUP_FOR_LEVEL(me.skillLevel))) {
    score += 0.35;
    reasons.push(`Coaches players at your level (${me.skillLevel})`);
  }
  const wanted = new Set(me.mainGoals.flatMap(g => GOAL_TO_SPECIALTIES[g] ?? []));
  const overlap = c.specialties.filter(s => wanted.has(s));
  if (overlap.length > 0) {
    score += Math.min(0.3, 0.15 * overlap.length);
    reasons.push(`Specialises in ${overlap.map(label).join(', ').toLowerCase()}`);
  }
  if (me.preferredSurface === 'NoPreference' || c.preferredSurfaces.includes(me.preferredSurface)) {
    score += 0.1;
    reasons.push(`Trains on ${label(me.preferredSurface === 'NoPreference' ? c.preferredSurfaces[0] : me.preferredSurface).toLowerCase()}`);
  }
  if (c.city === me.city) {
    score += 0.15;
    reasons.push(`Based in ${c.city}`);
  }
  if (c.trainingStyle === me.preferredCoachingStyle) score += 0.05;
  if (c.acceptingNewPlayers) score += 0.05;

  return { score: round3(Math.min(1, score)), reasons };
}

const MAX_REVIEWS = Math.max(...COACHES.map(c => c.reviewCount));

/** Popularity: Bayesian-smoothed rating blended with review volume. Ignores the player. */
function popularityScore(c: MockCoach): { score: number; reasons: string[] } {
  const prior = 4.2;
  const weight = 20;
  const bayes = (c.rating * c.reviewCount + prior * weight) / (c.reviewCount + weight);
  const volume = Math.log1p(c.reviewCount) / Math.log1p(MAX_REVIEWS);
  const score = round3(0.6 * (bayes / 5) + 0.4 * volume);
  return { score, reasons: [`Rated ${c.rating.toFixed(1)} by ${c.reviewCount} players`, 'Popular with players this month'] };
}

export function recommendCoaches(me: PlayerProfileDto, variant: RecVariant): RecommendedCoachDto[] {
  return COACHES
    .filter(c => c.acceptingNewPlayers)
    .map(c => ({ c, ...(variant === 'content_based' ? contentScore(c, me) : popularityScore(c)) }))
    // Stable tie-break on id so ranks never shuffle between loads.
    .sort((a, b) => b.score - a.score || a.c.userId.localeCompare(b.c.userId))
    .slice(0, RESULT_SIZE)
    .map(({ c, score, reasons }, i) => ({
      userId: c.userId,
      firstName: c.firstName,
      lastName: c.lastName,
      city: c.city,
      hourlyRate: c.hourlyRate,
      primarySpecialty: c.specialties[0],
      level: c.level,
      score,
      rank: i + 1,
      reasons,
    }));
}

export function recommendPlayers(me: { userId: string; city: string; skillLevel: number }): RecommendedPlayerDto[] {
  return PLAYERS
    .filter(p => p.userId !== me.userId)
    .map(p => {
      const gap = Math.abs(p.skillLevel - me.skillLevel);
      const score = round3(Math.max(0, 1 - gap * 0.15) * (p.city === me.city ? 1 : 0.8));
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || a.p.userId.localeCompare(b.p.userId))
    .slice(0, RESULT_SIZE)
    .map(({ p, score }, i) => ({
      userId: p.userId,
      firstName: p.firstName,
      lastName: p.lastName,
      city: p.city,
      skillLevel: p.skillLevel,
      score,
      rank: i + 1,
      reasons: [`Skill level ${p.skillLevel}`, `Plays in ${p.city}`],
    }));
}
