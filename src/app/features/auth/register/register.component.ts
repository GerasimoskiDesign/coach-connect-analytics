import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthLayoutComponent } from '../../../shared/ui/auth-layout/auth-layout.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { passwordStrengthValidator, passwordMatchValidator } from '../../../shared/validators/password.validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, FormFieldComponent, ButtonComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
    confirmPassword: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required]],
    city: ['', [Validators.required]],
    role: [('Player' as 'Player' | 'Coach'), [Validators.required]],
  }, { validators: passwordMatchValidator });

  loading = false;
  serverError: string | null = null;

  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }
  get confirmPassword() { return this.form.controls.confirmPassword; }
  get firstName() { return this.form.controls.firstName; }
  get lastName() { return this.form.controls.lastName; }
  get phoneNumber() { return this.form.controls.phoneNumber; }
  get city() { return this.form.controls.city; }
  get role() { return this.form.controls.role; }

  get passwordMismatchError(): string | null {
    return this.form.hasError('passwordMismatch') && this.confirmPassword.touched
      ? 'Passwords do not match.'
      : null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.serverError = null;
    const v = this.form.getRawValue();
    this.authService.register({
      email: v.email,
      password: v.password,
      firstName: v.firstName,
      lastName: v.lastName,
      phoneNumber: v.phoneNumber,
      city: v.city,
      role: v.role as 'Player' | 'Coach',
      playerProfile: null,
      coachProfile: null,
    }).subscribe({
      next: (user) => {
        this.analytics.signUp(user, 'email');
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
    if (err?.status === 409) return 'An account with this email already exists.';
    return 'Something went wrong. Please try again.';
  }
}
