export type SessionRequestStatus = 'Pending' | 'Accepted' | 'Declined' | 'Rescheduled' | 'Expired';
export type SessionType = 'CoachPlayer' | 'PlayerPlayer';

export interface TennisClubDto {
  id: string;
  name: string;
}

export interface SessionRequestDto {
  id: string;
  requesterId: string;
  requesterFirstName: string;
  requesterLastName: string;
  receiverId: string;
  receiverFirstName: string;
  receiverLastName: string;
  tennisClubId: string;
  tennisClubName: string;
  parentRequestId: string | null;
  rescheduleCount: number;
  status: SessionRequestStatus;
  sessionType: SessionType;
  proposedDateTime: string;
  durationMinutes: number;
  note: string | null;
  createdAt: string;
  estimatedPriceMkd: number | null;
}

export interface CreateSessionRequestDto {
  receiverId: string;
  tennisClubId: string;
  proposedDateTime: string;
  durationMinutes: number;
  note?: string;
}

export interface RescheduleSessionRequestDto {
  tennisClubId: string;
  proposedDateTime: string;
  durationMinutes: number;
  note?: string;
}

export interface UpcomingSessionDto {
  id: string;
  counterpartUserId: string;
  counterpartFirstName: string;
  counterpartLastName: string;
  counterpartRole: 'Player' | 'Coach';
  tennisClubName: string;
  proposedDateTime: string;
  durationMinutes: number;
  sessionType: SessionType;
  estimatedPriceMkd: number | null;
}

export interface CompletedSessionDto {
  id: string;
  counterpartUserId: string;
  counterpartFirstName: string;
  counterpartLastName: string;
  counterpartRole: 'Player' | 'Coach';
  tennisClubName: string;
  proposedDateTime: string;
  durationMinutes: number;
  sessionType: SessionType;
  estimatedPriceMkd: number | null;
}

/** Demo-only: result of the mock checkout (POST /payments). */
export interface PaymentDto {
  transactionId: string;
  sessionRequestId: string;
  amount: number;
  currency: 'EUR';
  status: 'paid';
  paidAt: string;
}
