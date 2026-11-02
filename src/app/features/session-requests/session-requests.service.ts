import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CompletedSessionDto,
  CreateSessionRequestDto,
  RescheduleSessionRequestDto,
  SessionRequestDto,
  UpcomingSessionDto,
} from '../../core/models/session-request.models';

@Injectable({ providedIn: 'root' })
export class SessionRequestsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  create(dto: CreateSessionRequestDto): Observable<SessionRequestDto> {
    return this.http.post<SessionRequestDto>(`${this.base}/session-requests`, dto);
  }

  getInbox(): Observable<SessionRequestDto[]> {
    return this.http.get<SessionRequestDto[]>(`${this.base}/session-requests/inbox`);
  }

  getPending(): Observable<SessionRequestDto[]> {
    return this.http.get<SessionRequestDto[]>(`${this.base}/session-requests/pending`);
  }

  accept(id: string): Observable<SessionRequestDto> {
    return this.http.post<SessionRequestDto>(`${this.base}/session-requests/${id}/accept`, null);
  }

  decline(id: string): Observable<SessionRequestDto> {
    return this.http.post<SessionRequestDto>(`${this.base}/session-requests/${id}/decline`, null);
  }

  reschedule(id: string, dto: RescheduleSessionRequestDto): Observable<SessionRequestDto> {
    return this.http.post<SessionRequestDto>(`${this.base}/session-requests/${id}/reschedule`, dto);
  }

  getUpcoming(): Observable<UpcomingSessionDto[]> {
    return this.http.get<UpcomingSessionDto[]>(`${this.base}/session-requests/upcoming`);
  }

  getCompleted(): Observable<CompletedSessionDto[]> {
    return this.http.get<CompletedSessionDto[]>(`${this.base}/session-requests/completed`);
  }

  getActivity(opts: {
    page: number;
    pageSize: number;
    from?: string | null;
    to?: string | null;
  }): Observable<CompletedSessionDto[]> {
    let params = new HttpParams()
      .set('page', opts.page)
      .set('pageSize', opts.pageSize);
    if (opts.from) params = params.set('from', opts.from);
    if (opts.to) params = params.set('to', opts.to);
    return this.http.get<CompletedSessionDto[]>(`${this.base}/session-requests/activity`, { params });
  }
}
