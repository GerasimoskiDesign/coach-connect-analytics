import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlayerFilterParams, PlayerProfileDto } from '../../core/models/discovery.models';

@Injectable({ providedIn: 'root' })
export class PlayersService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getPlayers(filters: PlayerFilterParams = {}): Observable<PlayerProfileDto[]> {
    let params = new HttpParams();
    if (filters.minSkillLevel != null) params = params.set('minSkillLevel', String(filters.minSkillLevel));
    if (filters.maxSkillLevel != null) params = params.set('maxSkillLevel', String(filters.maxSkillLevel));
    if (filters.preferredSurface != null) params = params.set('preferredSurface', filters.preferredSurface);
    if (filters.city != null) params = params.set('city', filters.city);
    if (filters.excludeUserId != null) params = params.set('excludeUserId', filters.excludeUserId);
    if (filters.page != null) params = params.set('page', String(filters.page));
    if (filters.pageSize != null) params = params.set('pageSize', String(filters.pageSize));
    return this.http.get<PlayerProfileDto[]>(`${this.base}/players`, { params });
  }

  getPlayerById(id: string): Observable<PlayerProfileDto> {
    return this.http.get<PlayerProfileDto>(`${this.base}/players/${id}`);
  }
}
