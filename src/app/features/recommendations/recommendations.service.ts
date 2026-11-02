import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecommendedCoachDto, RecommendedPlayerDto } from '../../core/models/recommendation.models';

/** Step 5C wire contract of POST /admin/reload on the Python ML service.
 *  Property names are snake_case because they go on the wire literally. */
export interface MlNewPlayerPayload {
  user_id: string;
  skill_level: number;
  city: string;
  main_goals: string[];
  preferred_surfaces: string[];
  coaching_approaches: string[];
}

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getCoachRecommendations(): Observable<RecommendedCoachDto[]> {
    return this.http.get<RecommendedCoachDto[]>(`${this.base}/recommendations/me?type=coaches`);
  }

  getPlayerRecommendations(): Observable<RecommendedPlayerDto[]> {
    return this.http.get<RecommendedPlayerDto[]>(`${this.base}/recommendations/me?type=players`);
  }

  /** Step 5C: inject a freshly onboarded player into the ML service's
   *  in-memory index so the dashboard shows ranked results immediately.
   *  Fire-and-forget — callers subscribe with errors ignored; the ML
   *  service is an optional dependency and this call must never affect
   *  the onboarding flow. No-op when no ML URL is configured (prod). */
  notifyNewPlayer(payload: MlNewPlayerPayload): Observable<unknown> {
    if (!environment.mlServiceUrl) {
      return EMPTY;
    }
    return this.http.post(`${environment.mlServiceUrl}/admin/reload`, { new_player: payload });
  }
}
