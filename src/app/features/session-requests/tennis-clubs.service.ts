import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TennisClubDto } from '../../core/models/session-request.models';

@Injectable({ providedIn: 'root' })
export class TennisClubsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getClubs(): Observable<TennisClubDto[]> {
    return this.http.get<TennisClubDto[]>(`${this.base}/tennis-clubs`);
  }
}
