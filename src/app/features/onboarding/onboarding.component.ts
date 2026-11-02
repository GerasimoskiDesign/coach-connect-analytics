import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  AgeGroup,
  CoachingApproach,
  CoachOnboardingDto,
  MainGoal,
  PlayerOnboardingDto,
  SkillLevelGroup,
  Specialty,
  Surface,
  UserDto,
} from '../../core/models/auth.models';
import { OnboardingService } from './onboarding.service';
import { COACH_STEPS, PLAYER_STEPS } from './onboarding.models';
import { StepIndicatorComponent } from '../../shared/ui/step-indicator/step-indicator.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { PlayerStep1Component } from './steps/player/player-step-1.component';
import { PlayerStep2Component } from './steps/player/player-step-2.component';
import { PlayerStep3Component } from './steps/player/player-step-3.component';
import { PlayerStep4Component } from './steps/player/player-step-4.component';
import { PlayerStep5Component } from './steps/player/player-step-5.component';
import { PlayerStep6Component } from './steps/player/player-step-6.component';
import { CoachStep1Component } from './steps/coach/coach-step-1.component';
import { CoachStep2Component } from './steps/coach/coach-step-2.component';
import { CoachStep3Component } from './steps/coach/coach-step-3.component';
import { CoachStep4Component } from './steps/coach/coach-step-4.component';
import { CoachStep5Component } from './steps/coach/coach-step-5.component';
import { CoachStep6Component } from './steps/coach/coach-step-6.component';
import {
  atLeastOneValidator,
  dateOfBirthAgeValidator,
  mainGoalsValidator,
  notFuzzyNoneValidator,
  sessionDurationValidator,
  wholeNumberValidator,
  yearsPlayingValidator,
} from '../../shared/validators/onboarding.validators';
import { MlNewPlayerPayload, RecommendationsService } from '../recommendations/recommendations.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    StepIndicatorComponent,
    ButtonComponent,
    PlayerStep1Component,
    PlayerStep2Component,
    PlayerStep3Component,
    PlayerStep4Component,
    PlayerStep5Component,
    PlayerStep6Component,
    CoachStep1Component,
    CoachStep2Component,
    CoachStep3Component,
    CoachStep4Component,
    CoachStep5Component,
    CoachStep6Component,
  ],
  template: `
    <div class="onboarding">
      <header class="onboarding-header">
        <p class="wordmark">Coach Connect+</p>
      </header>

      <div class="onboarding-body">
        <app-step-indicator
          [total]="steps.length"
          [current]="currentStep()"
          [stepTitles]="steps"
        />

        <div class="step-content">
          @if (user.role === 'Player') {
            @switch (currentStep()) {
              @case (1) { <app-player-step-1 [group]="stepGroup(1)" /> }
              @case (2) { <app-player-step-2 [group]="stepGroup(2)" /> }
              @case (3) { <app-player-step-3 [group]="stepGroup(3)" /> }
              @case (4) { <app-player-step-4 [group]="stepGroup(4)" /> }
              @case (5) { <app-player-step-5 [group]="stepGroup(5)" /> }
              @case (6) { <app-player-step-6 [group]="stepGroup(6)" /> }
            }
          } @else {
            @switch (currentStep()) {
              @case (1) { <app-coach-step-1 [group]="stepGroup(1)" /> }
              @case (2) { <app-coach-step-2 [group]="stepGroup(2)" /> }
              @case (3) { <app-coach-step-3 [group]="stepGroup(3)" /> }
              @case (4) { <app-coach-step-4 [group]="stepGroup(4)" /> }
              @case (5) { <app-coach-step-5 [group]="stepGroup(5)" /> }
              @case (6) { <app-coach-step-6 [group]="stepGroup(6)" /> }
            }
          }
        </div>

        @if (submitError()) {
          <p class="submit-error">{{ submitError() }}</p>
        }

        <div class="nav-row">
          @if (currentStep() > 1) {
            <app-button label="Back" variant="secondary" (click)="back()" />
          } @else {
            <div></div>
          }

          @if (currentStep() < steps.length) {
            <app-button label="Next" variant="primary" (click)="next()" />
          } @else {
            <app-button
              label="Complete Profile"
              loadingLabel="Saving..."
              variant="primary"
              [disabled]="form.invalid"
              [loading]="submitting()"
              (click)="submit()"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .onboarding {
      min-height: 100vh;
      background: var(--color-bg);
      display: flex;
      flex-direction: column;
    }

    .onboarding-header {
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
    }

    .wordmark {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-gold);
      letter-spacing: -0.01em;
    }

    .onboarding-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-8) var(--space-6);
      gap: var(--space-8);
      max-width: 560px;
      width: 100%;
      margin: 0 auto;
    }

    .step-content {
      width: 100%;
      flex: 1;
      min-height: 240px;
    }

    .submit-error {
      font-size: var(--text-sm);
      color: var(--color-danger);
      text-align: center;
      width: 100%;
    }

    .nav-row {
      display: flex;
      justify-content: space-between;
      width: 100%;

      app-button { width: fit-content; }
    }
  `],
})
export class OnboardingComponent {
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly recommendationsService = inject(RecommendationsService);

  readonly user = this.authService.currentUser!;
  readonly steps = this.user.role === 'Player' ? PLAYER_STEPS : COACH_STEPS;
  readonly form = this.buildForm();

  readonly currentStep = signal(1);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  stepGroup(n: number): FormGroup {
    return this.form.get(`step${n}`) as FormGroup;
  }

  next(): void {
    const stepGroup = this.stepGroup(this.currentStep());
    stepGroup.markAllAsTouched();
    if (stepGroup.invalid) return;
    this.currentStep.update(s => s + 1);
  }

  back(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const obs = this.user.role === 'Player'
      ? this.onboardingService.completePlayerOnboarding(this.buildPlayerDto())
      : this.onboardingService.completeCoachOnboarding(this.buildCoachDto());

    obs.subscribe({
      next: (updated: UserDto) => {
        this.authService.setUser(updated);
        if (this.user.role === 'Player') {
          this.notifyMlService(updated);
        }
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.submitting.set(false);
        this.submitError.set('Something went wrong. Please try again.');
      },
    });
  }

  /** Step 5C: fire-and-forget ML index injection. Not awaited — navigation
   *  to /dashboard proceeds immediately; errors are silently ignored (the
   *  ML service is optional and the dashboard degrades to its empty state). */
  private notifyMlService(updated: UserDto): void {
    const v = this.form.getRawValue();
    const payload: MlNewPlayerPayload = {
      user_id: updated.userId,
      skill_level: v.step1.skillLevel,
      city: updated.city,
      main_goals: v.step4.mainGoals,
      preferred_surfaces: v.step4.preferredSurface ? [v.step4.preferredSurface] : [],
      coaching_approaches: [],
    };
    this.recommendationsService.notifyNewPlayer(payload).subscribe({ error: () => {} });
  }

  private buildForm(): FormGroup {
    return this.user.role === 'Player' ? this.buildPlayerForm() : this.buildCoachForm();
  }

  private buildPlayerForm(): FormGroup {
    const dateOfBirthControl = new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, dateOfBirthAgeValidator],
    });

    const step1 = this.fb.group({
      dateOfBirth: dateOfBirthControl,
      skillLevel: new FormControl<number>(5, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(10)],
      }),
    });

    const step2 = this.fb.group({
      preferredHand: new FormControl<string | null>(null, Validators.required),
      backhandType:  new FormControl<string | null>(null, Validators.required),
      yearsPlaying:  new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(0),
        Validators.max(80),
        wholeNumberValidator,
        yearsPlayingValidator(dateOfBirthControl),
      ]),
    });

    const step3 = this.fb.group({
      trainingDaysPerWeek:             new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(7)]),
      trainingFrequencyPerDay:         new FormControl<string | null>(null, Validators.required),
      preferredSessionDurationMinutes: new FormControl<number | null>(null, [Validators.required, sessionDurationValidator]),
    });

    const step4 = this.fb.group({
      mainGoals:              new FormControl<MainGoal[]>([], { nonNullable: true, validators: [mainGoalsValidator] }),
      preferredSurface:       new FormControl<string | null>(null, Validators.required),
      preferredCoachingStyle: new FormControl<string | null>(null, Validators.required),
    });

    const step5 = this.fb.group({
      favoritePlayerNone:  new FormControl<boolean>(false, { nonNullable: true }),
      favoritePlayer:      new FormControl<string>('', { nonNullable: true, validators: [Validators.required, notFuzzyNoneValidator] }),
      wantsToPlayLikeNone: new FormControl<boolean>(false, { nonNullable: true }),
      wantsToPlayLike:     new FormControl<string>('', { nonNullable: true, validators: [Validators.required, notFuzzyNoneValidator] }),
    });

    const step6 = this.fb.group({
      bio: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });

    return this.fb.group({ step1, step2, step3, step4, step5, step6 });
  }

  private buildCoachForm(): FormGroup {
    const step1 = this.fb.group({
      hourlyRate:          new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(9999), wholeNumberValidator]),
      acceptingNewPlayers: new FormControl<boolean>(true, { nonNullable: true }),
    });

    const step2 = this.fb.group({
      yearsCoaching:   new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(80), wholeNumberValidator]),
      diplomas:        new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
      coachingHistory: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(30), Validators.maxLength(2000)] }),
    });

    const step3 = this.fb.group({
      trainingStyle:     new FormControl<string | null>(null, Validators.required),
      specialties:       new FormControl<Specialty[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      preferredSurfaces: new FormControl<Surface[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
    });

    const step4 = this.fb.group({
      coachingApproaches: new FormControl<CoachingApproach[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
    });

    const step5 = this.fb.group({
      skillLevelGroups: new FormControl<SkillLevelGroup[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
      ageGroups:        new FormControl<AgeGroup[]>([], { nonNullable: true, validators: [atLeastOneValidator] }),
    });

    const step6 = this.fb.group({
      bio: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });

    return this.fb.group({ step1, step2, step3, step4, step5, step6 });
  }

  private buildPlayerDto(): PlayerOnboardingDto {
    const v = this.form.getRawValue();
    return {
      dateOfBirth:                     v.step1.dateOfBirth,
      skillLevel:                      v.step1.skillLevel,
      preferredHand:                   v.step2.preferredHand!,
      backhandType:                    v.step2.backhandType!,
      yearsPlaying:                    v.step2.yearsPlaying!,
      trainingDaysPerWeek:             v.step3.trainingDaysPerWeek!,
      trainingFrequencyPerDay:         v.step3.trainingFrequencyPerDay!,
      preferredSessionDurationMinutes: v.step3.preferredSessionDurationMinutes!,
      mainGoals:                       v.step4.mainGoals,
      preferredSurface:                v.step4.preferredSurface!,
      preferredCoachingStyle:          v.step4.preferredCoachingStyle!,
      favoritePlayer:                  v.step5.favoritePlayerNone ? '' : v.step5.favoritePlayer,
      favoritePlayerNone:              v.step5.favoritePlayerNone,
      wantsToPlayLike:                 v.step5.wantsToPlayLikeNone ? '' : v.step5.wantsToPlayLike,
      wantsToPlayLikeNone:             v.step5.wantsToPlayLikeNone,
      bio:                             v.step6.bio || undefined,
    };
  }

  private buildCoachDto(): CoachOnboardingDto {
    const v = this.form.getRawValue();
    return {
      hourlyRate:          v.step1.hourlyRate!,
      acceptingNewPlayers: v.step1.acceptingNewPlayers,
      yearsCoaching:       v.step2.yearsCoaching!,
      diplomas:            v.step2.diplomas,
      coachingHistory:     v.step2.coachingHistory,
      trainingStyle:       v.step3.trainingStyle!,
      specialties:         v.step3.specialties,
      preferredSurfaces:   v.step3.preferredSurfaces,
      coachingApproaches:  v.step4.coachingApproaches,
      skillLevelGroups:    v.step5.skillLevelGroups,
      ageGroups:           v.step5.ageGroups,
      bio:                 v.step6.bio || undefined,
    };
  }
}
