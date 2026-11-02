import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-step-indicator',
  standalone: true,
  template: `
    <div class="step-indicator">
      <div class="step-track">
        @for (n of steps(); track n) {
          <div class="step-item">
            <div
              class="step-circle"
              [class.active]="n === current()"
              [class.completed]="n < current()"
            >
              @if (n < current()) {
                <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              } @else {
                {{ n }}
              }
            </div>
            @if (n < total()) {
              <div class="step-line" [class.completed]="n < current()"></div>
            }
          </div>
        }
      </div>
      <p class="step-label">{{ stepTitles()[current() - 1] }}</p>
    </div>
  `,
  styles: [`
    .step-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }

    .step-track {
      display: flex;
      align-items: center;
    }

    .step-item {
      display: flex;
      align-items: center;
    }

    .step-circle {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      color: var(--color-text-muted);
      transition:
        background var(--transition-fast),
        border-color var(--transition-fast),
        color var(--transition-fast);

      svg {
        width: 12px;
        height: 12px;
      }

      &.active {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: var(--color-text-inverse);
      }

      &.completed {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: var(--color-text-inverse);
      }
    }

    .step-line {
      width: 28px;
      height: 2px;
      flex-shrink: 0;
      background: var(--color-border);
      transition: background var(--transition-fast);

      &.completed {
        background: var(--color-accent);
      }
    }

    .step-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
    }
  `],
})
export class StepIndicatorComponent {
  readonly total = input.required<number>();
  readonly current = input.required<number>();
  readonly stepTitles = input.required<readonly string[]>();

  readonly steps = computed(() =>
    Array.from({ length: this.total() }, (_, i) => i + 1)
  );
}
