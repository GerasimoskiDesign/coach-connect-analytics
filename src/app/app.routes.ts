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
    // Keep the query string: GTM Preview adds gtm_debug to the URL and reads it
    // when gtm.js runs, which can be after this redirect.
    redirectTo: ({ queryParams }) => {
      const auth = inject(AuthService);
      const target = auth.isAuthenticated() ? '/dashboard' : '/login';
      const query = new URLSearchParams(queryParams).toString();
      return query ? `${target}?${query}` : target;
    },
  },
  {
    path: 'login',
    title: 'Log in | Coach Connect+',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Sign up | Coach Connect+',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'confirm-email',
    title: 'Confirm email | Coach Connect+',
    loadComponent: () =>
      import('./features/auth/confirm-email/confirm-email.component').then(m => m.ConfirmEmailComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password | Coach Connect+',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    title: 'Reset password | Coach Connect+',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'dashboard',
    title: 'Dashboard | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'onboarding',
    title: 'Onboarding | Coach Connect+',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: 'profile',
    title: 'Profile | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'coaches',
    title: 'Find a coach | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/coaches/coaches.component').then(m => m.CoachesComponent),
  },
  {
    path: 'coaches/:id',
    title: 'Coach profile | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/coaches/coach-profile/coach-profile.component').then(m => m.CoachProfileComponent),
  },
  {
    path: 'players',
    title: 'Find a player | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/players/players.component').then(m => m.PlayersComponent),
  },
  {
    path: 'players/:id',
    title: 'Player profile | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/players/player-profile/player-profile.component').then(m => m.PlayerProfileComponent),
  },
  {
    path: 'requests',
    title: 'Requests | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/session-requests/requests/requests.component').then(m => m.RequestsComponent),
  },
  {
    path: 'checkout/:requestId',
    title: 'Checkout | Coach Connect+',
    canActivate: [onboardingRequiredGuard],
    loadComponent: () =>
      import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
