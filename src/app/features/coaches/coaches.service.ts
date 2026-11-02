import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoachFilterParams, CoachProfileDto } from '../../core/models/discovery.models';

@Injectable({ providedIn: 'root' })
export class CoachesService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getCoaches(filters: CoachFilterParams = {}): Observable<CoachProfileDto[]> {
    let params = new HttpParams();
    if (filters.surface != null) params = params.set('surface', filters.surface);
    if (filters.skillLevelGroup != null) params = params.set('skillLevelGroup', filters.skillLevelGroup);
    if (filters.ageGroup != null) params = params.set('ageGroup', filters.ageGroup);
    if (filters.trainingStyle != null) params = params.set('trainingStyle', filters.trainingStyle);
    if (filters.acceptingNewPlayers != null) params = params.set('acceptingNewPlayers', String(filters.acceptingNewPlayers));
    if (filters.city != null) params = params.set('city', filters.city);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.page != null) params = params.set('page', String(filters.page));
    if (filters.pageSize != null) params = params.set('pageSize', String(filters.pageSize));
    return this.http.get<CoachProfileDto[]>(`${this.base}/coaches`, { params });
  }

  getCoachById(id: string): Observable<CoachProfileDto> {
    return this.http.get<CoachProfileDto>(`${this.base}/coaches/${id}`);
  }
}
