import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from './profile.service';
import { CoachProfileDto } from '../../core/models/discovery.models';
import { AgeGroup, CoachingApproach, CoachingStyle, SkillLevelGroup, Specialty, Surface, UserDto } from '../../core/models/auth.models';
import { atLeastOneValidator, wholeNumberValidator } from '../../shared/validators/onboarding.validators';

const TRAINING_STYLE_OPTIONS: { value: CoachingStyle; label: string }[] = [
  { value: 'Demanding', label: 'Demanding' },
  { value: 'Balanced',  label: 'Balanced'  },
  { value: 'Relaxed',   label: 'Relaxed'   },
];
const SPECIALTY_OPTIONS: { value: Specialty; label: string }[] = [
  { value: 'Technique',             label: 'Technique'          },
  { value: 'Serve',                 label: 'Serve'              },
  { value: 'Forehand',              label: 'Forehand'           },
  { value: 'Backhand',              label: 'Backhand'           },
  { value: 'Footwork',              label: 'Footwork'           },
  { value: 'Fitness',               label: 'Fitness'            },
  { value: 'MatchStrategy',         label: 'Match Strategy'     },
  { value: 'TournamentPreparation', label: 'Tournament Prep'    },
  { value: 'JuniorDevelopment',     label: 'Junior Development' },
  { value: 'BeginnerCoaching',      label: 'Beginner Coaching'  },
];
const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'Clay',         label: 'Clay'          },
  { value: 'HardCourt',    label: 'Hard Court'    },
  { value: 'Grass',        label: 'Grass'         },
  { value: 'NoPreference', label: 'No Preference' },
];
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
const SKILL_GROUP_OPTIONS: { value: SkillLevelGroup; label: string; sub: string }[] = [
  { value: 'Group1To3',  label: 'Beginner',     sub: 'Levels 1–3'  },
  { value: 'Group4To6',  label: 'Intermediate', sub: 'Levels 4–6'  },
  { value: 'Group7To8',  label: 'Advanced',     sub: 'Levels 7–8'  },
  { value: 'Group9To10', label: 'Elite',        sub: 'Levels 9–10' },
];
const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string; sub: string }[] = [
  { value: 'Children6To12',  label: 'Children', sub: 'Ages 6–12'   },
  { value: 'Juniors13To18',  label: 'Juniors',  sub: 'Ages 13–18'  },
  { value: 'Adults18Plus',   label: 'Adults',   sub: '18 & above'  },
  { value: 'Seniors35Plus',  label: 'Seniors',  sub: '35 & above'  },
];

@Component({
  selector: 'app-coach-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="edit-header">
      <p class="edit-title">Edit profile</p>
      <button type="button" class="cancel-link" (click)="cancelled.emit()">← Cancel</button>
    </div>

    @if (submitError()) {
      <p class="submit-error">{{ submitError() }}</p>
    }

    <div class="sections" [formGroup]="form">

      <!-- ── Pricing & Availability ── -->
      <div class="section-card">
        <p class="section-label">Pricing &amp; Availability</p>

        <div class="field">
          <label class="field-label" [for]="rateId">Hourly Rate (MKD)</label>
          <p class="field-sub">Your rate per coaching hour in Macedonian Denar.</p>
          <input [id]="rateId" type="number" class="input"
                 [class.is-invalid]="touched('hourlyRate') && invalid('hourlyRate')"
                 [value]="form.get('hourlyRate')!.value ?? ''"
                 (input)="setNumber('hourlyRate', $event)"
                 (blur)="form.get('hourlyRate')!.markAsTouched()"
                 min="1" max="9999" step="1" placeholder="e.g. 1500" />
          @if (touched('hourlyRate') && invalid('hourlyRate')) {
            <p class="field-error">
              @if (errors('hourlyRate')?.['required'])         { Hourly rate is required. }
              @else if (errors('hourlyRate')?.['min'])         { Must be at least 1 MKD. }
              @else if (errors('hourlyRate')?.['max'])         { Cannot exceed 9,999 MKD. }
              @else if (errors('hourlyRate')?.['wholeNumber']) { Must be a whole number. }
            </p>
          }
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <p class="field-label">Accepting New Players</p>
            <p class="field-sub">Turn off if your schedule is currently full.</p>
          </div>
          <label class="toggle-wrap">
            <input type="checkbox" class="toggle-input" formControlName="acceptingNewPlayers" />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <!-- ── Coaching Background ── -->
      <div class="section-card">
        <p class="section-label">Coaching Background</p>

        <div class="field">
          <label class="field-label" [for]="yearsId">Years Coaching</label>
          <input [id]="yearsId" type="number" class="input"
                 [class.is-invalid]="touched('yearsCoaching') && invalid('yearsCoaching')"
                 [value]="form.get('yearsCoaching')!.value ?? ''"
                 (input)="setNumber('yearsCoaching', $event)"
                 (blur)="form.get('yearsCoaching')!.markAsTouched()"
                 min="0" max="80" step="1" placeholder="e.g. 8" />
          @if (touched('yearsCoaching') && invalid('yearsCoaching')) {
            <p class="field-error">
              @if (errors('yearsCoaching')?.['required'])         { Years coaching is required. }
              @else if (errors('yearsCoaching')?.['min'])         { Cannot be negative. }
              @else if (errors('yearsCoaching')?.['max'])         { Value too high (max 80). }
              @else if (errors('yearsCoaching')?.['wholeNumber']) { Must be a whole number. }
            </p>
          }
        </div>

        <div class="field">
          <label class="field-label" [for]="diplomasId">Diplomas &amp; Certifications</label>
          <textarea [id]="diplomasId" class="textarea"
                    [class.is-invalid]="touched('diplomas') && invalid('diplomas')"
                    formControlName="diplomas" rows="3"
                    placeholder="e.g. ITF Level 1 Coaching Certificate, Tennis Europe Certified Coach"></textarea>
          @if (touched('diplomas') && invalid('diplomas')) {
            <p class="field-error">
              @if (errors('diplomas')?.['required'])      { Please enter your diplomas or certifications. }
              @else if (errors('diplomas')?.['minlength']) { At least 5 characters required. }
            </p>
          }
        </div>

        <div class="field">
          <label class="field-label" [for]="historyId">Coaching History</label>
          <textarea [id]="historyId" class="textarea"
                    [class.is-invalid]="touched('coachingHistory') && invalid('coachingHistory')"
                    formControlName="coachingHistory" rows="5"
                    placeholder="e.g. Started coaching at Club Vardar in 2015…"></textarea>
          <div class="field-footer">
            @if (touched('coachingHistory') && invalid('coachingHistory')) {
              <p class="field-error">
                @if (errors('coachingHistory')?.['required'])      { Please describe your coaching history. }
                @else if (errors('coachingHistory')?.['minlength']) { Minimum 30 characters required. }
                @else if (errors('coachingHistory')?.['maxlength']) { Cannot exceed 2,000 characters. }
              </p>
            } @else { <span></span> }
            <span class="char-count">{{ form.get('coachingHistory')!.value.length }} / 2000</span>
          </div>
        </div>
      </div>

      <!-- ── Your Style ── -->
      <div class="section-card">
        <p class="section-label">Your Style</p>

        <div class="field">
          <p class="field-label">Training Style</p>
          <div class="tile-group">
            @for (opt of trainingStyleOptions; track opt.value) {
              <button type="button" class="tile"
                      [class.selected]="form.get('trainingStyle')!.value === opt.value"
                      (click)="pickOne('trainingStyle', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('trainingStyle') && invalid('trainingStyle')) {
            <p class="field-error">Please select your training style.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Specialties <span class="field-hint">(select all that apply)</span></p>
          <div class="chip-group">
            @for (opt of specialtyOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="isIn('specialties', opt.value)"
                      (click)="toggleMulti('specialties', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('specialties') && invalid('specialties')) {
            <p class="field-error">Please select at least one specialty.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Preferred Surfaces <span class="field-hint">(select all that apply)</span></p>
          <div class="chip-group">
            @for (opt of surfaceOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="isIn('preferredSurfaces', opt.value)"
                      (click)="toggleSurface(opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('preferredSurfaces') && invalid('preferredSurfaces')) {
            <p class="field-error">Please select at least one surface.</p>
          }
        </div>
      </div>

      <!-- ── Your Approach ── -->
      <div class="section-card">
        <p class="section-label">Your Approach</p>

        <div class="field">
          <p class="field-label">Coaching Approaches <span class="field-hint">(select all that apply)</span></p>
          <div class="chip-group">
            @for (opt of approachOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="isIn('coachingApproaches', opt.value)"
                      (click)="toggleMulti('coachingApproaches', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('coachingApproaches') && invalid('coachingApproaches')) {
            <p class="field-error">Please select at least one coaching approach.</p>
          }
        </div>
      </div>

      <!-- ── Player Fit ── -->
      <div class="section-card">
        <p class="section-label">Player Fit</p>

        <div class="field">
          <p class="field-label">Skill Level Groups <span class="field-hint">(select all that apply)</span></p>
          <div class="card-group">
            @for (opt of skillGroupOptions; track opt.value) {
              <button type="button" class="fit-card"
                      [class.selected]="isIn('skillLevelGroups', opt.value)"
                      (click)="toggleMulti('skillLevelGroups', opt.value)">
                <span class="fit-label">{{ opt.label }}</span>
                <span class="fit-sub">{{ opt.sub }}</span>
              </button>
            }
          </div>
          @if (touched('skillLevelGroups') && invalid('skillLevelGroups')) {
            <p class="field-error">Please select at least one skill level group.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Age Groups <span class="field-hint">(select all that apply)</span></p>
          <div class="card-group">
            @for (opt of ageGroupOptions; track opt.value) {
              <button type="button" class="fit-card"
                      [class.selected]="isIn('ageGroups', opt.value)"
                      (click)="toggleMulti('ageGroups', opt.value)">
                <span class="fit-label">{{ opt.label }}</span>
                <span class="fit-sub">{{ opt.sub }}</span>
              </button>
            }
          </div>
          @if (touched('ageGroups') && invalid('ageGroups')) {
            <p class="field-error">Please select at least one age group.</p>
          }
        </div>
      </div>

      <!-- ── About You ── -->
      <div class="section-card">
        <p class="section-label">About You</p>
        <div class="field">
          <label class="field-label" [for]="bioId">Bio <span class="field-hint">(optional, max 500 chars)</span></label>
          <textarea [id]="bioId" class="textarea"
                    [class.is-invalid]="touched('bio') && invalid('bio')"
                    formControlName="bio" rows="4"
                    placeholder="Tell players about your coaching philosophy…"></textarea>
          @if (touched('bio') && invalid('bio')) {
            <p class="field-error">Bio cannot exceed 500 characters.</p>
          }
          <p class="char-count">{{ form.get('bio')!.value.length }} / 500</p>
        </div>
      </div>

    </div><!-- /sections -->

    <div class="form-footer">
      <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Cancel</button>
      <button type="button" class="btn btn-primary"
              [disabled]="submitting()" (click)="submit()">
        {{ submitting() ? 'Saving…' : 'Save changes' }}
      </button>
    </div>
  `,
  styles: [`
    .edit-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0 20px;
    }
    .edit-title {
      font-size: var(--text-xl); font-weight: var(--font-semibold);
      letter-spacing: -0.02em; color: var(--color-ink);
    }
    .cancel-link {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      cursor: pointer; background: none; border: none;
      font-family: var(--font-sans); transition: color var(--transition-fast);
      &:hover { color: var(--color-ink); }
    }
    .submit-error { font-size: var(--text-sm); color: var(--color-danger); margin-bottom: 16px; }

    .sections { display: flex; flex-direction: column; gap: 16px; }
    .section-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 24px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .section-label {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.08em; text-transform: uppercase;
      font-weight: var(--font-medium); margin: 0 0 2px;
    }

    .field { display: flex; flex-direction: column; gap: 8px; }
    .field-label { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text-primary); margin: 0; }
    .field-sub   { font-size: var(--text-xs); color: var(--color-text-secondary); margin: 0; }
    .field-hint  { font-size: var(--text-xs); color: var(--color-text-secondary); font-weight: var(--font-normal); }
    .field-error { font-size: var(--text-xs); color: var(--color-danger); }
    .field-footer { display: flex; justify-content: space-between; align-items: center; }
    .char-count  { font-size: var(--text-xs); color: var(--color-text-secondary); text-align: right; }

    .input, .textarea {
      width: 100%;
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-base); font-family: var(--font-sans);
      background: var(--color-surface); color: var(--color-text-primary);
      outline: none;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      &::placeholder { color: var(--color-text-disabled); }
      &:focus { border-color: var(--color-gold); box-shadow: 0 0 0 3px var(--color-gold-soft); }
      &.is-invalid { border-color: var(--color-danger); &:focus { box-shadow: 0 0 0 3px var(--color-danger-light); } }
    }
    .textarea { resize: vertical; min-height: 80px; line-height: 1.5; }

    .toggle-row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 16px;
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .toggle-info { display: flex; flex-direction: column; gap: 2px; }
    .toggle-wrap { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
    .toggle-input { display: none; }
    .toggle-track {
      width: 36px; height: 20px; border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative; display: block;
      transition: background var(--transition-fast);
      &::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 16px; height: 16px; border-radius: var(--radius-full);
        background: var(--color-surface); transition: transform var(--transition-fast);
      }
    }
    .toggle-input:checked ~ .toggle-track {
      background: var(--color-gold);
      &::after { transform: translateX(16px); }
    }

    .tile-group { display: flex; gap: 12px; }
    .tile {
      flex: 1; padding: 14px 12px;
      border: 2px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); color: var(--color-text-primary);
      font-size: var(--text-sm); font-weight: var(--font-medium); font-family: var(--font-sans);
      cursor: pointer; text-align: center;
      transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
      &:hover:not(.selected) { border-color: var(--color-gold); }
      &.selected { border-color: var(--color-gold); background: var(--color-gold-soft); color: var(--color-gold); font-weight: var(--font-semibold); }
    }

    .chip-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      padding: 8px 16px;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-full);
      background: var(--color-surface); color: var(--color-text-primary);
      font-size: var(--text-sm); font-weight: var(--font-medium); font-family: var(--font-sans);
      cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
      &:hover:not(.selected) { border-color: var(--color-gold); }
      &.selected { border-color: var(--color-gold); background: var(--color-gold); color: var(--color-text-inverse); }
    }

    .card-group { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .fit-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 12px 8px;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast);
      &:hover:not(.selected) { border-color: var(--color-gold); }
      &.selected { border-color: var(--color-gold); background: var(--color-gold-soft); }
    }
    .fit-label { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text-primary); .selected & { color: var(--color-gold); } }
    .fit-sub   { font-size: var(--text-xs); color: var(--color-text-secondary); }

    .form-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 24px 0 0; }
    .btn {
      height: 40px; padding: 0 18px; border-radius: 10px;
      font-size: 13.5px; font-weight: var(--font-medium);
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; font-family: var(--font-sans);
      transition: background var(--transition-fast), box-shadow var(--transition-fast);
    }
    .btn-primary {
      background: var(--color-ink); color: var(--color-text-inverse); border: none;
      &:hover:not(:disabled) { background: var(--color-ink); box-shadow: 0 4px 14px rgba(17,17,17,0.18); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .btn-secondary {
      background: var(--color-surface); border: 1px solid var(--color-line); color: var(--color-ink);
      &:hover { background: rgba(17,17,17,0.025); }
    }
  `],
})
export class CoachEditFormComponent implements OnInit {
  @Input({ required: true }) initialData!: CoachProfileDto;
  @Output() saved     = new EventEmitter<UserDto>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb             = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  readonly submitting  = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly trainingStyleOptions = TRAINING_STYLE_OPTIONS;
  readonly specialtyOptions     = SPECIALTY_OPTIONS;
  readonly surfaceOptions       = SURFACE_OPTIONS;
  readonly approachOptions      = APPROACH_OPTIONS;
  readonly skillGroupOptions    = SKILL_GROUP_OPTIONS;
  readonly ageGroupOptions      = AGE_GROUP_OPTIONS;

  readonly rateId     = `hr-${Math.random().toString(36).slice(2, 8)}`;
  readonly yearsId    = `yc-${Math.random().toString(36).slice(2, 8)}`;
  readonly diplomasId = `dip-${Math.random().toString(36).slice(2, 8)}`;
  readonly historyId  = `ch-${Math.random().toString(36).slice(2, 8)}`;
  readonly bioId      = `bio-${Math.random().toString(36).slice(2, 8)}`;

  form!: ReturnType<typeof this.buildForm>;

  ngOnInit(): void {
    this.form = this.buildForm();
    this.form.patchValue({
      hourlyRate:          this.initialData.hourlyRate,
      acceptingNewPlayers: this.initialData.acceptingNewPlayers,
      yearsCoaching:       this.initialData.yearsCoaching,
      diplomas:            this.initialData.diplomas,
      coachingHistory:     this.initialData.coachingHistory,
      trainingStyle:       this.initialData.trainingStyle,
      specialties:         this.initialData.specialties,
      preferredSurfaces:   this.initialData.preferredSurfaces,
      coachingApproaches:  this.initialData.coachingApproaches,
      skillLevelGroups:    this.initialData.skillLevelGroups,
      ageGroups:           this.initialData.ageGroups,
      bio:                 this.initialData.bio ?? '',
    });
  }

  touched(name: string): boolean { return !!this.form.get(name)?.touched; }
  invalid(name: string): boolean { return !!this.form.get(name)?.invalid; }
  errors(name: string): Record<string, unknown> | null { return this.form.get(name)?.errors ?? null; }

  pickOne(name: string, value: string): void {
    const ctrl = this.form.get(name)!;
    ctrl.setValue(value);
    ctrl.markAsTouched();
  }

  setNumber(name: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const ctrl  = this.form.get(name)!;
    ctrl.setValue(input.value === '' ? null : Number(input.value));
    ctrl.markAsTouched();
  }

  isIn(name: string, value: string): boolean {
    return (this.form.get(name)!.value as string[]).includes(value);
  }

  toggleMulti(name: string, value: string): void {
    const ctrl    = this.form.get(name)!;
    const current = ctrl.value as string[];
    ctrl.setValue(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
    ctrl.markAsTouched();
  }

  toggleSurface(value: Surface): void {
    const ctrl    = this.form.get('preferredSurfaces')!;
    const current = ctrl.value as Surface[];
    if (value === 'NoPreference') {
      ctrl.setValue(['NoPreference']);
    } else {
      const withoutNP = current.filter(s => s !== 'NoPreference');
      ctrl.setValue(withoutNP.includes(value) ? withoutNP.filter(s => s !== value) : [...withoutNP, value]);
    }
    ctrl.markAsTouched();
  }

  submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const v = this.form.getRawValue();
    this.profileService.saveCoachProfile({
      hourlyRate:          v.hourlyRate!,
      acceptingNewPlayers: v.acceptingNewPlayers,
      yearsCoaching:       v.yearsCoaching!,
      diplomas:            v.diplomas,
      coachingHistory:     v.coachingHistory,
      trainingStyle:       v.trainingStyle! as CoachingStyle,
      specialties:         v.specialties,
      preferredSurfaces:   v.preferredSurfaces,
      coachingApproaches:  v.coachingApproaches,
      skillLevelGroups:    v.skillLevelGroups,
      ageGroups:           v.ageGroups,
      bio:                 v.bio || undefined,
    }).subscribe({
      next:  (updated) => { this.submitting.set(false); this.saved.emit(updated); },
      error: ()        => { this.submitting.set(false); this.submitError.set('Something went wrong. Please try again.'); },
    });
  }

  private buildForm() {
    return this.fb.group({
      hourlyRate:          new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(9999), wholeNumberValidator]),
      acceptingNewPlayers: new FormControl<boolean>(true, { nonNullable: true }),
      yearsCoaching:       new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(80), wholeNumberValidator]),
      diplomas:            new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
      coachingHistory:     new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(30), Validators.maxLength(2000)] }),
      trainingStyle:       new FormControl<string | null>(null, Validators.required),
      specialties:         new FormControl<Specialty[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      preferredSurfaces:   new FormControl<Surface[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      coachingApproaches:  new FormControl<CoachingApproach[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      skillLevelGroups:    new FormControl<SkillLevelGroup[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      ageGroups:           new FormControl<AgeGroup[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      bio:                 new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });
  }
}
