import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, merge, of, Subject, switchMap, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly refreshTrigger$ = new Subject<void>();

  private readonly _pendingCount = signal(0);
  readonly pendingCount = this._pendingCount.asReadonly();

  constructor() {
    this.authService.currentUser$.pipe(
      switchMap(user =>
        user
          ? merge(of(void 0), this.refreshTrigger$).pipe(
              switchMap(() =>
                timer(0, 30_000).pipe(
                  switchMap(() =>
                    this.http.get<unknown[]>(`${environment.apiUrl}/session-requests/inbox`).pipe(
                      catchError(() => of(undefined))
                    )
                  )
                )
              )
            )
          : of(null)
      )
    ).subscribe(result => {
      if (result === null) {
        this._pendingCount.set(0);
      } else if (Array.isArray(result)) {
        this._pendingCount.set(result.length);
      }
      // undefined = transient HTTP error: keep last known count
    });
  }

  refresh(): void {
    this.refreshTrigger$.next();
  }
}
