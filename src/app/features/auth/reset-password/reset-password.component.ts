import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthLayoutComponent } from '../../../shared/ui/auth-layout/auth-layout.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { passwordStrengthValidator, passwordMatchValidator } from '../../../shared/validators/password.validators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, FormFieldComponent, ButtonComponent],
  template: `
    <app-auth-layout title="Choose a new password">
      @if (status === 'form') {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="fields">
            <app-form-field
              label="New password"
              type="password"
              [control]="password"
              autocomplete="new-password"
              [externalError]="samePasswordError"
              [errorMessages]="{
                required: 'Password is required.',
                minlength: 'At least 8 characters.',
                noLetter: 'Must contain a letter.',
                noDigit: 'Must contain a digit.'
              }"
            />
            <app-form-field
              label="Confirm new password"
              type="password"
              [control]="confirmPassword"
              autocomplete="new-password"
              [externalError]="passwordMismatchError"
              [errorMessages]="{ required: 'Please confirm your password.' }"
            />
          </div>
          <app-button
            label="Update password"
            type="submit"
            [loading]="loading"
            loadingLabel="Updating…"
          />
        </form>
        <p class="footer-link"><a routerLink="/login">Back to sign in</a></p>
      }
      @if (status === 'invalid') {
        <p class="message error">This password reset link is invalid or has expired.</p>
        <a routerLink="/forgot-password" class="back-link">Request a new link</a>
      }
    </app-auth-layout>
  `,
  styles: [`
    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

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

    .footer-link {
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);

      a {
        color: var(--color-accent);
        text-decoration: none;
        font-weight: var(--font-medium);

        &:hover {
          text-decoration: underline;
        }
      }
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

  loading = false;
  status: 'form' | 'invalid' = 'form';
  samePasswordError: string | null = null;
  private token = '';

  get password() { return this.form.controls.password; }
  get confirmPassword() { return this.form.controls.confirmPassword; }

  get passwordMismatchError(): string | null {
    return this.form.hasError('passwordMismatch') && this.confirmPassword.touched
      ? 'Passwords do not match.'
      : null;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] ?? '';
    if (!this.token) this.status = 'invalid';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.samePasswordError = null;

    this.authService.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.router.navigate(['/login'], { state: { passwordReset: true } }),
      error: (err) => {
        this.loading = false;
        const isSamePassword =
          err.status === 409 &&
          (err.error?.detail as string)?.toLowerCase().includes('same password');

        if (isSamePassword) {
          this.samePasswordError = 'New password must be different from your current password.';
        } else {
          this.status = 'invalid';
        }
      },
    });
  }
}
