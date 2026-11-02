import { CoachProfileDto } from '../models/discovery.models';
import { RecommendedCoachDto } from '../models/recommendation.models';
import { GaItem } from './analytics.models';

/** One mapping from a coach to a GA4 item, shared by every ecommerce event. */
export function coachItem(coach: CoachProfileDto | RecommendedCoachDto, index?: number): GaItem {
  const category = 'primarySpecialty' in coach ? coach.primarySpecialty : coach.specialties[0];
  const item: GaItem = {
    item_id: coach.userId,
    item_name: `${coach.firstName} ${coach.lastName}`,
    item_category: category,
    item_variant: coach.level ?? 'Unknown',
    price: coach.hourlyRate,
  };
  if (index !== undefined) item.index = index;
  return item;
}
