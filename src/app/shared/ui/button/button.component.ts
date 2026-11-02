import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      class="btn"
      [class.primary]="variant === 'primary'"
      [class.secondary]="variant === 'secondary'"
      [class.dark]="variant === 'dark'"
      [class.ghost]="variant === 'ghost'"
    >
      @if (loading) {
        <span class="spinner" aria-hidden="true"></span>
        <span>{{ loadingLabel }}</span>
      } @else {
        <span>{{ label }}</span>
      }
    </button>
  `,
  styles: [`
    :host { display: block; }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      width: 100%;
      padding: 10px var(--space-4);
      border-radius: var(--radius-sm);
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer;
      border: none;
      transition: background var(--transition-fast), opacity var(--transition-fast);

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &.primary {
        background: var(--color-gold);
        color: var(--color-text-inverse);

        &:hover:not(:disabled) {
          background: var(--color-gold-hover);
        }

        .spinner {
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: var(--color-text-inverse);
        }
      }

      &.secondary {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);

        &:hover:not(:disabled) {
          background: var(--color-bg);
        }

        .spinner {
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent);
        }
      }

      &.dark {
        background: var(--color-ink);
        color: var(--color-text-inverse);
        border-radius: var(--radius-full);
        height: 48px;
        padding: 0 var(--space-6);

        &:hover:not(:disabled) {
          background: var(--color-ink);
          box-shadow: var(--shadow-md);
        }

        .spinner {
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: var(--color-text-inverse);
        }
      }

      &.ghost {
        background: var(--color-surface);
        border: 1px solid var(--color-line);
        color: var(--color-ink);
        border-radius: var(--radius-full);
        height: 48px;
        padding: 0 var(--space-6);

        &:hover:not(:disabled) {
          box-shadow: var(--shadow-sm);
        }

        .spinner {
          border: 2px solid var(--color-line);
          border-top-color: var(--color-ink);
        }
      }
    }

    .spinner {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      border-radius: var(--radius-full);
      animation: cc-spin 0.65s linear infinite;
    }

    @keyframes cc-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ButtonComponent {
  // Native click events on the inner <button> bubble to the host element, so
  // (click) bindings on <app-button> work without an @Output(). A disabled inner
  // button suppresses its own click — the host stays silent, which is correct.

  @Input({ required: true }) label!: string;
  @Input() variant: 'primary' | 'secondary' | 'dark' | 'ghost' = 'primary';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() loadingLabel = 'Please wait…';
}
