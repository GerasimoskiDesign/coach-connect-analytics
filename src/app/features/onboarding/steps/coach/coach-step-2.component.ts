import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-coach-step-2',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <label class="label" [for]="yearsId">Years Coaching</label>
        <input
          [id]="yearsId"
          type="number"
          class="input"
          [class.is-invalid]="group().get('yearsCoaching')!.invalid && group().get('yearsCoaching')!.touched"
          [value]="group().get('yearsCoaching')!.value ?? ''"
          (input)="setYearsCoaching($event)"
          (blur)="group().get('yearsCoaching')!.markAsTouched()"
          min="0"
          max="80"
          step="1"
          placeholder="e.g. 8"
        />
        @if (group().get('yearsCoaching')!.invalid && group().get('yearsCoaching')!.touched) {
          <p class="error">
            @if (group().get('yearsCoaching')!.errors?.['required']) { Years coaching is required. }
            @else if (group().get('yearsCoaching')!.errors?.['wholeNumber']) { Years coaching must be a whole number. }
            @else if (group().get('yearsCoaching')!.errors?.['min']) { Cannot be negative. }
            @else if (group().get('yearsCoaching')!.errors?.['max']) { Value seems too high (max 80). }
          </p>
        }
      </div>

      <div class="field">
        <label class="label" for="diplomas">Diplomas &amp; Certifications</label>
        <textarea
          id="diplomas"
          class="textarea"
          [class.is-invalid]="group().get('diplomas')!.invalid && group().get('diplomas')!.touched"
          formControlName="diplomas"
          rows="3"
          placeholder="e.g. ITF Level 1 Coaching Certificate, Tennis Europe Certified Coach"
        ></textarea>
        @if (group().get('diplomas')!.invalid && group().get('diplomas')!.touched) {
          <p class="error">
            @if (group().get('diplomas')!.errors?.['required']) { Please enter your diplomas or certifications. }
            @else if (group().get('diplomas')!.errors?.['minlength']) { Please enter at least 5 characters. }
          </p>
        }
      </div>

      <div class="field">
        <label class="label" for="coachingHistory">Coaching History</label>
        <textarea
          id="coachingHistory"
          class="textarea"
          [class.is-invalid]="group().get('coachingHistory')!.invalid && group().get('coachingHistory')!.touched"
          formControlName="coachingHistory"
          rows="5"
          maxlength="2000"
          placeholder="e.g. Started coaching at Club Vardar in 2015, worked with junior players for 4 years..."
        ></textarea>
        <div class="footer-row">
          @if (group().get('coachingHistory')!.invalid && group().get('coachingHistory')!.touched) {
            <p class="error">
              @if (group().get('coachingHistory')!.errors?.['required']) { Please describe your coaching history. }
              @else if (group().get('coachingHistory')!.errors?.['minlength']) { Minimum 30 characters required. }
              @else if (group().get('coachingHistory')!.errors?.['maxlength']) { Cannot exceed 2,000 characters. }
            </p>
          } @else {
            <span></span>
          }
          <span class="char-count">{{ (group().get('coachingHistory')!.value?.length ?? 0) }}/2000</span>
        </div>
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

    .textarea {
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-3);
      font-size: var(--text-base);
      font-family: var(--font-sans);
      background: var(--color-surface);
      color: var(--color-text-primary);
      outline: none;
      resize: vertical;
      min-height: 80px;
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
    }

    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .char-count {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }
  `],
})
export class CoachStep2Component {
  readonly group = input.required<FormGroup>();
  readonly yearsId = `yc-${Math.random().toString(36).slice(2, 8)}`;

  setYearsCoaching(event: Event): void {
    const input = event.target as HTMLInputElement;
    const ctrl = this.group().get('yearsCoaching')!;
    ctrl.setValue(input.value === '' ? null : Number(input.value));
    ctrl.markAsTouched();
  }
}
