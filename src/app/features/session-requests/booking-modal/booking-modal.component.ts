import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TennisClubsService } from '../tennis-clubs.service';
import { SessionRequestsService } from '../session-requests.service';
import { SessionRequestDto, TennisClubDto } from '../../../core/models/session-request.models';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { roleParam } from '../../../core/analytics/analytics-items';
import { AuthService } from '../../../core/services/auth.service';

interface CalDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  hasAvail: boolean;
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildCalendar(month: number, year: number): CalDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Convert Sun=0 to Mon=0 offset for the first of the month
  let startDow = new Date(year, month, 1).getDay();
  if (startDow === 0) startDow = 6; else startDow--;

  const days: CalDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    d.setHours(0, 0, 0, 0);
    const isCurrentMonth = d.getMonth() === month && d.getFullYear() === year;
    const isPast = d < today;
    const isToday = d.getTime() === today.getTime();
    days.push({
      date: d,
      dayNum: d.getDate(),
      isCurrentMonth,
      isPast,
      isToday,
      hasAvail: isCurrentMonth && !isPast,
    });
  }
  return days;
}

const TIME_SLOTS: string[] = (() => {
  const s: string[] = [];
  for (let h = 6; h <= 23; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`);
    s.push(`${String(h).padStart(2, '0')}:30`);
  }
  s.push('00:00');
  return s;
})();

const DURATIONS = [60, 90, 120, 150, 180, 210, 240];

@Component({
  selector: 'app-booking-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (visible) {
      <div class="backdrop" (click)="close()">
        <div class="modal" role="dialog" aria-labelledby="bm-title" (click)="$event.stopPropagation()">

          <!-- ── Head ── -->
          <div class="modal-head">
            <div>
              <h2 class="modal-title" id="bm-title">Request a session</h2>
              <div class="modal-sub">
                <span class="coach-mini">
                  <span class="coach-mini-av">{{ initials }}</span>
                  with {{ receiverName }}
                </span>
                @if (coachClub) {
                  <span class="sep"></span>
                  <span>{{ coachClub }}</span>
                }
              </div>
            </div>
            <button class="modal-close" type="button" (click)="close()" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- ── Body ── -->
          <form [formGroup]="form" class="modal-body" (ngSubmit)="submit()">

            <!-- Tennis Club -->
            <div class="field">
              <div class="field-label">Tennis Club</div>
              <div class="select-wrap">
                <select formControlName="tennisClubId" class="club-select">
                  <option value="">Select a club…</option>
                  @for (club of clubs(); track club.id) {
                    <option [value]="club.id">{{ club.name }}</option>
                  }
                </select>
                <svg class="select-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="m4 5.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <!-- Scheduler -->
            <div class="field">
              <div class="field-label">Choose date &amp; time</div>
              <div class="scheduler">

                <!-- Calendar -->
                <div class="calendar">
                  <div class="cal-head">
                    <div class="cal-month">{{ calendarTitle }}</div>
                    <div class="cal-nav">
                      <button type="button" class="cal-nav-btn" (click)="prevMonth()" aria-label="Previous month">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M7.5 3 4 6l3.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <button type="button" class="cal-nav-btn" (click)="nextMonth()" aria-label="Next month">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="m4.5 3 3.5 3-3.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="cal-grid">
                    @for (label of DOW_LABELS; track $index) {
                      <div class="cal-dow">{{ label }}</div>
                    }
                    @for (day of calendarDays; track day.date.getTime()) {
                      <button
                        type="button"
                        class="day-btn"
                        [class.muted]="!day.isCurrentMonth"
                        [class.past]="day.isPast && day.isCurrentMonth"
                        [class.today]="day.isToday"
                        [class.selected]="isSelectedDay(day)"
                        [class.has-avail]="day.hasAvail"
                        [disabled]="day.isPast || !day.isCurrentMonth"
                        (click)="selectDay(day)"
                        [attr.aria-label]="day.dayNum + ' ' + calendarTitle">
                        {{ day.dayNum }}
                      </button>
                    }
                  </div>

                  <div class="cal-foot">
                    <div class="cal-legend">
                      <span class="ldot"></span>Available
                    </div>
                    <button type="button" class="cal-link" (click)="jumpToToday()">Jump to today</button>
                  </div>
                </div>

                <!-- Time slots -->
                <div class="times">
                  <div class="times-head">
                    <div class="times-title">{{ selectedDayLabel }}</div>
                    @if (selectedDate) {
                      <div class="times-sub">{{ openSlotCount }} slots open</div>
                    }
                  </div>

                  <div class="dur-chips">
                    @for (d of DURATIONS; track d) {
                      <button
                        type="button"
                        class="dur-chip"
                        [class.active]="form.getRawValue().durationMinutes === d"
                        (click)="selectDuration(d)">
                        {{ d }} min
                      </button>
                    }
                  </div>

                  <div class="time-grid">
                    @for (slot of TIME_SLOTS; track slot) {
                      <button
                        type="button"
                        class="slot"
                        [class.selected]="selectedTime === slot"
                        [disabled]="!selectedDate"
                        (click)="selectTime(slot)">
                        {{ slot }}
                      </button>
                    }
                  </div>
                </div>

              </div>
            </div>

            <!-- Note -->
            <div class="field">
              <label class="field-label" for="bm-note">
                Note <span class="optional">(optional)</span>
              </label>
              <textarea
                id="bm-note"
                formControlName="note"
                class="note-area"
                rows="2"
                maxlength="500"
                [placeholder]="'Add a note for ' + receiverName + '…'">
              </textarea>
            </div>

            @if (errorMsg) {
              <p class="error-msg">{{ errorMsg }}</p>
            }

          </form>

          <!-- ── Summary ── -->
          @if (selectedDate && selectedTime) {
            <div class="summary">
              <div class="summary-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2.5" y="4" width="13" height="11" rx="2" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M2.5 7h13" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M6 2.5v3M12 2.5v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="summary-text">
                <div class="summary-when">{{ summaryWhen }}</div>
                <div class="summary-meta">{{ summaryMeta }}</div>
              </div>
              @if (summaryOriginalPrice) {
                <div class="summary-price">
                  @if (summaryDiscountedPrice) {
                    <span class="price-original">{{ summaryOriginalPrice }}</span>
                    <span class="price-discounted">{{ summaryDiscountedPrice }}</span>
                  } @else {
                    {{ summaryOriginalPrice }}
                  }
                </div>
              }
            </div>
          }

          <!-- ── Footer ── -->
          <div class="modal-foot">
            <div class="modal-foot-left">
              <span class="gold-dot"></span>
              @if (hourlyRate != null) {
                Coach will confirm within 24h
              } @else {
                They will respond to your request
              }
            </div>
            <div class="modal-foot-actions">
              <button type="button" class="btn-ghost" (click)="close()">Cancel</button>
              <button
                type="button"
                class="btn-send"
                [disabled]="!canSubmit"
                (click)="submit()">
                @if (loading) {
                  <span class="send-spinner" aria-hidden="true"></span>
                  Sending…
                } @else {
                  Send request
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6h7M6 2.5 9.5 6 6 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                }
              </button>
            </div>
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
      width: 720px;
      max-width: calc(100vw - 48px);
      background: var(--color-surface);
      border: 1px solid rgba(17, 17, 17, 0.06);
      border-radius: 20px;
      box-shadow: 0 30px 80px rgba(17, 17, 17, 0.18), 0 8px 24px rgba(17, 17, 17, 0.08);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 48px);
      overflow: hidden;
    }

    /* ── Head ── */
    .modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 28px 32px 0;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      margin: 0;
    }

    .modal-sub {
      font-size: 13.5px;
      color: var(--color-text-secondary);
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .coach-mini {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .coach-mini-av {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-gold), #a08443);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 8px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .sep {
      width: 2px;
      height: 2px;
      border-radius: 50%;
      background: var(--color-text-disabled);
      flex-shrink: 0;
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

    /* ── Body ── */
    .modal-body {
      padding: 24px 32px 8px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .field {}

    .field-label {
      font-size: 11px;
      color: var(--color-text-secondary);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 500;
      margin-bottom: 10px;
      display: block;
    }

    .optional {
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
    }

    /* Club select */
    .select-wrap {
      position: relative;
    }

    .club-select {
      width: 100%;
      height: 46px;
      border: 1px solid var(--color-line);
      border-radius: 12px;
      background: var(--color-surface);
      padding: 0 40px 0 16px;
      font-size: 14.5px;
      font-family: var(--font-sans);
      color: var(--color-ink);
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      outline: none;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

      &:hover {
        border-color: rgba(17, 17, 17, 0.18);
      }

      &:focus {
        border-color: var(--color-ink);
        box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.06);
      }
    }

    .select-chev {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--color-text-secondary);
    }

    /* ── Scheduler ── */
    .scheduler {
      display: grid;
      grid-template-columns: 304px 1fr;
      gap: 24px;
      border: 1px solid var(--color-line);
      border-radius: 16px;
      padding: 22px;
      background: linear-gradient(180deg, var(--color-surface) 0%, rgba(250, 250, 250, 0.6) 100%);
    }

    /* Calendar */
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .cal-month {
      font-size: 15.5px;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--color-ink);
    }

    .cal-nav {
      display: flex;
      gap: 4px;
    }

    .cal-nav-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(17, 17, 17, 0.04);
        color: var(--color-ink);
      }
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      row-gap: 4px;
      column-gap: 0;
    }

    .cal-dow {
      text-align: center;
      font-size: 10.5px;
      color: var(--color-text-secondary);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 0 8px;
      font-weight: 500;
    }

    .day-btn {
      border-radius: 50%;
      font-size: 13.5px;
      color: var(--color-ink);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      border: none;
      background: none;
      position: relative;
      margin: 0 auto;
      width: 36px;
      height: 36px;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover:not(:disabled):not(.selected) {
        background: rgba(17, 17, 17, 0.05);
      }

      &.muted {
        color: var(--color-text-disabled);
        pointer-events: none;
      }

      &.past {
        color: var(--color-text-disabled);
        pointer-events: none;
      }

      &.today {
        box-shadow: inset 0 0 0 1px var(--color-ink);
        font-weight: 600;
      }

      /* Gold availability dot — shared by today and has-avail */
      &.today::after,
      &.has-avail::after {
        content: '';
        position: absolute;
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%);
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--color-gold);
      }

      &.selected {
        background: var(--color-ink);
        color: #fff;
        font-weight: 500;
        box-shadow: none;

        &:hover {
          background: #000;
        }

        &::after {
          background: var(--color-gold);
        }
      }
    }

    .cal-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(17, 17, 17, 0.03);
    }

    .cal-legend {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--color-text-secondary);
      letter-spacing: 0.02em;
    }

    .ldot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--color-gold);
      display: inline-block;
      flex-shrink: 0;
    }

    .cal-link {
      font-size: 12.5px;
      color: var(--color-text-secondary);
      border: none;
      background: none;
      cursor: pointer;
      letter-spacing: -0.005em;
      padding: 0;
      transition: color var(--transition-fast);

      &:hover {
        color: var(--color-ink);
      }
    }

    /* Time slots */
    .times {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .times-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .times-title {
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--color-ink);
    }

    .times-sub {
      font-size: 11.5px;
      color: var(--color-text-secondary);
      letter-spacing: 0.005em;
    }

    /* Duration chips */
    .dur-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }

    .dur-chip {
      height: 26px;
      padding: 0 10px;
      font-size: 11.5px;
      font-weight: 500;
      font-family: var(--font-sans);
      color: var(--color-text-secondary);
      border-radius: 6px;
      border: none;
      background: rgba(17, 17, 17, 0.04);
      cursor: pointer;
      letter-spacing: -0.005em;
      transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);

      &:hover {
        background: rgba(17, 17, 17, 0.08);
        color: var(--color-ink);
      }

      &.active {
        background: var(--color-surface);
        color: var(--color-ink);
        box-shadow: 0 1px 3px rgba(17, 17, 17, 0.1);
      }
    }

    /* Time grid */
    .time-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      max-height: 210px;
      overflow-y: auto;
      padding-right: 2px;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: rgba(17, 17, 17, 0.1); border-radius: 2px; }
      &::-webkit-scrollbar-track { background: transparent; }
    }

    .slot {
      height: 34px;
      border: 1px solid var(--color-line);
      border-radius: 8px;
      font-size: 12.5px;
      font-variant-numeric: tabular-nums;
      font-family: var(--font-sans);
      color: var(--color-ink);
      background: var(--color-surface);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
      letter-spacing: 0.005em;
      font-weight: 500;

      &:hover:not(:disabled):not(.selected) {
        background: rgba(17, 17, 17, 0.025);
        border-color: rgba(17, 17, 17, 0.18);
      }

      &.selected {
        background: var(--color-ink);
        color: #fff;
        border-color: var(--color-ink);

        &:hover {
          background: #000;
        }
      }

      &:disabled {
        color: var(--color-text-disabled);
        background: rgba(17, 17, 17, 0.015);
        cursor: not-allowed;
        border-color: var(--color-line);
      }
    }

    /* Note */
    .note-area {
      width: 100%;
      padding: var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: 10px;
      font-size: 14px;
      font-family: var(--font-sans);
      color: var(--color-ink);
      background: var(--color-surface);
      outline: none;
      resize: vertical;
      transition: border-color var(--transition-fast);
      display: block;

      &::placeholder {
        color: var(--color-text-disabled);
      }

      &:focus {
        border-color: var(--color-ink);
      }
    }

    .error-msg {
      font-size: 13px;
      color: var(--color-danger);
      margin: 0;
    }

    /* ── Summary ── */
    .summary {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 32px;
      border-top: 1px solid rgba(17, 17, 17, 0.05);
      background: linear-gradient(180deg, transparent, rgba(201, 169, 97, 0.04));
      flex-shrink: 0;
    }

    .summary-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--color-gold-soft);
      color: var(--color-gold);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .summary-text {
      flex: 1;
      min-width: 0;
    }

    .summary-when {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--color-ink);
    }

    .summary-meta {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    .summary-price {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
      font-family: var(--font-mono);
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.005em;
      color: var(--color-ink);
    }

    .price-original {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-disabled);
      text-decoration: line-through;
    }

    .price-discounted {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--color-gold);
    }

    /* ── Footer ── */
    .modal-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 32px 24px;
      border-top: 1px solid rgba(17, 17, 17, 0.05);
      background: var(--color-surface);
      flex-shrink: 0;
    }

    .modal-foot-left {
      font-size: 12px;
      color: var(--color-text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .gold-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-gold);
      display: inline-block;
      flex-shrink: 0;
    }

    .modal-foot-actions {
      display: flex;
      gap: 10px;
    }

    .btn-ghost {
      height: 42px;
      padding: 0 22px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-sans);
      letter-spacing: -0.005em;
      color: var(--color-ink);
      background: transparent;
      border: 1px solid var(--color-line);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background var(--transition-fast);

      &:hover {
        background: rgba(17, 17, 17, 0.03);
      }
    }

    .btn-send {
      height: 42px;
      padding: 0 22px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-sans);
      letter-spacing: -0.005em;
      background: var(--color-ink);
      color: #fff;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background var(--transition-fast), box-shadow var(--transition-fast);

      &:hover:not(:disabled) {
        background: #000;
        box-shadow: 0 4px 14px rgba(17, 17, 17, 0.18);
      }

      &:disabled {
        background: var(--color-text-disabled);
        cursor: not-allowed;
        box-shadow: none;
      }
    }

    .send-spinner {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      animation: bm-spin 0.65s linear infinite;
      display: inline-block;
      flex-shrink: 0;
    }

    @keyframes bm-spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 720px) {
      .scheduler { grid-template-columns: 1fr; }
      .modal-head, .modal-body, .modal-foot, .summary { padding-left: 20px; padding-right: 20px; }
      .modal-body { padding-top: 18px; }
    }
  `],
})
export class BookingModalComponent {
  @Input({ required: true }) receiverId!: string;
  @Input({ required: true }) receiverName!: string;
  /** Role of the receiver, for analytics (who books whom). */
  @Input({ required: true }) receiverRole!: 'Player' | 'Coach';
  /** Skill level of the receiver when it is a player, for analytics. */
  @Input() receiverSkillLevel?: number;
  @Input() coachClub?: string;
  @Input() hourlyRate?: number;
  @Input() discountPercent: number = 0;
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<SessionRequestDto>();

  private readonly fb = inject(FormBuilder);
  private readonly clubsService = inject(TennisClubsService);
  private readonly sessionService = inject(SessionRequestsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  readonly DOW_LABELS = DOW_LABELS;
  readonly TIME_SLOTS = TIME_SLOTS;
  readonly DURATIONS = DURATIONS;

  readonly clubs = toSignal(this.clubsService.getClubs(), { initialValue: [] as TennisClubDto[] });

  readonly form = this.fb.nonNullable.group({
    tennisClubId: ['', Validators.required],
    month:        ['', Validators.required],
    day:          ['', Validators.required],
    year:         [String(new Date().getFullYear()), Validators.required],
    startTime:    ['', Validators.required],
    durationMinutes: [60 as number],
    note:         [''],
  });

  viewMonth = new Date().getMonth();
  viewYear = new Date().getFullYear();
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  loading = false;
  errorMsg: string | null = null;

  get initials(): string {
    const parts = this.receiverName.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  get calendarTitle(): string {
    return `${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`;
  }

  get calendarDays(): CalDay[] {
    return buildCalendar(this.viewMonth, this.viewYear);
  }

  get selectedDayLabel(): string {
    if (!this.selectedDate) return 'Select a date';
    return `${DAY_NAMES[this.selectedDate.getDay()]}, ${this.selectedDate.getDate()} ${MONTH_NAMES[this.selectedDate.getMonth()]}`;
  }

  get openSlotCount(): number {
    return TIME_SLOTS.length;
  }

  get summaryWhen(): string {
    if (!this.selectedDate || !this.selectedTime) return '';
    const dur = this.form.getRawValue().durationMinutes;
    const [h, m] = this.selectedTime.split(':').map(Number);
    const end = new Date(this.selectedDate);
    end.setHours(h, m + dur, 0, 0);
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    return `${this.selectedDayLabel} · ${this.selectedTime} – ${eh}:${em}`;
  }

  get summaryMeta(): string {
    const dur = this.form.getRawValue().durationMinutes;
    const clubName = this.clubs().find(c => c.id === this.form.getRawValue().tennisClubId)?.name ?? '';
    return `${dur}-minute session${clubName ? ' · ' + clubName : ''}`;
  }

  get summaryOriginalPrice(): string | null {
    if (!this.hourlyRate) return null;
    const dur = this.form.getRawValue().durationMinutes;
    return `${Math.round(this.hourlyRate * dur / 60)} EUR`;
  }

  get summaryDiscountedPrice(): string | null {
    if (!this.hourlyRate || this.discountPercent <= 0) return null;
    const dur = this.form.getRawValue().durationMinutes;
    return `${Math.round(this.hourlyRate * dur / 60 * (1 - this.discountPercent / 100))} EUR`;
  }

  get canSubmit(): boolean {
    return (
      this.selectedDate !== null &&
      this.selectedTime !== null &&
      this.form.getRawValue().tennisClubId !== '' &&
      !this.loading
    );
  }

  isSelectedDay(day: CalDay): boolean {
    return this.selectedDate !== null && day.date.getTime() === this.selectedDate.getTime();
  }

  prevMonth(): void {
    if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
    else this.viewMonth--;
  }

  nextMonth(): void {
    if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
    else this.viewMonth++;
  }

  selectDay(day: CalDay): void {
    if (day.isPast || !day.isCurrentMonth) return;
    this.selectedDate = day.date;
    this.selectedTime = null;
    this.form.patchValue({
      month: String(day.date.getMonth() + 1),
      day:   String(day.date.getDate()),
      year:  String(day.date.getFullYear()),
      startTime: '',
    });
  }

  selectTime(slot: string): void {
    this.selectedTime = slot;
    this.form.patchValue({ startTime: slot });
  }

  selectDuration(d: number): void {
    this.form.patchValue({ durationMinutes: d });
  }

  jumpToToday(): void {
    const now = new Date();
    this.viewMonth = now.getMonth();
    this.viewYear = now.getFullYear();
  }

  close(): void {
    this.errorMsg = null;
    this.closed.emit();
  }

  submit(): void {
    if (!this.canSubmit) return;
    const v = this.form.getRawValue();
    const [hours, minutes] = v.startTime.split(':').map(Number);
    const localDate = new Date(+v.year, +v.month - 1, +v.day, hours, minutes, 0, 0);
    if (localDate <= new Date()) {
      this.errorMsg = 'The selected date and time must be in the future.';
      return;
    }
    this.loading = true;
    this.errorMsg = null;
    this.sessionService.create({
      receiverId:      this.receiverId,
      tennisClubId:    v.tennisClubId,
      proposedDateTime: localDate.toISOString(),
      durationMinutes: v.durationMinutes,
      note:            v.note || undefined,
    }).subscribe({
      next: (created) => {
        // Price as the backend stored it: a coach on either side makes it a paid session.
        this.analytics.bookSession({
          sessionRequestId: created.id,
          requesterId: created.requesterId,
          requesterRole: roleParam(this.auth.currentUser?.role ?? 'Player'),
          receiverId: created.receiverId,
          receiverRole: roleParam(this.receiverRole),
          receiverSkillLevel: this.receiverSkillLevel,
          durationMinutes: created.durationMinutes,
          value: created.estimatedPriceMkd ?? 0,
        });
        this.loading = false;
        this.selectedDate = null;
        this.selectedTime = null;
        this.form.reset({ durationMinutes: 60, year: String(new Date().getFullYear()) });
        this.submitted.emit(created);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.errorMsg = err?.error?.detail ?? 'Something went wrong. Please try again.';
      },
    });
  }
}
