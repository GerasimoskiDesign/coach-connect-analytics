import { Component, inject } from '@angular/core';
import { ConsentService } from '../../../core/analytics/consent.service';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  template: `
    @if (consent.choice() === null) {
      <section class="banner" role="dialog" aria-labelledby="cb-title" aria-describedby="cb-body">
        <div class="text">
          <h2 id="cb-title" class="title">Cookies and analytics</h2>
          <p id="cb-body" class="body">
            We use Google Analytics through Google Tag Manager to understand how the app is used.
            Nothing is stored until you accept. This is a demo with synthetic data.
          </p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-ghost" data-testid="consent-decline" (click)="consent.decline()">Decline</button>
          <button type="button" class="btn btn-dark" data-testid="consent-accept" (click)="consent.accept()">Accept</button>
        </div>
      </section>
    }
  `,
  styles: [`
    .banner {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: var(--space-5);
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      box-shadow: 0 8px 32px rgba(17, 17, 17, 0.12);
    }

    .text { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }

    .title {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
    }

    .body {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

    .btn {
      height: 40px;
      padding: 0 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
    }

    .btn-ghost {
      background: transparent;
      color: var(--color-ink);
      border: 1px solid var(--color-line);
    }

    .btn-dark {
      background: var(--color-ink);
      color: #fff;
      border: none;
    }

    @media (max-width: 600px) {
      .banner { flex-direction: column; align-items: stretch; }
      .actions .btn { flex: 1; }
    }
  `],
})
export class ConsentBannerComponent {
  readonly consent = inject(ConsentService);
}
