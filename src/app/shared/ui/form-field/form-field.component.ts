import { Component, Input } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="field">
      <label [for]="inputId" class="label">{{ label }}</label>
      <div class="input-wrap" [class.has-toggle]="type === 'password'">
        <input
          [id]="inputId"
          [type]="effectiveType"
          [formControl]="fc"
          [attr.autocomplete]="autocomplete ?? null"
          class="input"
          [class.is-invalid]="control.invalid && control.touched"
        />
        @if (type === 'password') {
          <button
            type="button"
            class="eye-btn"
            (click)="showPassword = !showPassword"
            [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
          >
            @if (showPassword) {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            }
          </button>
        }
      </div>
      @if (control.touched && externalError) {
        <p class="error">{{ externalError }}</p>
      } @else if (control.invalid && control.touched && firstError) {
        <p class="error">{{ errorMessages[firstError] ?? 'Invalid field.' }}</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-primary);
    }

    .input-wrap {
      position: relative;

      &.has-toggle .input {
        padding-right: var(--space-10);
      }
    }

    .input {
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-base);
      font-family: var(--font-sans);
      background: var(--color-surface);
      color: var(--color-text-primary);
      outline: none;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

      &::placeholder {
        color: var(--color-text-disabled);
      }

      &:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-light);
      }

      &.is-invalid {
        border-color: var(--color-danger);

        &:focus {
          box-shadow: 0 0 0 3px var(--color-danger-light);
        }
      }
    }

    .eye-btn {
      position: absolute;
      right: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: color var(--transition-fast);

      &:hover {
        color: var(--color-text-primary);
      }
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class FormFieldComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) control!: AbstractControl;
  @Input() type: 'text' | 'email' | 'password' | 'tel' = 'text';
  @Input() autocomplete?: string;
  @Input() errorMessages: Partial<Record<string, string>> = {};
  @Input() externalError?: string | null;

  readonly inputId = `field-${crypto.randomUUID().slice(0, 8)}`;
  showPassword = false;

  // Cast to FormControl for [formControl] binding; AbstractControl is used as the
  // @Input type so callers can pass FormControl<T> without generic mismatch errors.
  get fc(): FormControl { return this.control as FormControl; }

  get effectiveType(): string {
    return this.type === 'password' && this.showPassword ? 'text' : this.type;
  }

  get firstError(): string | null {
    const errors = this.control.errors;
    if (!errors) return null;
    return Object.keys(errors)[0] ?? null;
  }
}
