import { Injectable } from '@angular/core';
import type { UserDto } from '../models/auth.models';

// Token storage uses localStorage for simplicity.
// Trade-off: localStorage is accessible to any JS running on the page (XSS risk).
// httpOnly cookies would eliminate that attack vector but introduce CSRF complexity.
// Acceptable for this project's current threat model.

const ACCESS_KEY = 'cc_access_token';
const REFRESH_KEY = 'cc_refresh_token';
const USER_KEY = 'cc_user';

@Injectable({ providedIn: 'root' })
export class TokenService {

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setTokens(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  getUser(): UserDto | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserDto;
    } catch {
      return null;
    }
  }

  setUser(user: UserDto): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearUser(): void {
    localStorage.removeItem(USER_KEY);
  }

  clearAll(): void {
    this.clearTokens();
    this.clearUser();
  }

  // Decodes the JWT exp claim to check expiry.
  // Used for proactive refresh in future; isAuthenticated() uses refresh token presence instead.
  isAccessTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp < Date.now() / 1000;
    } catch {
      return true;
    }
  }
}
