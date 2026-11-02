import { Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { AbstractControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { notFuzzyNoneValidator } from '../../../../shared/validators/onboarding.validators';

@Component({
  selector: 'app-player-step-5',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="inspiration-block">
        <div class="block-header">
          <div class="block-text">
            <p class="label">Favorite Player</p>
            <p class="sub">Who inspires your game?</p>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" formControlName="favoritePlayerNone" />
            <span class="toggle-track"></span>
            <span class="toggle-text">None / Skip</span>
          </label>
        </div>

        @if (!group().get('favoritePlayerNone')!.value) {
          <app-form-field
            label=""
            [control]="group().get('favoritePlayer')!"
            type="text"
            autocomplete="off"
            [errorMessages]="{
              required: 'Please enter a player name.',
              fuzzyNone: 'Please enter a real player name.'
            }"
          />
        }
      </div>

      <div class="inspiration-block">
        <div class="block-header">
          <div class="block-text">
            <p class="label">Wants to Play Like</p>
            <p class="sub">Which player's style do you want to emulate?</p>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" formControlName="wantsToPlayLikeNone" />
            <span class="toggle-track"></span>
            <span class="toggle-text">None / Skip</span>
          </label>
        </div>

        @if (!group().get('wantsToPlayLikeNone')!.value) {
          <app-form-field
            label=""
            [control]="group().get('wantsToPlayLike')!"
            type="text"
            autocomplete="off"
            [errorMessages]="{
              required: 'Please enter a player name.',
              fuzzyNone: 'Please enter a real player name.'
            }"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    .step { display: flex; flex-direction: column; gap: var(--space-6); }

    .inspiration-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .block-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .block-text { display: flex; flex-direction: column; gap: 2px; }

    .label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-primary);
      margin: 0;
    }

    .sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
      flex-shrink: 0;
    }

    .toggle-input { display: none; }

    .toggle-track {
      width: 36px;
      height: 20px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative;
      transition: background var(--transition-fast);
      flex-shrink: 0;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: var(--radius-full);
        background: var(--color-surface);
        transition: transform var(--transition-fast);
      }

      .toggle-input:checked ~ & {
        background: var(--color-accent);
        &::after { transform: translateX(16px); }
      }
    }

    .toggle-text {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
    }
  `],
})
export class PlayerStep5Component implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly group = input.required<FormGroup>();

  ngOnInit(): void {
    const fg = this.group();
    const fpNone = fg.get('favoritePlayerNone')!;
    const fp = fg.get('favoritePlayer')!;
    const wtplNone = fg.get('wantsToPlayLikeNone')!;
    const wtpl = fg.get('wantsToPlayLike')!;

    this.syncValidators(fp, fpNone.value as boolean);
    this.syncValidators(wtpl, wtplNone.value as boolean);

    fpNone.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((none: boolean) => this.syncValidators(fp, none));

    wtplNone.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((none: boolean) => this.syncValidators(wtpl, none));
  }

  private syncValidators(control: AbstractControl, isNone: boolean): void {
    if (isNone) {
      control.clearValidators();
      control.setValue('');
    } else {
      control.setValidators([Validators.required, notFuzzyNoneValidator]);
    }
    control.updateValueAndValidity();
  }
}
