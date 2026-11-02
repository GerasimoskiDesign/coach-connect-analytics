import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Subject, catchError, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

// Marks a retried request so the interceptor does not enter another refresh cycle
// if the retry also returns 401. HttpContextToken keeps this flag invisible in the
// network tab — it is never serialised into the actual HTTP request.
const IS_RETRY = new HttpContextToken<boolean>(() => false);

// Module-level state shared across all concurrent requests in the same app instance.
//
// refreshSubject is a plain Subject (not BehaviorSubject) and is recreated at the
// start of every refresh cycle. This means:
//   - new subscribers see nothing until the cycle emits — no stale-value replay
//   - on success:  .next(token) + .complete() — queued requests fire and finish cleanly
//   - on failure:  .error(err)               — queued requests receive the error and
//                                               terminate rather than blocking forever
//
// isRefreshing gates the cycle so exactly one token exchange runs at a time.
let isRefreshing = false;
let refreshSubject = new Subject<string>();

function trailingPath(url: string): string {
  return url.split('?')[0];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);

  return next(req).pipe(
    catchError(err => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      const path = trailingPath(req.url);

      // The refresh endpoint itself returned 401 — the refresh token is invalid or
      // revoked. Reset shared state and force logout; nothing left to retry.
      if (path.endsWith('/auth/refresh')) {
        isRefreshing = false;
        refreshSubject.error(err); // unblock any queued requests with an error
        refreshSubject = new Subject<string>();
        authService.logout();
        return throwError(() => err);
      }

      // These endpoints authenticate via credentials, not tokens. A 401 here is a
      // business error (bad password, expired link, etc.) — do not attempt a token
      // refresh or trigger logout.
      const credentialPaths = [
        '/auth/login',
        '/auth/register',
        '/auth/logout',
        '/auth/confirm-email',
      ];
      if (credentialPaths.some(p => path.endsWith(p))) {
        return throwError(() => err);
      }

      // This request was already retried with a fresh token and still got 401 —
      // the session is genuinely invalid. Logout.
      if (req.context.get(IS_RETRY)) {
        authService.logout();
        return throwError(() => err);
      }

      // No refresh token in storage — no recovery path. Logout.
      if (!tokenService.getRefreshToken()) {
        authService.logout();
        return throwError(() => err);
      }

      // A refresh is already in flight. Queue behind it by subscribing to the current
      // cycle's Subject. take(1) ensures each queued request fires exactly once.
      // If the refresh fails, refreshSubject.error() propagates here automatically —
      // queued requests error out rather than blocking forever.
      if (isRefreshing) {
        return refreshSubject.pipe(
          take(1),
          switchMap(newToken =>
            next(req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
              context: req.context.set(IS_RETRY, true),
            }))
          )
        );
      }

      // No refresh in flight — start one. Create a fresh Subject so this cycle has
      // no retained state from any previous refresh.
      isRefreshing = true;
      refreshSubject = new Subject<string>();

      return authService.refresh().pipe(
        switchMap(res => {
          isRefreshing = false;
          refreshSubject.next(res.accessToken); // unblocks all queued requests
          refreshSubject.complete();
          return next(req.clone({
            setHeaders: { Authorization: `Bearer ${res.accessToken}` },
            context: req.context.set(IS_RETRY, true),
          }));
        }),
        catchError(refreshErr => {
          isRefreshing = false;
          refreshSubject.error(refreshErr); // queued requests receive the error and terminate
          refreshSubject = new Subject<string>(); // ready for next cycle
          authService.logout();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
