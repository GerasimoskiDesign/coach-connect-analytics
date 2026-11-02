import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';

// Endpoints that must not receive a Bearer token — they authenticate via credentials
// or are publicly accessible. Checked against the path suffix (after stripping the
// query string) rather than a substring match, so a future route like
// /auth/login-history would not accidentally be skipped.
const AUTH_SKIP_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/confirm-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isSkipped(url: string): boolean {
  const path = url.split('?')[0];
  return AUTH_SKIP_PATHS.some(p => path.endsWith(p));
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenService).getAccessToken();

  if (!token || isSkipped(req.url)) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
