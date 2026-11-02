import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-player-step-6',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step" [formGroup]="group()">
      <div class="field">
        <div class="label-row">
          <label class="label" for="bio">Bio</label>
          <span class="optional">Optional</span>
        </div>
        <p class="sub">Tell coaches and players a little about yourself.</p>
        <textarea
          id="bio"
          class="textarea"
          [class.is-invalid]="group().get('bio')!.invalid && group().get('bio')!.touched"
          formControlName="bio"
          rows="5"
          maxlength="500"
          placeholder="e.g. Playing tennis since I was 10, love competing at club level on clay..."
        ></textarea>
        <div class="footer-row">
          @if (group().get('bio')!.invalid && group().get('bio')!.touched) {
            <p class="error">Bio cannot exceed 500 characters.</p>
          } @else {
            <span></span>
          }
          <span class="char-count">{{ (group().get('bio')!.value?.length ?? 0) }}/500</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .step { display: flex; flex-direction: column; gap: var(--space-6); }

    .field { display: flex; flex-direction: column; gap: var(--space-1); }

    .label-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-primary);
    }

    .optional {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      padding: 1px var(--space-2);
    }

    .sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-1);
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
      min-height: 120px;
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

    .error {
      font-size: var(--text-xs);
      color: var(--color-danger);
    }

    .char-count {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
  `],
})
export class PlayerStep6Component {
  readonly group = input.required<FormGroup>();
}
