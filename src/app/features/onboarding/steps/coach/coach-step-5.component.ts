import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AgeGroup, SkillLevelGroup } from '../../../../core/models/auth.models';

const SKILL_LEVEL_GROUP_OPTIONS: { value: SkillLevelGroup; label: string; sub: string }[] = [
  { value: 'Group1To3',  label: 'Beginner',     sub: 'Levels 1–3' },
  { value: 'Group4To6',  label: 'Intermediate', sub: 'Levels 4–6' },
  { value: 'Group7To8',  label: 'Advanced',     sub: 'Levels 7–8' },
  { value: 'Group9To10', label: 'Elite',        sub: 'Levels 9–10' },
];

const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string; sub: string }[] = [
  { value: 'Children6To12',  label: 'Children', sub: 'Ages 6–12' },
  { value: 'Juniors13To18',  label: 'Juniors',  sub: 'Ages 13–18' },
  { value: 'Adults18Plus',   label: 'Adults',   sub: '18 & above' },
  { value: 'Seniors35Plus',  label: 'Seniors',  sub: '35 & above' },
];

@Component({
  selector: 'app-coach-step-5',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Skill Level Groups <span class="hint">(select all that apply)</span></p>
        <div class="card-group">
          @for (opt of skillLevelGroupOptions; track opt.value) {
            <button
              type="button"
              class="card"
              [class.selected]="isSelected('skillLevelGroups', opt.value)"
              (click)="toggle('skillLevelGroups', opt.value)"
            >
              <span class="card-label">{{ opt.label }}</span>
              <span class="card-sub">{{ opt.sub }}</span>
            </button>
          }
        </div>
        @if (group().get('skillLevelGroups')!.invalid && group().get('skillLevelGroups')!.touched) {
          <p class="error">Please select at least one skill level group.</p>
        }
      </div>

      <div class="field">
        <p class="label">Age Groups <span class="hint">(select all that apply)</span></p>
        <div class="card-group">
          @for (opt of ageGroupOptions; track opt.value) {
            <button
              type="button"
              class="card"
              [class.selected]="isSelected('ageGroups', opt.value)"
              (click)="toggle('ageGroups', opt.value)"
            >
              <span class="card-label">{{ opt.label }}</span>
              <span class="card-sub">{{ opt.sub }}</span>
            </button>
          }
        </div>
        @if (group().get('ageGroups')!.invalid && group().get('ageGroups')!.touched) {
          <p class="error">Please select at least one age group.</p>
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

    .hint {
      font-weight: normal;
      color: var(--color-text-muted);
    }

    .card-group {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
    }

    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-2);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast);

      &:hover:not(.selected) { border-color: var(--color-accent); }

      &.selected {
        border-color: var(--color-accent);
        background: var(--color-accent-light);
      }
    }

    .card-label {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);

      .selected & { color: var(--color-accent); }
    }

    .card-sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class CoachStep5Component {
  readonly group = input.required<FormGroup>();

  readonly skillLevelGroupOptions = SKILL_LEVEL_GROUP_OPTIONS;
  readonly ageGroupOptions = AGE_GROUP_OPTIONS;

  isSelected(controlName: string, value: string): boolean {
    return (this.group().get(controlName)!.value as string[]).includes(value);
  }

  toggle(controlName: string, value: string): void {
    const ctrl = this.group().get(controlName)!;
    const current = ctrl.value as string[];
    const idx = current.indexOf(value);
    ctrl.setValue(idx >= 0 ? current.filter(v => v !== value) : [...current, value]);
    ctrl.markAsTouched();
  }
}
