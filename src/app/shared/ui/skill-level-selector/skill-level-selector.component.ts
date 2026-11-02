import { Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const SKILL_LEVELS = [
  { level: 1, name: 'Complete Beginner',            description: 'Never played tennis before.' },
  { level: 2, name: 'Basic Beginner',               description: 'Knows rules, can contact ball, cannot sustain a rally.' },
  { level: 3, name: 'Recreational Beginner',        description: 'Plays casually with no structured training.' },
  { level: 4, name: 'Developing Player',            description: 'Has trained before; rallies but play is inconsistent.' },
  { level: 5, name: 'Regular Player',               description: 'Solid fundamentals, plays complete matches.' },
  { level: 6, name: 'Strong Club Player',           description: 'Competes at club level.' },
  { level: 7, name: 'Competitive National Player',  description: 'Plays in national tournaments and leagues.' },
  { level: 8, name: 'High-Level Competitive',       description: 'Top national or starting international level.' },
  { level: 9, name: 'Near-Professional Player',     description: 'Approaching professional level.' },
  { level: 10, name: 'Professional Player',         description: 'Earns from tennis (ITF, ATP/WTA, etc.).' },
] as const;

@Component({
  selector: 'app-skill-level-selector',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SkillLevelSelectorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="selector">
      <div class="level-track">
        @for (lvl of levels; track lvl.level) {
          <button
            type="button"
            class="level-btn"
            [class.selected]="selected() === lvl.level"
            [disabled]="isDisabled()"
            (click)="select(lvl.level)"
          >{{ lvl.level }}</button>
        }
      </div>

      <div class="level-summary">
        <div class="level-text">
          <span class="level-name">{{ current.name }}</span>
          <span class="level-desc">{{ current.description }}</span>
        </div>
        <button
          type="button"
          class="info-btn"
          (click)="showModal.set(true)"
          aria-label="View all skill level descriptions"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 7v5M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">Skill Levels</h3>
              <button type="button" class="modal-close" (click)="showModal.set(false)" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <ul class="modal-list">
              @for (lvl of levels; track lvl.level) {
                <li class="modal-item" [class.modal-item--active]="selected() === lvl.level">
                  <span class="modal-num">{{ lvl.level }}</span>
                  <div class="modal-text">
                    <p class="modal-name">{{ lvl.name }}</p>
                    <p class="modal-desc">{{ lvl.description }}</p>
                  </div>
                </li>
              }
            </ul>
            <p class="modal-caveat">
              Choose the level that best describes your current playing ability, not only your highest level in the past.
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .selector {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .level-track {
      display: flex;
      gap: var(--space-1);
    }

    .level-btn {
      flex: 1;
      aspect-ratio: 1;
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      font-family: var(--font-sans);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast),
        color var(--transition-fast);

      &:hover:not(:disabled):not(.selected) {
        border-color: var(--color-gold);
        color: var(--color-gold);
      }

      &.selected {
        border-color: var(--color-gold);
        background: var(--color-gold);
        color: var(--color-text-inverse);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .level-summary {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--color-gold-soft);
      border: 1px solid var(--color-gold);
      border-radius: var(--radius-sm);
    }

    .level-text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .level-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-gold);
    }

    .level-desc {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .info-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-gold);
      transition: opacity var(--transition-fast);

      &:hover { opacity: 0.7; }
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: var(--space-4);
    }

    .modal-card {
      background: var(--color-surface);
      border-radius: var(--radius-md);
      width: 100%;
      max-width: 440px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-border-subtle);
      position: sticky;
      top: 0;
      background: var(--color-surface);
    }

    .modal-title {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
    }

    .modal-close {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      transition: color var(--transition-fast);

      &:hover { color: var(--color-text-primary); }
    }

    .modal-list {
      list-style: none;
      padding: var(--space-2) 0;
      margin: 0;
    }

    .modal-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      transition: background var(--transition-fast);

      &:hover { background: var(--color-bg); }

      &.modal-item--active {
        background: var(--color-gold-soft);
      }
    }

    .modal-num {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      background: var(--color-gold);
      color: var(--color-text-inverse);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }

    .modal-text { display: flex; flex-direction: column; gap: 2px; }

    .modal-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-primary);
    }

    .modal-desc {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .modal-caveat {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-style: italic;
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--color-border-subtle);
    }
  `],
})
export class SkillLevelSelectorComponent implements ControlValueAccessor {
  readonly levels = SKILL_LEVELS;
  readonly selected = signal(5);
  readonly showModal = signal(false);
  readonly isDisabled = signal(false);

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  get current() {
    return SKILL_LEVELS.find(l => l.level === this.selected()) ?? SKILL_LEVELS[4];
  }

  select(level: number): void {
    if (this.isDisabled()) return;
    this.selected.set(level);
    this.onChange(level);
    this.onTouched();
  }

  writeValue(value: number): void {
    this.selected.set(value ?? 5);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
