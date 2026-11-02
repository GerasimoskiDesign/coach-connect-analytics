import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthLayoutComponent } from '../../../shared/ui/auth-layout/auth-layout.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [RouterLink, AuthLayoutComponent, ButtonComponent],
  template: `
    <app-auth-layout title="Email confirmation">
      @if (status === 'loading') {
        <p class="message">Confirming your email…</p>
      }
      @if (status === 'success') {
        <p class="message">Your email has been confirmed.</p>
        @if (isLoggedIn) {
          <app-button label="Go to dashboard" (click)="goToDashboard()" />
        } @else {
          <app-button label="Go to sign in" (click)="goToLogin()" />
        }
      }
      @if (status === 'error') {
        <p class="message error">This confirmation link is invalid or has expired.</p>
        <a routerLink="/login" class="back-link">Back to sign in</a>
      }
    </app-auth-layout>
  `,
  styles: [`
    .message {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
    }

    .error {
      color: var(--color-danger);
    }

    .back-link {
      display: block;
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-accent);
      font-weight: var(--font-medium);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  `],
})
export class ConfirmEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  status: 'loading' | 'success' | 'error' = 'loading';
  isLoggedIn = false;

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isAuthenticated();
    const token: string | undefined = this.route.snapshot.queryParams['token'];
    if (!token) {
      this.status = 'error';
      return;
    }
    this.authService.confirmEmail(token).subscribe({
      next: () => {
        this.authService.refreshCurrentUser();
        this.status = 'success';
      },
      error: () => { this.status = 'error'; },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
