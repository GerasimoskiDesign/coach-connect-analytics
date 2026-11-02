import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TrainingFrequencyPerDay } from '../../../../core/models/auth.models';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

const FREQUENCY_OPTIONS: { value: TrainingFrequencyPerDay; label: string }[] = [
  { value: 'OncePerDay',  label: 'Once a day' },
  { value: 'TwicePerDay', label: 'Twice a day' },
  { value: 'Flexible',    label: 'Flexible' },
];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 60,  label: '1h' },
  { value: 90,  label: '1h 30m' },
  { value: 120, label: '2h' },
  { value: 150, label: '2h 30m' },
  { value: 180, label: '3h' },
  { value: 210, label: '3h 30m' },
  { value: 240, label: '4h' },
];

@Component({
  selector: 'app-player-step-3',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Training Days per Week</p>
        <div class="chip-group">
          @for (day of days; track day) {
            <button
              type="button"
              class="chip chip--square"
              [class.selected]="group().get('trainingDaysPerWeek')!.value === day"
              (click)="pick('trainingDaysPerWeek', day)"
            >{{ day }}</button>
          }
        </div>
        @if (group().get('trainingDaysPerWeek')!.invalid && group().get('trainingDaysPerWeek')!.touched) {
          <p class="error">Please select how many days per week you train.</p>
        }
      </div>

      <div class="field">
        <p class="label">Training Frequency per Day</p>
        <div class="chip-group">
          @for (opt of frequencyOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="group().get('trainingFrequencyPerDay')!.value === opt.value"
              (click)="pick('trainingFrequencyPerDay', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('trainingFrequencyPerDay')!.invalid && group().get('trainingFrequencyPerDay')!.touched) {
          <p class="error">Please select a training frequency.</p>
        }
      </div>

      <div class="field">
        <p class="label">Preferred Session Duration</p>
        <div class="chip-group">
          @for (opt of durationOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="group().get('preferredSessionDurationMinutes')!.value === opt.value"
              (click)="pick('preferredSessionDurationMinutes', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('preferredSessionDurationMinutes')!.invalid && group().get('preferredSessionDurationMinutes')!.touched) {
          <p class="error">Please select a session duration.</p>
        }
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

    .chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
      padding: var(--space-2) var(--space-4);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast),
        color var(--transition-fast);

      &:hover:not(.selected) { border-color: var(--color-accent); }

      &.selected {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: var(--color-text-inverse);
      }

      &.chip--square {
        padding: var(--space-2);
        min-width: 36px;
        border-radius: var(--radius-sm);
        text-align: center;
      }
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class PlayerStep3Component {
  readonly group = input.required<FormGroup>();

  readonly days = DAYS;
  readonly frequencyOptions = FREQUENCY_OPTIONS;
  readonly durationOptions = DURATION_OPTIONS;

  pick(controlName: string, value: number | string): void {
    const ctrl = this.group().get(controlName)!;
    ctrl.setValue(value);
    ctrl.markAsTouched();
  }
}
