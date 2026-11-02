import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div class="track" [attr.aria-valuenow]="clampedValue" aria-valuemin="0" aria-valuemax="100" role="progressbar">
      <div class="fill" [style.width.%]="clampedValue"></div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .track {
      height: 4px;
      background: var(--color-line-subtle);
      border-radius: 2px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      background: var(--color-gold);
      border-radius: 2px;
      transition: width var(--transition-slow);
    }
  `],
})
export class ProgressBarComponent {
  @Input() value = 0;

  get clampedValue(): number {
    return Math.min(100, Math.max(0, this.value));
  }
}
