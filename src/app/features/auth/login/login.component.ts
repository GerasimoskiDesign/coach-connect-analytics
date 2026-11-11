import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthLayoutComponent } from '../../../shared/ui/auth-layout/auth-layout.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, FormFieldComponent, ButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  passwordResetSuccess = false;

  constructor() {
    this.passwordResetSuccess =
      this.router.getCurrentNavigation()?.extras?.state?.['passwordReset'] === true;
  }

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = false;
  serverError: string | null = null;

  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.serverError = null;
    const v = this.form.getRawValue();
    this.authService.login({ email: v.email, password: v.password }).subscribe({
      next: ({ user, accountCreated }) => {
        // The demo backend creates an account for an unknown email at login:
        // that is a sign-up, not a returning login.
        if (accountCreated) this.analytics.signUp(user, 'auto_login');
        else this.analytics.login(user);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.serverError = this.resolveError(err);
      },
    });
  }

  private resolveError(err: any): string {
    if (err?.status === 0) return 'Network error — check your connection and try again.';
    if (err?.status === 401) return 'Incorrect email or password.';
    return 'Something went wrong. Please try again.';
  }
}
