import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CompletedSessionDto } from '../../core/models/session-request.models';

@Component({
  selector: 'app-partner-history-modal',
  standalone: true,
  imports: [],
  template: `
    @if (visible) {
      <div class="backdrop" (click)="close()">
        <div class="modal" role="dialog" [attr.aria-label]="counterpartName + ' session history'" (click)="$event.stopPropagation()">

          <div class="modal-head">
            <div>
              <h2 class="modal-title">{{ counterpartName }}</h2>
              <p class="modal-sub">
                {{ formatHours(totalHours) }} total
                · {{ sessions.length }} session{{ sessions.length === 1 ? '' : 's' }}
              </p>
            </div>
            <button class="modal-close" type="button" (click)="close()" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">

            @if (sessions.length === 0) {
              <div class="empty-state">
                <p class="empty-title">No sessions yet</p>
                <p class="empty-sub">Completed sessions with this person will appear here.</p>
              </div>
            } @else {
              <ul class="session-list">
                @for (s of sessions; track s.id) {
                  <li class="session-row">
                    <div class="row-date">{{ formatDate(s.proposedDateTime) }}</div>
                    <div class="row-meta">
                      <span>{{ formatHours(s.durationMinutes / 60) }}</span>
                      <span class="sep"></span>
                      <span>{{ s.tennisClubName }}</span>
                      @if (s.estimatedPriceMkd) {
                        <span class="sep"></span>
                        <span class="row-price">{{ formatPrice(s.estimatedPriceMkd) }}</span>
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
      width: 480px;
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
      transition: background 0.15s ease, color 0.15s ease;
      flex-shrink: 0;

      &:hover {
        background: rgba(17, 17, 17, 0.04);
        color: var(--color-ink);
      }
    }

    .modal-body {
      padding: 20px 28px 28px;
      overflow-y: auto;
      flex: 1;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: rgba(17, 17, 17, 0.1); border-radius: 2px; }
      &::-webkit-scrollbar-track { background: transparent; }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 40px 0 20px;
      gap: var(--space-2);
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

    .session-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .session-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-line-3);

      &:last-child { border-bottom: none; }
    }

    .row-date {
      font-size: 14px;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--color-ink);
    }

    .row-meta {
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
export class PartnerHistoryModalComponent {
  @Input() visible = false;
  @Input() sessions: CompletedSessionDto[] = [];
  @Input() counterpartName = '';
  @Input() totalHours = 0;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  formatHours(h: number): string {
    const totalMinutes = Math.round(h * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return '0h';
  }

  formatDate(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  formatPrice(mkd: number): string {
    return mkd.toLocaleString('en-US') + ' MKD';
  }
}
