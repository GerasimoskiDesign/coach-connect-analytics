import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, merge, of, startWith, Subject, switchMap } from 'rxjs';
import { NavComponent } from '../../../shared/ui/nav/nav.component';
import { SessionRequestsService } from '../session-requests.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SessionRequestDto } from '../../../core/models/session-request.models';
import { RescheduleModalComponent } from '../reschedule-modal/reschedule-modal.component';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { roleParam } from '../../../core/analytics/analytics-items';
import { RequestResponse } from '../../../core/analytics/analytics.models';
import { AuthService } from '../../../core/services/auth.service';

function formatPrice(mkd: number): string {
  return mkd.toLocaleString('en-US') + ' EUR';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} · ${time}`;
}

type Tab = 'incoming' | 'pending';

interface ViewState {
  type: 'loading' | 'loaded' | 'error';
  requests: SessionRequestDto[];
}

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [NavComponent, RescheduleModalComponent],
  template: `
    <div class="page">
      <app-nav />
      <main class="content">

        <div class="page-head">
          <h1 class="page-title">Requests</h1>
          @if (activeTab === 'incoming' && incomingState().type === 'loaded' && incomingState().requests.length > 0) {
            <span class="count-badge">{{ incomingState().requests.length }}</span>
          }
          @if (activeTab === 'pending' && pendingState().type === 'loaded' && pendingState().requests.length > 0) {
            <span class="count-badge">{{ pendingState().requests.length }}</span>
          }
        </div>

        <div class="tabs">
          <button
            class="tab-btn"
            [class.active]="activeTab === 'incoming'"
            (click)="setTab('incoming')">
            Incoming
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'pending'"
            (click)="setTab('pending')">
            Sent
          </button>
        </div>

        @if (activeTab === 'incoming') {
          @if (incomingState().type === 'loading') {
            <p class="state-msg">Loading…</p>

          } @else if (incomingState().type === 'error') {
            <p class="state-msg">Failed to load requests. Please try again.</p>

          } @else if (incomingState().requests.length === 0) {
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M3 10h18" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="empty-title">No incoming requests</p>
              <p class="empty-sub">Session requests sent to you will appear here.</p>
            </div>

          } @else {
            <div class="request-list">
              @for (req of incomingState().requests; track req.id) {
                <div class="request-card" [class.type-player]="req.sessionType === 'PlayerPlayer'">

                  <div class="card-head">
                    <span class="requester-name">
                      {{ req.requesterFirstName }} {{ req.requesterLastName }}
                    </span>
                    <div class="card-head-right">
                      @if (req.estimatedPriceMkd != null) {
                        <span class="price-tag">{{ formatPrice(req.estimatedPriceMkd) }}</span>
                      }
                      @if (req.rescheduleCount > 0) {
                        <span class="reschedule-count">Rescheduled {{ req.rescheduleCount }}×</span>
                      }
                    </div>
                  </div>

                  <div class="card-details">
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1.75" y="2.5" width="10.5" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M1.75 5.5h10.5" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M4.5 1v2M9.5 1v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      <span>{{ formatDT(req.proposedDateTime) }}</span>
                    </div>
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M7 4v3.25l2 1.25" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      <span>{{ req.durationMinutes }} min</span>
                    </div>
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 11.5s0-1.5 5-1.5 5 1.5 5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        <circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                      </svg>
                      <span>{{ req.tennisClubName }}</span>
                    </div>
                    @if (req.note) {
                      <div class="detail-row note-row">
                        <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 3.5h9M2.5 6.5h9M2.5 9.5h5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                        <span class="note-text">{{ req.note }}</span>
                      </div>
                    }
                  </div>

                  <div class="card-actions">
                    <button
                      class="action-btn accept"
                      data-testid="request-accept"
                      [disabled]="actingOn.has(req.id)"
                      (click)="accept(req)">
                      Accept
                    </button>
                    <button
                      class="action-btn decline"
                      data-testid="request-decline"
                      [disabled]="actingOn.has(req.id)"
                      (click)="decline(req)">
                      Decline
                    </button>
                    <button
                      class="action-btn reschedule"
                      data-testid="request-reschedule"
                      [disabled]="actingOn.has(req.id) || remainingReschedules(req) <= 0"
                      (click)="openReschedule(req)">
                      Reschedule
                      @if (remainingReschedules(req) > 0) {
                        <span class="rr-remaining">({{ remainingReschedules(req) }} left)</span>
                      }
                    </button>
                  </div>

                </div>
              }
            </div>
          }
        }

        @if (activeTab === 'pending') {
          @if (pendingState().type === 'loading') {
            <p class="state-msg">Loading…</p>

          } @else if (pendingState().type === 'error') {
            <p class="state-msg">Failed to load sent requests. Please try again.</p>

          } @else if (pendingState().requests.length === 0) {
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <p class="empty-title">No sent requests</p>
              <p class="empty-sub">Requests you've sent that are awaiting a response will appear here.</p>
            </div>

          } @else {
            <div class="request-list">
              @for (req of pendingState().requests; track req.id) {
                <div class="request-card" [class.type-player]="req.sessionType === 'PlayerPlayer'">

                  <div class="card-head">
                    <span class="requester-name">
                      {{ req.receiverFirstName }} {{ req.receiverLastName }}
                    </span>
                    <div class="card-head-right">
                      @if (req.estimatedPriceMkd != null) {
                        <span class="price-tag">{{ formatPrice(req.estimatedPriceMkd) }}</span>
                      }
                      @if (req.rescheduleCount > 0) {
                        <span class="reschedule-count">Rescheduled {{ req.rescheduleCount }}×</span>
                      }
                    </div>
                  </div>

                  <div class="card-details">
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1.75" y="2.5" width="10.5" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M1.75 5.5h10.5" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M4.5 1v2M9.5 1v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      <span>{{ formatDT(req.proposedDateTime) }}</span>
                    </div>
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M7 4v3.25l2 1.25" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      <span>{{ req.durationMinutes }} min</span>
                    </div>
                    <div class="detail-row">
                      <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 11.5s0-1.5 5-1.5 5 1.5 5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        <circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                      </svg>
                      <span>{{ req.tennisClubName }}</span>
                    </div>
                    @if (req.note) {
                      <div class="detail-row note-row">
                        <svg class="detail-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 3.5h9M2.5 6.5h9M2.5 9.5h5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                        <span class="note-text">{{ req.note }}</span>
                      </div>
                    }
                  </div>

                  <div class="card-sent-footer">
                    <span class="sent-label">Awaiting response</span>
                  </div>

                </div>
              }
            </div>
          }
        }

      </main>
    </div>

    @if (rescheduleRequest) {
      <app-reschedule-modal
        [visible]="rescheduleOpen"
        [request]="rescheduleRequest"
        (closed)="closeReschedule()"
        (submitted)="onRescheduled()" />
    }
  `,
  styles: [`
    .page {
      min-height: 100vh;
      background: var(--color-bg);
      display: flex;
      flex-direction: column;
    }

    .content {
      flex: 1;
      max-width: 680px;
      width: 100%;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .page-head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .page-title {
      font-size: var(--text-3xl);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.02em;
      margin: 0;
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 var(--space-2);
      background: var(--color-gold-soft);
      color: var(--color-gold);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: var(--space-1);
      border-bottom: 1px solid var(--color-line);
      margin-bottom: calc(-1 * var(--space-2));
    }

    .tab-btn {
      height: 38px;
      padding: 0 var(--space-4);
      border: none;
      background: none;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      color: var(--color-text-secondary);
      cursor: pointer;
      position: relative;
      transition: color var(--transition-fast);

      &:hover {
        color: var(--color-text-primary);
      }

      &.active {
        color: var(--color-ink);

        &::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-gold);
          border-radius: 1px 1px 0 0;
        }
      }
    }

    .state-msg {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      text-align: center;
      padding: var(--space-12) 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-16) 0;
    }

    .empty-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: rgba(17, 17, 17, 0.04);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-title {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      margin: 0;
    }

    .empty-sub {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0;
      text-align: center;
    }

    /* Request list */
    .request-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .request-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-left: 3px solid var(--color-gold);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);

      &.type-player {
        border-left-color: var(--color-text-disabled);
      }
    }

    /* Card head */
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-line);
    }

    .requester-name {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.01em;
    }

    .card-head-right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-shrink: 0;
    }

    .price-tag {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.005em;
    }

    .reschedule-count {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      font-weight: var(--font-medium);
    }

    /* Card details */
    .card-details {
      padding: var(--space-4) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      border-bottom: 1px solid var(--color-line);
    }

    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .detail-icon {
      color: var(--color-text-secondary);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .note-row { color: var(--color-text-secondary); }
    .note-text { font-style: italic; }

    /* Card actions (incoming) */
    .card-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-5);
    }

    .action-btn {
      height: 34px;
      padding: 0 var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      color: var(--color-ink);
      transition:
        background var(--transition-fast),
        border-color var(--transition-fast),
        color var(--transition-fast);

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &.accept:not(:disabled):hover {
        background: var(--color-ink);
        border-color: var(--color-ink);
        color: #fff;
      }

      &.decline:not(:disabled):hover {
        background: var(--color-danger-light);
        border-color: var(--color-danger);
        color: var(--color-danger);
      }

      &.reschedule:not(:disabled):hover {
        background: var(--color-gold-soft);
        border-color: var(--color-gold);
        color: var(--color-gold);
      }
    }

    .rr-remaining {
      font-size: 11px;
      opacity: 0.65;
    }

    /* Sent card footer */
    .card-sent-footer {
      padding: var(--space-3) var(--space-5);
      display: flex;
      align-items: center;
    }

    .sent-label {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
  `],
})
export class RequestsComponent {
  private readonly sessionService = inject(SessionRequestsService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  private readonly incomingRefresh$ = new Subject<void>();
  private readonly pendingRefresh$ = new Subject<void>();

  readonly incomingState = toSignal(
    merge(of(undefined), this.incomingRefresh$).pipe(
      switchMap(() =>
        this.sessionService.getInbox().pipe(
          map(all => ({
            type: 'loaded' as const,
            requests: all.filter(r => r.status === 'Pending'),
          })),
          catchError(() => of({ type: 'error' as const, requests: [] as SessionRequestDto[] })),
          startWith({ type: 'loading' as const, requests: [] as SessionRequestDto[] })
        )
      )
    ),
    { requireSync: true }
  );

  readonly pendingState = toSignal(
    merge(of(undefined), this.pendingRefresh$).pipe(
      switchMap(() =>
        this.sessionService.getPending().pipe(
          map(reqs => ({ type: 'loaded' as const, requests: reqs })),
          catchError(() => of({ type: 'error' as const, requests: [] as SessionRequestDto[] })),
          startWith({ type: 'loading' as const, requests: [] as SessionRequestDto[] })
        )
      )
    ),
    { requireSync: true }
  );

  activeTab: Tab = 'incoming';
  actingOn = new Set<string>();
  rescheduleRequest: SessionRequestDto | null = null;
  rescheduleOpen = false;

  readonly formatDT = formatDateTime;
  readonly formatPrice = formatPrice;

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  remainingReschedules(req: SessionRequestDto): number {
    return 5 - req.rescheduleCount;
  }

  accept(req: SessionRequestDto): void {
    const id = req.id;
    if (this.actingOn.has(id)) return;
    this.actingOn = new Set([...this.actingOn, id]);
    this.sessionService.accept(id).subscribe({
      next: () => {
        this.trackResponse(req, 'accepted');
        this.actingOn = new Set([...this.actingOn].filter(x => x !== id));
        this.incomingRefresh$.next();
        this.notificationsService.refresh();
      },
      error: () => {
        this.actingOn = new Set([...this.actingOn].filter(x => x !== id));
      },
    });
  }

  decline(req: SessionRequestDto): void {
    const id = req.id;
    if (this.actingOn.has(id)) return;
    this.actingOn = new Set([...this.actingOn, id]);
    this.sessionService.decline(id).subscribe({
      next: () => {
        this.trackResponse(req, 'declined');
        this.actingOn = new Set([...this.actingOn].filter(x => x !== id));
        this.incomingRefresh$.next();
        this.notificationsService.refresh();
      },
      error: () => {
        this.actingOn = new Set([...this.actingOn].filter(x => x !== id));
      },
    });
  }

  openReschedule(req: SessionRequestDto): void {
    this.rescheduleRequest = req;
    this.rescheduleOpen = true;
  }

  closeReschedule(): void {
    this.rescheduleOpen = false;
  }

  onRescheduled(): void {
    if (this.rescheduleRequest) this.trackResponse(this.rescheduleRequest, 'rescheduled');
    this.rescheduleOpen = false;
    this.rescheduleRequest = null;
    this.incomingRefresh$.next();
    this.pendingRefresh$.next();
    this.notificationsService.refresh();
  }

  /** Incoming tab only: the current user is the receiver, so the requester has the other role in a coach session. */
  private trackResponse(req: SessionRequestDto, response: RequestResponse): void {
    const responderRole = roleParam(this.auth.currentUser?.role ?? 'Player');
    const requesterRole = req.sessionType === 'PlayerPlayer' ? 'player'
      : responderRole === 'coach' ? 'player' : 'coach';
    this.analytics.sessionRequestResponded({ sessionRequestId: req.id, response, responderRole, requesterRole });
  }
}
