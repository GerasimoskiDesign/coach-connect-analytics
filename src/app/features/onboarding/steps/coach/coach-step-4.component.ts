import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CoachingApproach } from '../../../../core/models/auth.models';

const APPROACH_OPTIONS: { value: CoachingApproach; label: string }[] = [
  { value: 'BeginnerFriendly',      label: 'Beginner-friendly approach' },
  { value: 'InjuryRehabilitation',  label: 'Injury rehabilitation focus' },
  { value: 'MentalGame',            label: 'Mental game coaching' },
  { value: 'TournamentPreparation', label: 'Tournament preparation' },
  { value: 'RecreationalFocus',     label: 'Recreational players focus' },
  { value: 'FitnessOriented',       label: 'Fitness-oriented sessions' },
  { value: 'ReturnToSport',         label: 'Help returning players' },
  { value: 'ConsistencyBuilding',   label: 'Building consistency' },
  { value: 'AdvancedTechnique',     label: 'Advanced technique work' },
  { value: 'YouthDevelopment',      label: 'Youth development' },
];

@Component({
  selector: 'app-coach-step-4',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Coaching Approaches <span class="hint">(select all that apply)</span></p>
        <div class="chip-group">
          @for (opt of approachOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="isApproachSelected(opt.value)"
              (click)="toggleApproach(opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('coachingApproaches')!.invalid && group().get('coachingApproaches')!.touched) {
          <p class="error">Please select at least one coaching approach.</p>
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
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class CoachStep4Component {
  readonly group = input.required<FormGroup>();

  readonly approachOptions = APPROACH_OPTIONS;

  isApproachSelected(value: CoachingApproach): boolean {
    return (this.group().get('coachingApproaches')!.value as CoachingApproach[]).includes(value);
  }

  toggleApproach(value: CoachingApproach): void {
    const ctrl = this.group().get('coachingApproaches')!;
    const current = ctrl.value as CoachingApproach[];
    const idx = current.indexOf(value);
    ctrl.setValue(idx >= 0 ? current.filter(a => a !== value) : [...current, value]);
    ctrl.markAsTouched();
  }
}
