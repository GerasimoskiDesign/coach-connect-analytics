import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { onboardingRequiredGuard } from './core/guards/onboarding-required.guard';
import { AuthService } from './core/services/auth.service';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const auth = inject(AuthService);
      return auth.isAuthenticated() ? '/dashboard' : '/login';
    },
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'confirm-email',
    loadComponent: () =>
      import('./features/auth/confirm-email/confirm-email.component').then(m => m.ConfirmEmailComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'dashboard',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: 'profile',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'coaches',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/coaches/coaches.component').then(m => m.CoachesComponent),
  },
  {
    path: 'coaches/:id',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/coaches/coach-profile/coach-profile.component').then(m => m.CoachProfileComponent),
  },
  {
    path: 'players',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/players/players.component').then(m => m.PlayersComponent),
  },
  {
    path: 'players/:id',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/players/player-profile/player-profile.component').then(m => m.PlayerProfileComponent),
  },
  {
    path: 'requests',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/session-requests/requests/requests.component').then(m => m.RequestsComponent),
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
