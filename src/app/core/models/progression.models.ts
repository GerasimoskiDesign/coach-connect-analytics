export interface CoachPlayerProgressionDto {
  relationshipId: string;
  counterpartUserId: string;
  counterpartFirstName: string;
  counterpartLastName: string;
  totalHours: number;
  currentLevel: number;
  discountPercent: number;
  isResetExempt: boolean;
  lastSessionCompletedAt: string | null;
}

export type ProgressionEventType = 'SessionCompleted' | 'LevelUp' | 'Reset';

export interface ProgressionEventDto {
  id: string;
  eventType: ProgressionEventType;
  counterpartFirstName: string;
  counterpartLastName: string;
  hoursAdded: number | null;
  oldLevel: number;
  newLevel: number;
  newTotalHours: number;
  createdAt: string;
}
