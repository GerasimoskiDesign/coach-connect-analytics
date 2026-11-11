export type PreferredHand = 'Left' | 'Right';
export type BackhandType = 'OneHanded' | 'TwoHanded';
export type MainGoal =
  | 'ImproveTechnique'
  | 'ImproveFitness'
  | 'PrepareForTournaments'
  | 'FindHittingPartners'
  | 'ReturnToTennis'
  | 'TrainRecreationally'
  | 'BecomeProfessional'
  | 'ImproveServe'
  | 'ImproveFootwork'
  | 'ImproveConsistency'
  | 'ImproveMatchPlay'
  | 'ReduceInjuryRisk'
  | 'PlayCompetitivelyAgain'
  | 'LearnTennis'
  | 'ImproveMentalGame'
  | 'FindSocialPlaying';
export type Surface = 'Clay' | 'HardCourt' | 'Grass' | 'NoPreference';
export type TrainingFrequencyPerDay = 'OncePerDay' | 'TwicePerDay' | 'Flexible';
export type CoachingStyle = 'Demanding' | 'Balanced' | 'Relaxed';
export type Specialty =
  | 'Technique'
  | 'Serve'
  | 'Forehand'
  | 'Backhand'
  | 'Footwork'
  | 'Fitness'
  | 'MatchStrategy'
  | 'TournamentPreparation'
  | 'JuniorDevelopment'
  | 'BeginnerCoaching';
export type SkillLevelGroup = 'Group1To3' | 'Group4To6' | 'Group7To8' | 'Group9To10';
export type AgeGroup = 'Children6To12' | 'Juniors13To18' | 'Adults18Plus' | 'Seniors35Plus';
export type CoachingApproach =
  | 'BeginnerFriendly'
  | 'InjuryRehabilitation'
  | 'MentalGame'
  | 'TournamentPreparation'
  | 'RecreationalFocus'
  | 'FitnessOriented'
  | 'ReturnToSport'
  | 'ConsistencyBuilding'
  | 'AdvancedTechnique'
  | 'YouthDevelopment';

export interface UserDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Player' | 'Coach';
  city: string;
  phoneNumber: string;
  emailConfirmed: boolean;
  isOnboarded: boolean;
  createdAt: string;
}

export interface AuthResponseDto {
  userId: string;
  email: string;
  role: 'Player' | 'Coach';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  emailConfirmed: boolean;
  isOnboarded: boolean;
  /** Demo mock only: true when this login created the account (unknown email). */
  accountCreated?: boolean;
}

/** Result of a login: the user, and whether the demo backend created the account on the fly. */
export interface LoginResult {
  user: UserDto;
  accountCreated: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PlayerOnboardingDto {
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
  bio?: string;
}

export interface CoachOnboardingDto {
  hourlyRate: number;
  yearsCoaching: number;
  diplomas: string;
  coachingHistory: string;
  trainingStyle: CoachingStyle;
  acceptingNewPlayers: boolean;
  specialties: Specialty[];
  preferredSurfaces: Surface[];
  skillLevelGroups: SkillLevelGroup[];
  ageGroups: AgeGroup[];
  coachingApproaches: CoachingApproach[];
  bio?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  city: string;
  role: 'Player' | 'Coach';
  playerProfile: PlayerOnboardingDto | null;
  coachProfile: CoachOnboardingDto | null;
}
