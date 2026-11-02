import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PreferredHand, BackhandType } from '../../../../core/models/auth.models';

const HAND_OPTIONS: { value: PreferredHand; label: string }[] = [
  { value: 'Left', label: 'Left-handed' },
  { value: 'Right', label: 'Right-handed' },
];

const BACKHAND_OPTIONS: { value: BackhandType; label: string }[] = [
  { value: 'OneHanded', label: 'One-handed' },
  { value: 'TwoHanded', label: 'Two-handed' },
];

@Component({
  selector: 'app-player-step-2',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Preferred Hand</p>
        <div class="tile-group">
          @for (opt of handOptions; track opt.value) {
            <button
              type="button"
              class="tile"
              [class.selected]="group().get('preferredHand')!.value === opt.value"
              (click)="select('preferredHand', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('preferredHand')!.invalid && group().get('preferredHand')!.touched) {
          <p class="error">Please select your preferred hand.</p>
        }
      </div>

      <div class="field">
        <p class="label">Backhand Type</p>
        <div class="tile-group">
          @for (opt of backhandOptions; track opt.value) {
            <button
              type="button"
              class="tile"
              [class.selected]="group().get('backhandType')!.value === opt.value"
              (click)="select('backhandType', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('backhandType')!.invalid && group().get('backhandType')!.touched) {
          <p class="error">Please select your backhand type.</p>
        }
      </div>

      <div class="field">
        <label class="label" [for]="yearsId">Years Playing Tennis</label>
        <input
          [id]="yearsId"
          type="number"
          class="input"
          [class.is-invalid]="group().get('yearsPlaying')!.invalid && group().get('yearsPlaying')!.touched"
          [value]="group().get('yearsPlaying')!.value ?? ''"
          (input)="setYearsPlaying($event)"
          (blur)="group().get('yearsPlaying')!.markAsTouched()"
          min="0"
          max="80"
          step="1"
          placeholder="e.g. 5"
        />
        @if (group().get('yearsPlaying')!.invalid && group().get('yearsPlaying')!.touched) {
          <p class="error">
            @if (group().get('yearsPlaying')!.errors?.['required']) { Years playing is required. }
            @else if (group().get('yearsPlaying')!.errors?.['min']) { Cannot be negative. }
            @else if (group().get('yearsPlaying')!.errors?.['max']) { Value seems too high (max 80). }
            @else if (group().get('yearsPlaying')!.errors?.['wholeNumber']) { Years playing must be a whole number. }
            @else if (group().get('yearsPlaying')!.errors?.['yearsExceedsAge']) { Cannot exceed your age minus 4. }
          </p>
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

    .tile-group {
      display: flex;
      gap: var(--space-3);
    }

    .tile {
      flex: 1;
      padding: var(--space-4) var(--space-3);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer;
      text-align: center;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast),
        color var(--transition-fast);

      &:hover:not(.selected) { border-color: var(--color-accent); }

      &.selected {
        border-color: var(--color-accent);
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-weight: var(--font-semibold);
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

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class PlayerStep2Component {
  readonly group = input.required<FormGroup>();

  readonly handOptions = HAND_OPTIONS;
  readonly backhandOptions = BACKHAND_OPTIONS;
  readonly yearsId = `yp-${Math.random().toString(36).slice(2, 8)}`;

  select(controlName: string, value: string): void {
    const ctrl = this.group().get(controlName)!;
    ctrl.setValue(value);
    ctrl.markAsTouched();
  }

  setYearsPlaying(event: Event): void {
    const input = event.target as HTMLInputElement;
    const ctrl = this.group().get('yearsPlaying')!;
    ctrl.setValue(input.value === '' ? null : Number(input.value));
    ctrl.markAsTouched();
  }
}
