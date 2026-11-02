import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card" [class.hoverable]="hoverable" [class.dark]="dark">
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .card.hoverable {
      transition: transform var(--transition-base), box-shadow var(--transition-base);

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    }

    .card.dark {
      background: var(--color-ink);
      border-color: transparent;
      color: #fff;
    }
  `],
})
export class CardComponent {
  @Input() hoverable = false;
  @Input() dark = false;
}
