import { CoachProfileDto } from '../models/discovery.models';
import { RecommendedCoachDto, RecommendedPlayerDto } from '../models/recommendation.models';
import { GaItem, InteractionType, PlayerLevel, RoleParam } from './analytics.models';

// No names in analytics: item_name is a neutral label built from the ID, never
// the coach's or player's real name. item_id carries the stable identifier.
const shortId = (id: string): string => id.replace(/-/g, '').slice(0, 8);

/** One mapping from a coach to a GA4 item, shared by every ecommerce event. */
export function coachItem(coach: CoachProfileDto | RecommendedCoachDto, index?: number): GaItem {
  const category = 'primarySpecialty' in coach ? coach.primarySpecialty : coach.specialties[0];
  const item: GaItem = {
    item_id: coach.userId,
    item_name: `Coach ${shortId(coach.userId)}`,
    item_category: category,
    item_variant: coach.level ?? 'Unknown',
    price: coach.hourlyRate,
  };
  if (index !== undefined) item.index = index;
  return item;
}

/** A recommended practice partner as a GA4 item. Practice sessions are free, so price is 0. */
export function playerItem(player: RecommendedPlayerDto, index?: number): GaItem {
  const item: GaItem = {
    item_id: player.userId,
    item_name: `Player ${shortId(player.userId)}`,
    item_category: 'player',
    item_variant: playerLevel(player.skillLevel),
    price: 0,
  };
  if (index !== undefined) item.index = index;
  return item;
}

/** Skill level 1-10 to a reporting band: 1-4 amateur, 5-7 intermediate, 8-10 professional. */
export function playerLevel(skillLevel: number): PlayerLevel {
  if (skillLevel >= 8) return 'professional';
  if (skillLevel >= 5) return 'intermediate';
  return 'amateur';
}

export function roleParam(role: 'Player' | 'Coach'): RoleParam {
  return role === 'Coach' ? 'coach' : 'player';
}

export function interactionType(requester: RoleParam, receiver: RoleParam): InteractionType {
  if (requester === 'coach') return 'coach_player';
  return receiver === 'coach' ? 'player_coach' : 'player_player';
}
