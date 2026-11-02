import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthLayoutComponent } from '../../../shared/ui/auth-layout/auth-layout.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, FormFieldComponent, ButtonComponent],
  template: `
    <app-auth-layout title="Reset your password">
      @if (!submitted) {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="fields">
            <app-form-field
              label="Email"
              type="email"
              [control]="email"
              autocomplete="email"
              [errorMessages]="{ required: 'Email is required.', email: 'Enter a valid email address.' }"
            />
          </div>
          @if (serverError) {
            <p class="server-error">{{ serverError }}</p>
          }
          <app-button
            label="Send reset link"
            type="submit"
            [loading]="loading"
            loadingLabel="Sending…"
          />
        </form>
        <p class="footer-link"><a routerLink="/login">Back to sign in</a></p>
      } @else {
        <p class="success-message">
          Check your inbox — if an account exists for <strong>{{ submittedEmail }}</strong>,
          we've sent a password reset link. It expires in 1 hour.
        </p>
        <p class="footer-link"><a routerLink="/login">Back to sign in</a></p>
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

    .server-error {
      font-size: var(--text-sm);
      color: var(--color-danger);
    }

    .success-message {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
      line-height: 1.6;

      strong {
        color: var(--color-ink);
        font-weight: var(--font-medium);
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
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  submitted = false;
  submittedEmail = '';
  serverError: string | null = null;

  get email() { return this.form.controls.email; }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.serverError = null;
    const emailValue = this.form.getRawValue().email;

    this.authService.forgotPassword(emailValue).subscribe({
      next: () => {
        this.loading = false;
        this.submittedEmail = emailValue;
        this.submitted = true;
      },
      error: () => {
        this.loading = false;
        this.serverError = 'Something went wrong. Please try again.';
      },
    });
  }
}
