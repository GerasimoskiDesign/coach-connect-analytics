import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { NavComponent } from '../../shared/ui/nav/nav.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SessionRequestsService } from '../session-requests/session-requests.service';
import { CoachesService } from '../coaches/coaches.service';
import { PaymentsService } from './payments.service';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { coachItem } from '../../core/analytics/analytics-items';
import { CoachProfileDto } from '../../core/models/discovery.models';
import { PaymentDto, SessionRequestDto } from '../../core/models/session-request.models';

type ViewState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'loaded'; request: SessionRequestDto; coach: CoachProfileDto };

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [NavComponent, CardComponent, ButtonComponent, RouterLink],
  template: `
    <div class="page">
      <app-nav />
      <main class="content">
        @switch (view().type) {
          @case ('loading') { <p class="state-msg">Loading…</p> }
          @case ('error') {
            <p class="state-msg">This booking could not be found.</p>
            <a routerLink="/dashboard" class="back-link">← Back to dashboard</a>
          }
          @case ('loaded') {
            @if (loaded(); as v) {
              <h1 class="title">{{ payment() || v.request.status === 'Accepted' ? 'Booking confirmed' : 'Checkout' }}</h1>

              <app-card>
                <div class="summary">
                  <div class="row"><span class="k">Coach</span><span class="v">{{ v.coach.firstName }} {{ v.coach.lastName }}</span></div>
                  <div class="row"><span class="k">When</span><span class="v">{{ when(v.request) }}</span></div>
                  <div class="row"><span class="k">Where</span><span class="v">{{ v.request.tennisClubName }}</span></div>
                  <div class="row"><span class="k">Duration</span><span class="v">{{ v.request.durationMinutes }} min</span></div>
                  <div class="row total"><span class="k">Total</span><span class="v" data-testid="checkout-total">{{ v.request.estimatedPriceMkd }} EUR</span></div>
                </div>
              </app-card>

              @if (payment(); as p) {
                <div class="confirm" data-testid="payment-confirmed">
                  <p>Payment received. Transaction <strong>{{ p.transactionId }}</strong>.</p>
                  <a routerLink="/dashboard" class="back-link">Go to dashboard →</a>
                </div>
              } @else if (v.request.status === 'Accepted') {
                <div class="confirm">
                  <p>This session is already paid.</p>
                  <a routerLink="/dashboard" class="back-link">Go to dashboard →</a>
                </div>
              } @else {
                <p class="demo-note">Demo checkout: no card is needed and no money moves.</p>
                <div class="cta">
                  <app-button
                    [label]="'Pay ' + v.request.estimatedPriceMkd + ' EUR'"
                    loadingLabel="Processing…"
                    [loading]="paying()"
                    variant="dark"
                    data-testid="pay-now"
                    (click)="pay(v)" />
                </div>
                @if (error()) { <p class="error">{{ error() }}</p> }
              }
            }
          }
        }
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; }
    .content {
      flex: 1; max-width: 560px; width: 100%; margin: 0 auto;
      padding: var(--space-8) var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-5);
    }
    .title { font-size: var(--text-3xl); font-weight: var(--font-semibold); color: var(--color-ink); letter-spacing: -0.02em; }
    .summary { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
    .row { display: flex; justify-content: space-between; gap: var(--space-4); font-size: var(--text-base); }
    .k { color: var(--color-text-secondary); }
    .v { color: var(--color-ink); text-align: right; }
    .total { border-top: 1px solid var(--color-line); padding-top: var(--space-3); font-weight: var(--font-semibold); }
    .demo-note { font-size: var(--text-sm); color: var(--color-text-secondary); text-align: center; }
    .cta { display: flex; justify-content: center; app-button { width: 100%; max-width: 320px; } }
    .confirm { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; color: var(--color-ink); }
    .error { color: var(--color-danger); font-size: var(--text-sm); text-align: center; }
    .state-msg { color: var(--color-text-secondary); text-align: center; padding: var(--space-8) 0; }
    .back-link { color: var(--color-ink); font-size: var(--text-sm); }
  `],
})
export class CheckoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sessions = inject(SessionRequestsService);
  private readonly coaches = inject(CoachesService);
  private readonly payments = inject(PaymentsService);
  private readonly analytics = inject(AnalyticsService);

  readonly view = toSignal(
    this.sessions.getById(this.route.snapshot.paramMap.get('requestId')!).pipe(
      switchMap(request => forkJoin({ request: of(request), coach: this.coaches.getCoachById(request.receiverId) })),
      map(({ request, coach }): ViewState => ({ type: 'loaded', request, coach })),
      catchError(() => of<ViewState>({ type: 'error' })),
      startWith<ViewState>({ type: 'loading' }),
    ),
    { requireSync: true },
  );

  readonly paying = signal(false);
  readonly payment = signal<PaymentDto | null>(null);
  readonly error = signal<string | null>(null);

  loaded(): Extract<ViewState, { type: 'loaded' }> | null {
    const v = this.view();
    return v.type === 'loaded' ? v : null;
  }

  pay(v: Extract<ViewState, { type: 'loaded' }>): void {
    if (this.paying()) return;
    this.paying.set(true);
    this.error.set(null);
    this.payments.pay(v.request.id).subscribe({
      next: p => {
        // The item is the booked session: price is what was paid, quantity 1,
        // so GA4 revenue equals the sum of item price x quantity.
        this.analytics.purchase(p.transactionId, v.request.id, p.amount, { ...coachItem(v.coach), price: p.amount, quantity: 1 });
        this.payment.set(p);
        this.paying.set(false);
      },
      error: () => {
        this.error.set('Payment failed. Please try again.');
        this.paying.set(false);
      },
    });
  }

  when(r: SessionRequestDto): string {
    const d = new Date(r.proposedDateTime);
    const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${date}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
