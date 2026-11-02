import { Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from './profile.service';
import { PlayerProfileDto } from '../../core/models/discovery.models';
import {
  BackhandType, CoachingStyle, MainGoal,
  PreferredHand, Surface, TrainingFrequencyPerDay, UserDto,
} from '../../core/models/auth.models';
import { SkillLevelSelectorComponent } from '../../shared/ui/skill-level-selector/skill-level-selector.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import {
  dateOfBirthAgeValidator, mainGoalsValidator, notFuzzyNoneValidator,
  sessionDurationValidator, wholeNumberValidator, yearsPlayingValidator,
} from '../../shared/validators/onboarding.validators';

const HAND_OPTIONS:     { value: PreferredHand;           label: string }[] = [{ value: 'Left', label: 'Left-handed' }, { value: 'Right', label: 'Right-handed' }];
const BACKHAND_OPTIONS: { value: BackhandType;            label: string }[] = [{ value: 'OneHanded', label: 'One-handed' }, { value: 'TwoHanded', label: 'Two-handed' }];
const FREQUENCY_OPTIONS:{ value: TrainingFrequencyPerDay; label: string }[] = [{ value: 'OncePerDay', label: 'Once a day' }, { value: 'TwicePerDay', label: 'Twice a day' }, { value: 'Flexible', label: 'Flexible' }];
const COACHING_OPTIONS: { value: CoachingStyle;           label: string }[] = [{ value: 'Demanding', label: 'Demanding' }, { value: 'Balanced', label: 'Balanced' }, { value: 'Relaxed', label: 'Relaxed' }];
const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: '1h' }, { value: 90, label: '1h 30m' }, { value: 120, label: '2h' },
  { value: 150, label: '2h 30m' }, { value: 180, label: '3h' }, { value: 210, label: '3h 30m' }, { value: 240, label: '4h' },
];
const GOAL_OPTIONS: { value: MainGoal; label: string }[] = [
  { value: 'ImproveTechnique',      label: 'Improve Technique' },
  { value: 'ImproveFitness',        label: 'Improve Fitness' },
  { value: 'PrepareForTournaments', label: 'Prepare for Tournaments' },
  { value: 'FindHittingPartners',   label: 'Find Hitting Partners' },
  { value: 'ReturnToTennis',        label: 'Return to Tennis' },
  { value: 'TrainRecreationally',   label: 'Train Recreationally' },
  { value: 'BecomeProfessional',    label: 'Become Professional' },
];
const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'Clay', label: 'Clay' }, { value: 'HardCourt', label: 'Hard Court' },
  { value: 'Grass', label: 'Grass' }, { value: 'NoPreference', label: 'No Preference' },
];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

@Component({
  selector: 'app-player-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, SkillLevelSelectorComponent, FormFieldComponent],
  template: `
    <div class="edit-header">
      <p class="edit-title">Edit profile</p>
      <button type="button" class="cancel-link" (click)="cancelled.emit()">
        ← Cancel
      </button>
    </div>

    @if (submitError()) {
      <p class="submit-error">{{ submitError() }}</p>
    }

    <div class="sections" [formGroup]="form">

      <!-- ── Basic Info ── -->
      <div class="section-card">
        <p class="section-label">Basic Info</p>

        <div class="field">
          <label class="field-label" [for]="dobId">Date of Birth</label>
          <input [id]="dobId" type="date" class="input"
                 [class.is-invalid]="touched('dateOfBirth') && invalid('dateOfBirth')"
                 formControlName="dateOfBirth"
                 [max]="maxDate" [min]="minDate" />
          @if (touched('dateOfBirth') && invalid('dateOfBirth')) {
            <p class="field-error">
              @if (errors('dateOfBirth')?.['required'])    { Date of birth is required. }
              @else if (errors('dateOfBirth')?.['ageTooYoung']) { Must be at least 5 years old. }
              @else if (errors('dateOfBirth')?.['ageTooOld'])   { Age cannot exceed 100 years. }
            </p>
          }
        </div>

        <div class="field">
          <label class="field-label">Skill Level</label>
          <app-skill-level-selector formControlName="skillLevel" />
        </div>
      </div>

      <!-- ── Your Style ── -->
      <div class="section-card">
        <p class="section-label">Your Style</p>

        <div class="field">
          <p class="field-label">Preferred Hand</p>
          <div class="tile-group">
            @for (opt of handOptions; track opt.value) {
              <button type="button" class="tile"
                      [class.selected]="form.get('preferredHand')!.value === opt.value"
                      (click)="pickOne('preferredHand', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('preferredHand') && invalid('preferredHand')) {
            <p class="field-error">Please select your preferred hand.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Backhand Type</p>
          <div class="tile-group">
            @for (opt of backhandOptions; track opt.value) {
              <button type="button" class="tile"
                      [class.selected]="form.get('backhandType')!.value === opt.value"
                      (click)="pickOne('backhandType', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('backhandType') && invalid('backhandType')) {
            <p class="field-error">Please select your backhand type.</p>
          }
        </div>

        <div class="field">
          <label class="field-label" [for]="yearsId">Years Playing Tennis</label>
          <input [id]="yearsId" type="number" class="input"
                 [class.is-invalid]="touched('yearsPlaying') && invalid('yearsPlaying')"
                 [value]="form.get('yearsPlaying')!.value ?? ''"
                 (input)="setNumber('yearsPlaying', $event)"
                 (blur)="form.get('yearsPlaying')!.markAsTouched()"
                 min="0" max="80" step="1" placeholder="e.g. 5" />
          @if (touched('yearsPlaying') && invalid('yearsPlaying')) {
            <p class="field-error">
              @if (errors('yearsPlaying')?.['required'])         { Years playing is required. }
              @else if (errors('yearsPlaying')?.['min'])         { Cannot be negative. }
              @else if (errors('yearsPlaying')?.['max'])         { Value too high (max 80). }
              @else if (errors('yearsPlaying')?.['wholeNumber']) { Must be a whole number. }
              @else if (errors('yearsPlaying')?.['yearsExceedsAge']) { Cannot exceed your age minus 4. }
            </p>
          }
        </div>
      </div>

      <!-- ── Training Schedule ── -->
      <div class="section-card">
        <p class="section-label">Training Schedule</p>

        <div class="field">
          <p class="field-label">Training Days per Week</p>
          <div class="chip-group">
            @for (day of days; track day) {
              <button type="button" class="chip chip-sq"
                      [class.selected]="form.get('trainingDaysPerWeek')!.value === day"
                      (click)="pickOne('trainingDaysPerWeek', day)">{{ day }}</button>
            }
          </div>
          @if (touched('trainingDaysPerWeek') && invalid('trainingDaysPerWeek')) {
            <p class="field-error">Please select how many days per week you train.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Training Frequency per Day</p>
          <div class="chip-group">
            @for (opt of frequencyOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="form.get('trainingFrequencyPerDay')!.value === opt.value"
                      (click)="pickOne('trainingFrequencyPerDay', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('trainingFrequencyPerDay') && invalid('trainingFrequencyPerDay')) {
            <p class="field-error">Please select a training frequency.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Preferred Session Duration</p>
          <div class="chip-group">
            @for (opt of durationOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="form.get('preferredSessionDurationMinutes')!.value === opt.value"
                      (click)="pickOne('preferredSessionDurationMinutes', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('preferredSessionDurationMinutes') && invalid('preferredSessionDurationMinutes')) {
            <p class="field-error">Please select a session duration.</p>
          }
        </div>
      </div>

      <!-- ── Goals & Preferences ── -->
      <div class="section-card">
        <p class="section-label">Goals &amp; Preferences</p>

        <div class="field">
          <p class="field-label">Main Goals <span class="field-hint">(select all that apply)</span></p>
          <div class="chip-group">
            @for (opt of goalOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="isGoalSelected(opt.value)"
                      (click)="toggleGoal(opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('mainGoals') && invalid('mainGoals')) {
            <p class="field-error">
              @if (errors('mainGoals')?.['goalsEmpty'])   { Select at least one goal. }
              @else if (errors('mainGoals')?.['goalsTooMany']) { Maximum 7 goals. }
            </p>
          }
        </div>

        <div class="field">
          <p class="field-label">Preferred Surface</p>
          <div class="chip-group">
            @for (opt of surfaceOptions; track opt.value) {
              <button type="button" class="chip"
                      [class.selected]="form.get('preferredSurface')!.value === opt.value"
                      (click)="pickOne('preferredSurface', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('preferredSurface') && invalid('preferredSurface')) {
            <p class="field-error">Please select a preferred surface.</p>
          }
        </div>

        <div class="field">
          <p class="field-label">Preferred Coaching Style</p>
          <div class="tile-group">
            @for (opt of coachingOptions; track opt.value) {
              <button type="button" class="tile"
                      [class.selected]="form.get('preferredCoachingStyle')!.value === opt.value"
                      (click)="pickOne('preferredCoachingStyle', opt.value)">{{ opt.label }}</button>
            }
          </div>
          @if (touched('preferredCoachingStyle') && invalid('preferredCoachingStyle')) {
            <p class="field-error">Please select a coaching style.</p>
          }
        </div>
      </div>

      <!-- ── Inspiration ── -->
      <div class="section-card">
        <p class="section-label">Inspiration</p>

        <div class="insp-block">
          <div class="insp-header">
            <div>
              <p class="field-label">Favorite Player</p>
              <p class="field-hint">Who inspires your game?</p>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" class="toggle-input" formControlName="favoritePlayerNone" />
              <span class="toggle-track"></span>
              <span class="toggle-text">None / Skip</span>
            </label>
          </div>
          @if (!form.get('favoritePlayerNone')!.value) {
            <app-form-field label="" [control]="form.get('favoritePlayer')!"
                            type="text" autocomplete="off"
                            [errorMessages]="{ required: 'Please enter a player name.', fuzzyNone: 'Please enter a real player name.' }" />
          }
        </div>

        <div class="insp-block">
          <div class="insp-header">
            <div>
              <p class="field-label">Wants to Play Like</p>
              <p class="field-hint">Which player's style do you want to emulate?</p>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" class="toggle-input" formControlName="wantsToPlayLikeNone" />
              <span class="toggle-track"></span>
              <span class="toggle-text">None / Skip</span>
            </label>
          </div>
          @if (!form.get('wantsToPlayLikeNone')!.value) {
            <app-form-field label="" [control]="form.get('wantsToPlayLike')!"
                            type="text" autocomplete="off"
                            [errorMessages]="{ required: 'Please enter a player name.', fuzzyNone: 'Please enter a real player name.' }" />
          }
        </div>
      </div>

      <!-- ── About You ── -->
      <div class="section-card">
        <p class="section-label">About You</p>

        <div class="field">
          <label class="field-label" [for]="bioId">Bio <span class="field-hint">(optional, max 500 chars)</span></label>
          <textarea [id]="bioId" class="textarea" formControlName="bio"
                    [class.is-invalid]="touched('bio') && invalid('bio')"
                    rows="4" placeholder="Tell coaches and other players a bit about yourself…"></textarea>
          @if (touched('bio') && invalid('bio')) {
            <p class="field-error">Bio cannot exceed 500 characters.</p>
          }
          <p class="char-count">{{ form.get('bio')!.value.length }} / 500</p>
        </div>
      </div>

    </div><!-- /sections -->

    <!-- Bottom actions -->
    <div class="form-footer">
      <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Cancel</button>
      <button type="button" class="btn btn-primary"
              [disabled]="submitting()"
              (click)="submit()">
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
      font-family: var(--font-sans);
      transition: color var(--transition-fast);
      &:hover { color: var(--color-ink); }
    }

    .submit-error {
      font-size: var(--text-sm); color: var(--color-danger);
      margin-bottom: 16px;
    }

    /* ── Sections ── */
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
      font-weight: var(--font-medium);
      margin: 0 0 2px;
    }

    /* ── Fields ── */
    .field { display: flex; flex-direction: column; gap: 8px; }
    .field-label {
      font-size: var(--text-sm); font-weight: var(--font-medium);
      color: var(--color-text-primary); margin: 0;
    }
    .field-hint {
      font-size: var(--text-xs); color: var(--color-text-secondary);
      font-weight: var(--font-normal);
    }
    .field-error { font-size: var(--text-xs); color: var(--color-danger); }

    /* ── Input ── */
    .input, .textarea {
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
      &:focus { border-color: var(--color-gold); box-shadow: 0 0 0 3px var(--color-gold-soft); }
      &.is-invalid { border-color: var(--color-danger); &:focus { box-shadow: 0 0 0 3px var(--color-danger-light); } }
    }
    .textarea { resize: vertical; min-height: 96px; line-height: 1.5; }
    .char-count {
      font-size: var(--text-xs); color: var(--color-text-secondary);
      text-align: right;
    }

    /* ── Tile group ── */
    .tile-group { display: flex; gap: 12px; }
    .tile {
      flex: 1; padding: 14px 12px;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm); font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer; text-align: center;
      transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
      &:hover:not(.selected) { border-color: var(--color-gold); }
      &.selected { border-color: var(--color-gold); background: var(--color-gold-soft); color: var(--color-gold); font-weight: var(--font-semibold); }
    }

    /* ── Chip group ── */
    .chip-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      padding: 8px 16px;
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: var(--text-sm); font-weight: var(--font-medium);
      font-family: var(--font-sans); cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
      &:hover:not(.selected) { border-color: var(--color-gold); }
      &.selected { border-color: var(--color-gold); background: var(--color-gold); color: var(--color-text-inverse); }
    }
    .chip-sq {
      padding: 8px; min-width: 36px;
      border-radius: var(--radius-sm); text-align: center;
    }

    /* ── Inspiration block ── */
    .insp-block {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .insp-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
    }
    .toggle-wrap {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer; flex-shrink: 0;
    }
    .toggle-input { display: none; }
    .toggle-track {
      width: 36px; height: 20px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative;
      transition: background var(--transition-fast);
      flex-shrink: 0;
      &::after {
        content: ''; position: absolute;
        top: 2px; left: 2px;
        width: 16px; height: 16px;
        border-radius: var(--radius-full);
        background: var(--color-surface);
        transition: transform var(--transition-fast);
      }
    }
    .toggle-input:checked ~ .toggle-track {
      background: var(--color-gold);
      &::after { transform: translateX(16px); }
    }
    .toggle-text { font-size: var(--text-xs); color: var(--color-text-secondary); white-space: nowrap; }

    /* ── Footer ── */
    .form-footer {
      display: flex; justify-content: flex-end; gap: 12px;
      padding: 24px 0 0;
    }
    .btn {
      height: 40px; padding: 0 18px;
      border-radius: 10px;
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
export class PlayerEditFormComponent implements OnInit {
  @Input({ required: true }) initialData!: PlayerProfileDto;
  @Output() saved     = new EventEmitter<UserDto>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb             = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef     = inject(DestroyRef);

  readonly submitting  = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly handOptions      = HAND_OPTIONS;
  readonly backhandOptions  = BACKHAND_OPTIONS;
  readonly frequencyOptions = FREQUENCY_OPTIONS;
  readonly coachingOptions  = COACHING_OPTIONS;
  readonly durationOptions  = DURATION_OPTIONS;
  readonly goalOptions      = GOAL_OPTIONS;
  readonly surfaceOptions   = SURFACE_OPTIONS;
  readonly days             = DAYS;

  readonly dobId  = `dob-${Math.random().toString(36).slice(2, 8)}`;
  readonly yearsId = `yp-${Math.random().toString(36).slice(2, 8)}`;
  readonly bioId  = `bio-${Math.random().toString(36).slice(2, 8)}`;

  readonly maxDate = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 5);   return d.toISOString().split('T')[0]; })();
  readonly minDate = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 100); return d.toISOString().split('T')[0]; })();

  form!: ReturnType<typeof this.buildForm>;

  ngOnInit(): void {
    this.form = this.buildForm();
    this.form.patchValue({
      dateOfBirth:                     this.initialData.dateOfBirth,
      skillLevel:                      this.initialData.skillLevel,
      preferredHand:                   this.initialData.preferredHand,
      backhandType:                    this.initialData.backhandType,
      yearsPlaying:                    this.initialData.yearsPlaying,
      trainingDaysPerWeek:             this.initialData.trainingDaysPerWeek,
      trainingFrequencyPerDay:         this.initialData.trainingFrequencyPerDay,
      preferredSessionDurationMinutes: this.initialData.preferredSessionDurationMinutes,
      mainGoals:                       this.initialData.mainGoals,
      preferredSurface:                this.initialData.preferredSurface,
      preferredCoachingStyle:          this.initialData.preferredCoachingStyle,
      favoritePlayerNone:              this.initialData.favoritePlayerNone,
      favoritePlayer:                  this.initialData.favoritePlayer,
      wantsToPlayLikeNone:             this.initialData.wantsToPlayLikeNone,
      wantsToPlayLike:                 this.initialData.wantsToPlayLike,
      bio:                             this.initialData.bio ?? '',
    });

    const fpNone   = this.form.get('favoritePlayerNone')!;
    const fp       = this.form.get('favoritePlayer')!;
    const wtplNone = this.form.get('wantsToPlayLikeNone')!;
    const wtpl     = this.form.get('wantsToPlayLike')!;

    this.syncInspiration(fp, fpNone.value as boolean);
    this.syncInspiration(wtpl, wtplNone.value as boolean);

    fpNone.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v: boolean) => this.syncInspiration(fp, v));
    wtplNone.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v: boolean) => this.syncInspiration(wtpl, v));
  }

  /* ── Helpers ── */
  touched(name: string): boolean { return !!this.form.get(name)?.touched; }
  invalid(name: string): boolean { return !!this.form.get(name)?.invalid; }
  errors(name: string): Record<string, unknown> | null { return this.form.get(name)?.errors ?? null; }

  pickOne(name: string, value: string | number): void {
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

  isGoalSelected(goal: MainGoal): boolean {
    return (this.form.get('mainGoals')!.value as MainGoal[]).includes(goal);
  }

  toggleGoal(goal: MainGoal): void {
    const ctrl    = this.form.get('mainGoals')!;
    const current = ctrl.value as MainGoal[];
    ctrl.setValue(current.includes(goal) ? current.filter(g => g !== goal) : [...current, goal]);
    ctrl.markAsTouched();
  }

  submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const v = this.form.getRawValue();
    this.profileService.savePlayerProfile({
      dateOfBirth:                     v.dateOfBirth,
      skillLevel:                      v.skillLevel,
      preferredHand:                   v.preferredHand! as PreferredHand,
      backhandType:                    v.backhandType! as BackhandType,
      yearsPlaying:                    v.yearsPlaying!,
      mainGoals:                       v.mainGoals,
      preferredSurface:                v.preferredSurface! as Surface,
      trainingDaysPerWeek:             v.trainingDaysPerWeek!,
      trainingFrequencyPerDay:         v.trainingFrequencyPerDay! as TrainingFrequencyPerDay,
      preferredSessionDurationMinutes: v.preferredSessionDurationMinutes!,
      preferredCoachingStyle:          v.preferredCoachingStyle! as CoachingStyle,
      favoritePlayer:    v.favoritePlayerNone ? '' : v.favoritePlayer,
      favoritePlayerNone:              v.favoritePlayerNone,
      wantsToPlayLike:   v.wantsToPlayLikeNone ? '' : v.wantsToPlayLike,
      wantsToPlayLikeNone:             v.wantsToPlayLikeNone,
      bio:               v.bio || undefined,
    }).subscribe({
      next:  (updated) => { this.submitting.set(false); this.saved.emit(updated); },
      error: ()        => { this.submitting.set(false); this.submitError.set('Something went wrong. Please try again.'); },
    });
  }

  /* ── Private ── */
  private buildForm() {
    const dateOfBirth = new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, dateOfBirthAgeValidator],
    });

    return this.fb.group({
      dateOfBirth,
      skillLevel:                      new FormControl<number>(5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10)] }),
      preferredHand:                   new FormControl<string | null>(null, Validators.required),
      backhandType:                    new FormControl<string | null>(null, Validators.required),
      yearsPlaying:                    new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(80), wholeNumberValidator, yearsPlayingValidator(dateOfBirth)]),
      trainingDaysPerWeek:             new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(7)]),
      trainingFrequencyPerDay:         new FormControl<string | null>(null, Validators.required),
      preferredSessionDurationMinutes: new FormControl<number | null>(null, [Validators.required, sessionDurationValidator]),
      mainGoals:                       new FormControl<MainGoal[]>([], { nonNullable: true, validators: [mainGoalsValidator] }),
      preferredSurface:                new FormControl<string | null>(null, Validators.required),
      preferredCoachingStyle:          new FormControl<string | null>(null, Validators.required),
      favoritePlayerNone:              new FormControl<boolean>(false, { nonNullable: true }),
      favoritePlayer:                  new FormControl<string>('', { nonNullable: true, validators: [Validators.required, notFuzzyNoneValidator] }),
      wantsToPlayLikeNone:             new FormControl<boolean>(false, { nonNullable: true }),
      wantsToPlayLike:                 new FormControl<string>('', { nonNullable: true, validators: [Validators.required, notFuzzyNoneValidator] }),
      bio:                             new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });
  }

  private syncInspiration(control: AbstractControl, isNone: boolean): void {
    if (isNone) {
      control.clearValidators();
      control.setValue('');
    } else {
      control.setValidators([Validators.required, notFuzzyNoneValidator]);
    }
    control.updateValueAndValidity();
  }
}
