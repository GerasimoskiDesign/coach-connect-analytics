import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CoachingStyle, Specialty, Surface } from '../../../../core/models/auth.models';

const TRAINING_STYLE_OPTIONS: { value: CoachingStyle; label: string }[] = [
  { value: 'Demanding', label: 'Demanding' },
  { value: 'Balanced',  label: 'Balanced' },
  { value: 'Relaxed',   label: 'Relaxed' },
];

const SPECIALTY_OPTIONS: { value: Specialty; label: string }[] = [
  { value: 'Technique',             label: 'Technique' },
  { value: 'Serve',                 label: 'Serve' },
  { value: 'Forehand',              label: 'Forehand' },
  { value: 'Backhand',              label: 'Backhand' },
  { value: 'Footwork',              label: 'Footwork' },
  { value: 'Fitness',               label: 'Fitness' },
  { value: 'MatchStrategy',         label: 'Match Strategy' },
  { value: 'TournamentPreparation', label: 'Tournament Prep' },
  { value: 'JuniorDevelopment',     label: 'Junior Development' },
  { value: 'BeginnerCoaching',      label: 'Beginner Coaching' },
];

const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'Clay',         label: 'Clay' },
  { value: 'HardCourt',    label: 'Hard Court' },
  { value: 'Grass',        label: 'Grass' },
  { value: 'NoPreference', label: 'No Preference' },
];

@Component({
  selector: 'app-coach-step-3',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <p class="label">Training Style</p>
        <div class="chip-group">
          @for (opt of trainingStyleOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="group().get('trainingStyle')!.value === opt.value"
              (click)="pick('trainingStyle', opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('trainingStyle')!.invalid && group().get('trainingStyle')!.touched) {
          <p class="error">Please select your training style.</p>
        }
      </div>

      <div class="field">
        <p class="label">Specialties <span class="hint">(select all that apply)</span></p>
        <div class="chip-group">
          @for (opt of specialtyOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="isSpecialtySelected(opt.value)"
              (click)="toggleSpecialty(opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('specialties')!.invalid && group().get('specialties')!.touched) {
          <p class="error">Please select at least one specialty.</p>
        }
      </div>

      <div class="field">
        <p class="label">Preferred Surfaces <span class="hint">(select all that apply)</span></p>
        <div class="chip-group">
          @for (opt of surfaceOptions; track opt.value) {
            <button
              type="button"
              class="chip"
              [class.selected]="isSurfaceSelected(opt.value)"
              (click)="toggleSurface(opt.value)"
            >{{ opt.label }}</button>
          }
        </div>
        @if (group().get('preferredSurfaces')!.invalid && group().get('preferredSurfaces')!.touched) {
          <p class="error">Please select at least one surface.</p>
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
export class CoachStep3Component {
  readonly group = input.required<FormGroup>();

  readonly trainingStyleOptions = TRAINING_STYLE_OPTIONS;
  readonly specialtyOptions = SPECIALTY_OPTIONS;
  readonly surfaceOptions = SURFACE_OPTIONS;

  pick(controlName: string, value: string): void {
    const ctrl = this.group().get(controlName)!;
    ctrl.setValue(value);
    ctrl.markAsTouched();
  }

  isSpecialtySelected(value: Specialty): boolean {
    return (this.group().get('specialties')!.value as Specialty[]).includes(value);
  }

  toggleSpecialty(value: Specialty): void {
    const ctrl = this.group().get('specialties')!;
    const current = ctrl.value as Specialty[];
    const idx = current.indexOf(value);
    ctrl.setValue(idx >= 0 ? current.filter(s => s !== value) : [...current, value]);
    ctrl.markAsTouched();
  }

  isSurfaceSelected(value: Surface): boolean {
    return (this.group().get('preferredSurfaces')!.value as Surface[]).includes(value);
  }

  toggleSurface(value: Surface): void {
    const ctrl = this.group().get('preferredSurfaces')!;
    const current = ctrl.value as Surface[];
    if (value === 'NoPreference') {
      ctrl.setValue(['NoPreference']);
    } else {
      const withoutNP = current.filter(s => s !== 'NoPreference');
      const idx = withoutNP.indexOf(value);
      ctrl.setValue(idx >= 0 ? withoutNP.filter(s => s !== value) : [...withoutNP, value]);
    }
    ctrl.markAsTouched();
  }
}
