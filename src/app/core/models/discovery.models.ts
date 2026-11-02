import {
  AgeGroup,
  BackhandType,
  CoachingApproach,
  CoachingStyle,
  MainGoal,
  PreferredHand,
  SkillLevelGroup,
  Specialty,
  Surface,
  TrainingFrequencyPerDay,
} from './auth.models';

export interface CoachProfileDto {
  userId: string;
  firstName: string;
  lastName: string;
  city: string;
  profileImageUrl: string | null;
  hourlyRate: number;
  yearsCoaching: number;
  diplomas: string;
  coachingHistory: string;
  trainingStyle: CoachingStyle;
  acceptingNewPlayers: boolean;
  bio: string | null;
  specialties: Specialty[];
  preferredSurfaces: Surface[];
  skillLevelGroups: SkillLevelGroup[];
  ageGroups: AgeGroup[];
  coachingApproaches: CoachingApproach[];
  createdAt: string;
  // Demo-only fields served by the mock backend (not in the real API contract).
  rating?: number;
  reviewCount?: number;
  level?: CoachLevel;
}

/** Main player level a coach works with. Used as GA4 item_variant. */
export type CoachLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';

export interface PlayerProfileDto {
  userId: string;
  firstName: string;
  lastName: string;
  city: string;
  profileImageUrl: string | null;
  dateOfBirth: string;
  skillLevel: number;
  preferredHand: PreferredHand;
  backhandType: BackhandType;
  yearsPlaying: number;
  mainGoals: MainGoal[];
  preferredSurface: Surface;
  trainingDaysPerWeek: number;
  trainingFrequencyPerDay: TrainingFrequencyPerDay;
  preferredSessionDurationMinutes: number;
  preferredCoachingStyle: CoachingStyle;
  favoritePlayer: string;
  favoritePlayerNone: boolean;
  wantsToPlayLike: string;
  wantsToPlayLikeNone: boolean;
  bio: string | null;
  createdAt: string;
}

export interface CoachFilterParams {
  surface?: Surface;
  skillLevelGroup?: SkillLevelGroup;
  ageGroup?: AgeGroup;
  trainingStyle?: CoachingStyle;
  acceptingNewPlayers?: boolean;
  city?: string;
  /** Free-text search over name, city and specialties. */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface PlayerFilterParams {
  minSkillLevel?: number;
  maxSkillLevel?: number;
  preferredSurface?: Surface;
  city?: string;
  page?: number;
  pageSize?: number;
  excludeUserId?: string;
}
