import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoachOnboardingDto, PlayerOnboardingDto, UserDto } from '../../core/models/auth.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  completePlayerOnboarding(dto: PlayerOnboardingDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.base}/players/me/onboarding`, dto);
  }

  completeCoachOnboarding(dto: CoachOnboardingDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.base}/coaches/me/onboarding`, dto);
  }
}
