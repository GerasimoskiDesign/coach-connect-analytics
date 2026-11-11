import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, EMPTY, map, Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { AuthResponseDto, LoginRequest, LoginResult, RegisterRequest, UserDto } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly base = environment.apiUrl;

  readonly currentUser$ = new BehaviorSubject<UserDto | null>(null);

  constructor() {
    this.bootstrap();
  }

  private bootstrap(): void {
    if (!this.tokenService.getAccessToken()) return;

    // Stale-while-revalidate: paint the cached user immediately to avoid UI flicker,
    // then verify with the server. On 401, ErrorInterceptor attempts a token refresh;
    // if that also fails it calls logout(). On a plain network error we keep the
    // cached value so the user is not bounced just because they are temporarily offline.
    this.currentUser$.next(this.tokenService.getUser());

    this.http.get<UserDto>(`${this.base}/auth/me`).pipe(
      catchError(() => EMPTY)
    ).subscribe(fresh => {
      this.tokenService.setUser(fresh);
      this.currentUser$.next(fresh);
    });
  }

  login(req: LoginRequest): Observable<LoginResult> {
    return this.http.post<AuthResponseDto>(`${this.base}/auth/login`, req).pipe(
      tap(res => this.tokenService.setTokens(res.accessToken, res.refreshToken)),
      switchMap(res => this.http.get<UserDto>(`${this.base}/auth/me`).pipe(
        map(user => ({ user, accountCreated: res.accountCreated === true })),
      )),
      tap(({ user }) => {
        this.tokenService.setUser(user);
        this.currentUser$.next(user);
      })
    );
  }

  register(req: RegisterRequest): Observable<UserDto> {
    return this.http.post<AuthResponseDto>(`${this.base}/auth/register`, req).pipe(
      tap(res => this.tokenService.setTokens(res.accessToken, res.refreshToken)),
      switchMap(() => this.http.get<UserDto>(`${this.base}/auth/me`)),
      tap(user => {
        this.tokenService.setUser(user);
        this.currentUser$.next(user);
      })
    );
  }

  logout(): void {
    // Clear local state first so the UI updates instantly; server-side revocation
    // is fire-and-forget — we do not block on the network call.
    const refreshToken = this.tokenService.getRefreshToken();
    this.tokenService.clearAll();
    this.currentUser$.next(null);
    this.router.navigate(['/login']);

    if (refreshToken) {
      this.http.post(`${this.base}/auth/logout`, { refreshToken }).pipe(
        catchError(() => EMPTY)
      ).subscribe();
    }
  }

  // Called exclusively by ErrorInterceptor on 401. Merges the fields present in
  // AuthResponseDto (userId, email, role, emailConfirmed, isOnboarded) into the
  // existing UserDto so that state changes made in another tab (e.g. email confirmation)
  // are reflected without a separate /auth/me call. Fields not carried by AuthResponseDto
  // (firstName, lastName, city, phoneNumber, createdAt) are preserved from the cache.
  refresh(): Observable<AuthResponseDto> {
    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<AuthResponseDto>(`${this.base}/auth/refresh`, { refreshToken }).pipe(
      tap(res => {
        this.tokenService.setTokens(res.accessToken, res.refreshToken);
        const current = this.currentUser$.value;
        if (current) {
          const merged: UserDto = {
            ...current,
            userId: res.userId,
            email: res.email,
            role: res.role,
            emailConfirmed: res.emailConfirmed,
            isOnboarded: res.isOnboarded,
          };
          this.tokenService.setUser(merged);
          this.currentUser$.next(merged);
        }
      })
    );
  }

  confirmEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/confirm-email`, { token });
  }

  refreshCurrentUser(): void {
    if (!this.tokenService.getAccessToken()) return;
    this.http.get<UserDto>(`${this.base}/auth/me`).pipe(
      catchError(() => EMPTY)
    ).subscribe(fresh => {
      this.tokenService.setUser(fresh);
      this.currentUser$.next(fresh);
    });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/reset-password`, { token, newPassword });
  }

  setUser(user: UserDto): void {
    this.tokenService.setUser(user);
    this.currentUser$.next(user);
  }

  get currentUser(): UserDto | null {
    return this.currentUser$.value;
  }

  // An expired access token is recoverable via refresh, so we only consider the
  // user unauthenticated when there is no refresh token left.
  isAuthenticated(): boolean {
    return this.currentUser$.value !== null && this.tokenService.getRefreshToken() !== null;
  }
}
