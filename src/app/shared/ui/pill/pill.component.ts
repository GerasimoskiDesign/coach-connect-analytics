import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pill',
  standalone: true,
  template: `
    <span class="pill"
          [class.variant-gold]="variant === 'gold'"
          [class.variant-muted]="variant === 'muted'">{{ label }}</span>
  `,
  styles: [`
    :host { display: inline-flex; }

    .pill {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    /* Gold — tier badges, loyalty highlights */
    .variant-gold {
      background: var(--color-gold-soft);
      color: var(--color-gold);
    }

    /* Muted — surface labels, role tags, neutral status */
    .variant-muted {
      background: var(--color-line);
      color: var(--color-text-secondary);
    }
  `],
})
export class PillComponent {
  @Input({ required: true }) label!: string;
  @Input() variant: 'gold' | 'muted' = 'gold';
}
