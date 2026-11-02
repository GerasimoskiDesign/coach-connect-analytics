import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SkillLevelSelectorComponent } from '../../../../shared/ui/skill-level-selector/skill-level-selector.component';

@Component({
  selector: 'app-player-step-1',
  standalone: true,
  imports: [ReactiveFormsModule, SkillLevelSelectorComponent],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <label class="label" [for]="dobId">Date of Birth</label>
        <input
          [id]="dobId"
          type="date"
          class="input"
          [class.is-invalid]="group().get('dateOfBirth')!.invalid && group().get('dateOfBirth')!.touched"
          formControlName="dateOfBirth"
          [max]="maxDate"
          [min]="minDate"
        />
        @if (group().get('dateOfBirth')!.invalid && group().get('dateOfBirth')!.touched) {
          <p class="error">
            @if (group().get('dateOfBirth')!.errors?.['required']) { Date of birth is required. }
            @else if (group().get('dateOfBirth')!.errors?.['ageTooYoung']) { You must be at least 5 years old. }
            @else if (group().get('dateOfBirth')!.errors?.['ageTooOld']) { Age cannot exceed 100 years. }
          </p>
        }
      </div>

      <div class="field">
        <label class="label">Skill Level</label>
        <app-skill-level-selector formControlName="skillLevel" />
        @if (group().get('skillLevel')!.invalid && group().get('skillLevel')!.touched) {
          <p class="error">Please select a skill level.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .step { display: flex; flex-direction: column; gap: var(--space-6); }

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

      &:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-light);
      }

      &.is-invalid {
        border-color: var(--color-danger);
        &:focus { box-shadow: 0 0 0 3px var(--color-danger-light); }
      }
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class PlayerStep1Component {
  readonly group = input.required<FormGroup>();

  readonly dobId = `dob-${Math.random().toString(36).slice(2, 8)}`;

  readonly maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().split('T')[0];
  })();

  readonly minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    return d.toISOString().split('T')[0];
  })();
}
