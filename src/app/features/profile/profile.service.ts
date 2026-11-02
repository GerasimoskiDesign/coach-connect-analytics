import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoachOnboardingDto, PlayerOnboardingDto, UserDto } from '../../core/models/auth.models';
import { CoachProfileDto, PlayerProfileDto } from '../../core/models/discovery.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getMyPlayerProfile(): Observable<PlayerProfileDto> {
    return this.http.get<PlayerProfileDto>(`${this.base}/players/me/profile`);
  }

  getMyCoachProfile(): Observable<CoachProfileDto> {
    return this.http.get<CoachProfileDto>(`${this.base}/coaches/me/profile`);
  }

  savePlayerProfile(dto: PlayerOnboardingDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.base}/players/me/onboarding`, dto);
  }

  saveCoachProfile(dto: CoachOnboardingDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.base}/coaches/me/onboarding`, dto);
  }
}
