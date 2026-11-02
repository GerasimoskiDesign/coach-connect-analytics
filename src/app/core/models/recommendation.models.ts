export interface RecommendedCoachDto {
  userId: string;
  firstName: string;
  lastName: string;
  city: string;
  hourlyRate: number;
  primarySpecialty: string;
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
