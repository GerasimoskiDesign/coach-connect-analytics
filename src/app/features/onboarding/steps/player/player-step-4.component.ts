import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MainGoal, Surface, CoachingStyle } from '../../../../core/models/auth.models';

const GOAL_OPTIONS: { value: MainGoal; label: string }[] = [
  { value: 'ImproveTechnique',      label: 'Improve Technique' },
  { value: 'ImproveFitness',        label: 'Improve Fitness' },
  { value: 'PrepareForTournaments', label: 'Prepare for Tournaments' },
  { value: 'FindHittingPartners',   label: 'Find Hitting Partners' },
  { value: 'ReturnToTennis',        label: 'Return to Tennis' },
  { value: 'TrainRecreationally',   label: 'Train Recreationally' },
  { value: 'BecomeProfessional',    label: 'Become Professional' },
  { value: 'ImproveServe',          label: 'Improve Serve' },
  { value: 'ImproveFootwork',       label: 'Improve Footwork' },
  { value: 'ImproveConsistency',    label: 'Improve Consistency' },
  { value: 'ImproveMatchPlay',      label: 'Improve Match Play' },
  { value: 'ReduceInjuryRisk',      label: 'Reduce Injury Risk' },
  { value: 'PlayCompetitivelyAgain',label: 'Play Competitively Again' },
  { value: 'LearnTennis',           label: 'Learn Tennis' },
  { value: 'ImproveMentalGame',     label: 'Improve Mental Game' },
  { value: 'FindSocialPlaying',     label: 'Find Social Playing' },
];

const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'Clay',         label: 'Clay' },
  { value: 'HardCourt',    label: 'Hard Court' },
  { value: 'Grass',        label: 'Grass' },
  { value: 'NoPreference', label: 'No Preference' },
];

const COACHING_STYLE_OPTIONS: { value: CoachingStyle; label: string }[] = [
  { value: 'Demanding', label: 'Demanding' },
  { value: 'Balanced',  label: 'Balanced' },
  { value: 'Relaxed',   label: 'Relaxed' },
];

@Component({
  selector: 'app-player-step-4',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Main Goals <span class="hint">(select all that apply)</span></p>
        <div class="chip-group">
          @for (opt of goalOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="isGoalSelected(opt.value)"
              (click)="toggleGoal(opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('mainGoals')!.invalid && group().get('mainGoals')!.touched) {
          <p class="error">
            @if (group().get('mainGoals')!.errors?.['goalsEmpty']) { Select at least one goal. }
            @else if (group().get('mainGoals')!.errors?.['goalsTooMany']) { Maximum 16 goals allowed. }
          </p>
        }
      </div>

      <div class="field">
        <p class="label">Preferred Surface</p>
        <div class="chip-group">
          @for (opt of surfaceOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="group().get('preferredSurface')!.value === opt.value"
              (click)="pick('preferredSurface', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('preferredSurface')!.invalid && group().get('preferredSurface')!.touched) {
          <p class="error">Please select a preferred surface.</p>
        }
      </div>

      <div class="field">
        <p class="label">Preferred Coaching Style</p>
        <div class="chip-group">
          @for (opt of coachingStyleOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="group().get('preferredCoachingStyle')!.value === opt.value"
              (click)="pick('preferredCoachingStyle', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('preferredCoachingStyle')!.invalid && group().get('preferredCoachingStyle')!.touched) {
          <p class="error">Please select a coaching style.</p>
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
export class PlayerStep4Component {
  readonly group = input.required<FormGroup>();

  readonly goalOptions = GOAL_OPTIONS;
  readonly surfaceOptions = SURFACE_OPTIONS;
  readonly coachingStyleOptions = COACHING_STYLE_OPTIONS;

  isGoalSelected(goal: MainGoal): boolean {
    return (this.group().get('mainGoals')!.value as MainGoal[]).includes(goal);
  }

  toggleGoal(goal: MainGoal): void {
    const ctrl = this.group().get('mainGoals')!;
    const current = ctrl.value as MainGoal[];
    const idx = current.indexOf(goal);
    ctrl.setValue(idx >= 0 ? current.filter(g => g !== goal) : [...current, goal]);
    ctrl.markAsTouched();
  }

  pick(controlName: string, value: string): void {
    const ctrl = this.group().get(controlName)!;
    ctrl.setValue(value);
    ctrl.markAsTouched();
  }
}
