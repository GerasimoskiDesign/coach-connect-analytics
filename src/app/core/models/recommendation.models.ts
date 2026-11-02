export interface RecommendedCoachDto {
  userId: string;
  firstName: string;
  lastName: string;
  city: string;
  hourlyRate: number;
  primarySpecialty: string;
  /** Demo-only: coach level, used as GA4 item_variant. */
  level?: string;
  score: number;
  rank: number;
  reasons: string[];
}

export interface RecommendedPlayerDto {
  userId: string;
  firstName: string;
  lastName: string;
  city: string;
  skillLevel: number;
  score: number;
  rank: number;
  reasons: string[];
}

/** Recommendation ranking algorithm. Assigned per visitor by the A/B test. */
export type RecVariant = 'content_based' | 'popularity';
