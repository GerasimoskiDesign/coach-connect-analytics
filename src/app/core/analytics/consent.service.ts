import { Injectable, inject, signal } from '@angular/core';
import { readStorage, writeStorage } from '../storage/safe-storage';
import { AnalyticsService } from './analytics.service';
import { ConsentState } from './analytics.models';

/**
 * Must match the key read by the inline script in index.html, which re-applies
 * a stored choice before GTM loads on every page load.
 */
export const CONSENT_KEY = 'cc_consent';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly analytics = inject(AnalyticsService);

  /** null until the visitor has chosen. */
  readonly choice = signal<ConsentState | null>(readStoredChoice());

  accept(): void {
    this.set('granted');
  }

  decline(): void {
    this.set('denied');
  }

  private set(state: ConsentState): void {
    this.analytics.updateConsent(state);
    writeStorage(CONSENT_KEY, state);
    this.choice.set(state);
  }
}

function readStoredChoice(): ConsentState | null {
  const v = readStorage(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}
