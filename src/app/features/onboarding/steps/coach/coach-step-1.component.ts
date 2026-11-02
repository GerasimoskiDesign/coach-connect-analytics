import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-coach-step-1',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <label class="label" [for]="rateId">Hourly Rate (EUR)</label>
        <p class="sub">Your rate per coaching hour in Macedonian Denar.</p>
        <input
          [id]="rateId"
          type="number"
          class="input"
          [class.is-invalid]="group().get('hourlyRate')!.invalid && group().get('hourlyRate')!.touched"
          [value]="group().get('hourlyRate')!.value ?? ''"
          (input)="setHourlyRate($event)"
          (blur)="group().get('hourlyRate')!.markAsTouched()"
          min="1"
          max="9999"
          step="1"
          placeholder="e.g. 1500"
        />
        @if (group().get('hourlyRate')!.invalid && group().get('hourlyRate')!.touched) {
          <p class="error">
            @if (group().get('hourlyRate')!.errors?.['required']) { Hourly rate is required. }
            @else if (group().get('hourlyRate')!.errors?.['wholeNumber']) { Hourly rate must be a whole number. }
            @else if (group().get('hourlyRate')!.errors?.['min']) { Rate must be at least 1 EUR. }
            @else if (group().get('hourlyRate')!.errors?.['max']) { Rate cannot exceed 9,999 EUR. }
          </p>
        }
      </div>

      <div class="field">
        <div class="toggle-row">
          <div class="toggle-info">
            <p class="label">Accepting New Players</p>
            <p class="sub">Turn this off if your schedule is currently full.</p>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" formControlName="acceptingNewPlayers" />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .step { display: flex; flex-direction: column; gap: var(--space-6); }

    .field { display: flex; flex-direction: column; gap: var(--space-2); }

    .label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-primary);
      margin: 0;
    }

    .sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0;
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

      &::placeholder { color: var(--color-text-disabled); }

      &:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-light);
      }

      &.is-invalid {
        border-color: var(--color-danger);
        &:focus { box-shadow: 0 0 0 3px var(--color-danger-light); }
      }

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        opacity: 1;
      }
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .toggle-info { display: flex; flex-direction: column; gap: 2px; }

    .toggle-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .toggle-input { display: none; }

    .toggle-track {
      width: 36px;
      height: 20px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative;
      transition: background var(--transition-fast);
      flex-shrink: 0;
      display: block;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: var(--radius-full);
        background: var(--color-surface);
        transition: transform var(--transition-fast);
      }

      .toggle-input:checked ~ & {
        background: var(--color-accent);
        &::after { transform: translateX(16px); }
      }
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class CoachStep1Component {
  readonly group = input.required<FormGroup>();
  readonly rateId = `hr-${Math.random().toString(36).slice(2, 8)}`;

  setHourlyRate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const ctrl = this.group().get('hourlyRate')!;
    ctrl.setValue(input.value === '' ? null : Number(input.value));
    ctrl.markAsTouched();
  }
}
