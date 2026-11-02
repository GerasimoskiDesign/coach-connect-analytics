import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UpcomingSessionDto } from '../../core/models/session-request.models';

@Component({
  selector: 'app-upcoming-sessions-modal',
  standalone: true,
  imports: [],
  template: `
    @if (visible) {
      <div class="backdrop" (click)="close()">
        <div class="modal" role="dialog" aria-labelledby="us-title" (click)="$event.stopPropagation()">

          <!-- Head -->
          <div class="modal-head">
            <div>
              <h2 class="modal-title" id="us-title">Sessions</h2>
              <p class="modal-sub">
                {{ totalCount }} session{{ totalCount === 1 ? '' : 's' }}
              </p>
            </div>
            <button class="modal-close" type="button" (click)="close()" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">

            @if (totalCount === 0) {
              <div class="empty-state">
                <div class="empty-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="6" width="22" height="19" rx="3" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M3 11h22" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M9 3.5v5M19 3.5v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <p class="empty-title">No sessions yet</p>
                <p class="empty-sub">Accepted session requests will appear here.</p>
              </div>
            }

            @if (sessions.length > 0) {
              <div class="section-head">Upcoming</div>
              <ul class="session-list">
                @for (session of sessions; track session.id) {
                  <li class="session-row">
                    <div class="row-who">
                      <span class="row-name">{{ session.counterpartFirstName }} {{ session.counterpartLastName }}</span>
                      <span class="row-badge">{{ session.counterpartRole }}</span>
                    </div>
                    <div class="row-when">
                      <span class="row-date">{{ formatDate(session.proposedDateTime) }}</span>
                      <span class="sep"></span>
                      <span class="row-time">{{ formatTime(session.proposedDateTime) }}</span>
                    </div>
                    <div class="row-venue">
                      <span>{{ session.tennisClubName }}</span>
                      <span class="sep"></span>
                      <span>{{ session.durationMinutes }} min</span>
                      @if (session.estimatedPriceMkd) {
                        <span class="sep"></span>
                        <span class="row-price">{{ formatPrice(session.estimatedPriceMkd) }}</span>
                      }
                    </div>
                  </li>
                }
              </ul>
            }

          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(17, 17, 17, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
    }

    .modal {
      position: relative;
      width: 520px;
      max-width: calc(100vw - 48px);
      background: var(--color-surface);
      border: 1px solid rgba(17, 17, 17, 0.06);
      border-radius: 20px;
      box-shadow: 0 30px 80px rgba(17, 17, 17, 0.18), 0 8px 24px rgba(17, 17, 17, 0.08);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 96px);
      overflow: hidden;
    }

    /* Head */
    .modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 28px 28px 0;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      margin: 0;
    }

    .modal-sub {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin: 4px 0 0;
    }

    .modal-close {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background var(--transition-fast), color var(--transition-fast);
      flex-shrink: 0;

      &:hover {
        background: rgba(17, 17, 17, 0.04);
        color: var(--color-ink);
      }
    }

    /* Body */
    .modal-body {
      padding: 20px 28px 28px;
      overflow-y: auto;
      flex: 1;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: rgba(17, 17, 17, 0.1); border-radius: 2px; }
      &::-webkit-scrollbar-track { background: transparent; }
    }

    /* Section headers */
    .section-head {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-muted-2);
      padding-bottom: 6px;
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 40px 0 20px;
      gap: var(--space-2);
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(17, 17, 17, 0.04);
      color: var(--color-muted-2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-2);
    }

    .empty-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-ink);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .empty-sub {
      font-size: 12.5px;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.5;
    }

    /* Session list */
    .session-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .session-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 0;
      border-bottom: 1px solid var(--color-line-3);

      &:last-child { border-bottom: none; }
    }

    .row-who {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .row-name {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--color-ink);
    }

    .row-badge {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      background: rgba(17, 17, 17, 0.06);
      color: var(--color-text-secondary);
    }

    .row-when {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      color: var(--color-text-primary);
    }

    .row-time {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .row-venue {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--color-text-secondary);
    }

    .row-price {
      color: var(--color-gold);
      font-weight: 500;
    }

    .sep {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--color-muted-3);
      flex-shrink: 0;
    }
  `],
})
export class UpcomingSessionsModalComponent {
  @Input() visible = false;
  @Input() sessions: UpcomingSessionDto[] = [];
  @Output() closed = new EventEmitter<void>();

  get totalCount(): number {
    return this.sessions.length;
  }

  close(): void {
    this.closed.emit();
  }

  formatDate(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  formatTime(dt: string): string {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatPrice(mkd: number): string {
    return mkd.toLocaleString('en-US') + ' MKD';
  }
}
