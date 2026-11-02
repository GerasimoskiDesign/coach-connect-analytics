import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoachPlayerProgressionDto, ProgressionEventDto } from '../../core/models/progression.models';

@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getMyProgression(): Observable<CoachPlayerProgressionDto[]> {
    return this.http.get<CoachPlayerProgressionDto[]>(`${this.base}/progression/me`);
  }

  getMyEvents(): Observable<ProgressionEventDto[]> {
    return this.http.get<ProgressionEventDto[]>(`${this.base}/progression/me/events`);
  }
}
