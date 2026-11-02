import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, Observable, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NavComponent } from '../../shared/ui/nav/nav.component';
import { SessionRequestsService } from '../session-requests/session-requests.service';
import { ProgressionService } from '../progression/progression.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { UpcomingSessionDto, CompletedSessionDto } from '../../core/models/session-request.models';
import { CoachPlayerProgressionDto } from '../../core/models/progression.models';
import { RecommendedCoachDto, RecommendedPlayerDto } from '../../core/models/recommendation.models';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { ExperimentService } from '../../core/analytics/experiment.service';
import { coachItem } from '../../core/analytics/analytics-items';

/** How many recommendations the dashboard shows (and reports in view_item_list). */
const REC_DISPLAY_COUNT = 5;
import { UpcomingSessionsModalComponent } from './upcoming-sessions-modal.component';
import { PartnerHistoryModalComponent } from './partner-history-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NavComponent, RouterLink, UpcomingSessionsModalComponent, PartnerHistoryModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly sessionRequestsService = inject(SessionRequestsService);
  private readonly progressionService = inject(ProgressionService);
  private readonly recommendationsService = inject(RecommendationsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly experiment = inject(ExperimentService);

  readonly REC_DISPLAY_COUNT = REC_DISPLAY_COUNT;

  showUpcomingModal = false;
  readonly selectedCounterpartId = signal<string | null>(null);
  readonly selectedWeekOffset = signal(0);
  readonly selectedDayIndex = signal((new Date().getDay() + 6) % 7);

  readonly currentUser = toSignal(this.authService.currentUser$);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly upcomingSessions = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        this.sessionRequestsService.getUpcoming().pipe(
          catchError(() => of([] as UpcomingSessionDto[]))
        )
      )
    ),
    { initialValue: [] as UpcomingSessionDto[] }
  );

  readonly completedSessions = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        this.sessionRequestsService.getCompleted().pipe(
          catchError(() => of([] as CompletedSessionDto[]))
        )
      )
    ),
    { initialValue: [] as CompletedSessionDto[] }
  );

  readonly progression = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        this.progressionService.getMyProgression().pipe(
          catchError(() => of([] as CoachPlayerProgressionDto[]))
        )
      )
    ),
    { initialValue: [] as CoachPlayerProgressionDto[] }
  );

  readonly nextSession = computed(() => this.upcomingSessions()[0] ?? null);

  readonly thisWeekSessions = computed((): UpcomingSessionDto[] => {
    const monday = this.weekMonday(this.selectedWeekOffset());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const inWeek = (dt: string) => { const d = new Date(dt); return d >= monday && d <= sunday; };
    return [
      ...this.completedSessions().filter(s => inWeek(s.proposedDateTime)),
      ...this.upcomingSessions().filter(s => inWeek(s.proposedDateTime)),
    ];
  });

  readonly sessionDayNums = computed(() =>
    new Set(this.thisWeekSessions().map(s => (new Date(s.proposedDateTime).getDay() + 6) % 7))
  );

  readonly selectedDaySessions = computed(() =>
    this.thisWeekSessions().filter(
      s => (new Date(s.proposedDateTime).getDay() + 6) % 7 === this.selectedDayIndex()
    )
  );

  readonly sessionsCompleted = computed(() => this.completedSessions().length);

  readonly selectedProgressionIndex = signal(0);
  readonly recommendationType = signal<'coaches' | 'players'>('coaches');
  readonly progressionInfoOpen = signal(false);
  readonly CIRC_SM = 157.08;

  readonly recommendationsLoading = signal(true);

  readonly recommendations = toSignal(
    toObservable(this.recommendationType).pipe(
      tap(() => this.recommendationsLoading.set(true)),
      switchMap(type => {
        const source$: Observable<(RecommendedCoachDto | RecommendedPlayerDto)[]> =
          type === 'coaches'
            ? this.recommendationsService.getCoachRecommendations()
            : this.recommendationsService.getPlayerRecommendations();
        return source$.pipe(
          catchError(() => of([] as (RecommendedCoachDto | RecommendedPlayerDto)[])),
          tap(list => {
            // Only coach recommendations are bookable items; player matches are not tracked as a list.
            if (type === 'coaches' && list.length > 0) {
              this.analytics.viewRecommendedList(
                (list as RecommendedCoachDto[]).slice(0, REC_DISPLAY_COUNT).map(r => coachItem(r, r.rank)),
              );
            }
          }),
        );
      }),
      tap(() => this.recommendationsLoading.set(false))
    ),
    { initialValue: [] as (RecommendedCoachDto | RecommendedPlayerDto)[] }
  );

  private readonly DRIFT_NUDGE_KEY = 'skillDriftNudgeDismissed';
  private readonly DRIFT_NUDGE_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;

  readonly showEmailBanner = signal(true);
  readonly showDriftNudge = signal(false);

  readonly showEmailVerificationBanner = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return !user.emailConfirmed
      && !user.email.toLowerCase().endsWith('@synthetic.cc')
      && this.showEmailBanner();
  });

  readonly selectedProgression = computed((): CoachPlayerProgressionDto | null => {
    const list = this.progression();
    if (list.length === 0) return null;
    return list[this.selectedProgressionIndex()] ?? null;
  });

  constructor() {
    effect(() => {
      this.progression();
      untracked(() => this.selectedProgressionIndex.set(0));
    });

    const dismissedAt = Number(localStorage.getItem(this.DRIFT_NUDGE_KEY));
    if (!dismissedAt || Date.now() - dismissedAt >= this.DRIFT_NUDGE_COOLDOWN_MS) {
      this.showDriftNudge.set(true);
    }
  }

  dismissDriftNudge(): void {
    localStorage.setItem(this.DRIFT_NUDGE_KEY, Date.now().toString());
    this.showDriftNudge.set(false);
  }

  readonly totalCoachingHours = computed(() =>
    this.progression().reduce((sum, r) => sum + r.totalHours, 0)
  );

  readonly counterpartSessions = computed(() => {
    const id = this.selectedCounterpartId();
    if (!id) return [] as CompletedSessionDto[];
    return this.completedSessions()
      .filter(s => s.counterpartUserId === id)
      .sort((a, b) => new Date(b.proposedDateTime).getTime() - new Date(a.proposedDateTime).getTime());
  });

  readonly counterpartTotalHours = computed(() =>
    this.counterpartSessions().reduce((sum, s) => sum + s.durationMinutes / 60, 0)
  );

  readonly selectedCounterpartName = computed(() => {
    const id = this.selectedCounterpartId();
    if (!id) return '';
    const rel = this.progression().find(r => r.counterpartUserId === id);
    return rel ? `${rel.counterpartFirstName} ${rel.counterpartLastName}` : '';
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  );

  readonly weekLabel = computed(() => {
    const offset = this.selectedWeekOffset();
    if (offset === 0) return 'This week';
    const monday = this.weekMonday(offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  });

  readonly weekDays = computed(() => {
    const monday = this.weekMonday(this.selectedWeekOffset());
    const today = new Date();
    return (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { label, num: d.getDate(), isToday: d.toDateString() === today.toDateString(), dayIndex: i };
    });
  });

  prevWeek(): void { this.selectedWeekOffset.update(v => v - 1); }
  nextWeek(): void { this.selectedWeekOffset.update(v => v + 1); }

  prevCoach(): void { this.selectedProgressionIndex.update(i => Math.max(0, i - 1)); }
  nextCoach(): void { this.selectedProgressionIndex.update(i => Math.min(this.progression().length - 1, i + 1)); }

  progressPercent(dto: CoachPlayerProgressionDto): number {
    return Math.min(100, Math.round(this.progressFraction(dto) * 100));
  }

  progressFraction(dto: CoachPlayerProgressionDto): number {
    const h = dto.totalHours;
    if (dto.currentLevel >= 3) return 1;
    if (dto.currentLevel === 2) return Math.min(1, (h - 175) / 125);
    if (dto.currentLevel === 1) return Math.min(1, (h - 100) / 75);
    return Math.min(1, h / 100);
  }

  tierName(level: number): string {
    if (level === 1) return 'Bronze';
    if (level === 2) return 'Silver';
    if (level >= 3) return 'Gold';
    return 'Prospect';
  }

  pillFillPercent(dto: CoachPlayerProgressionDto): number {
    const h = dto.totalHours;
    if (dto.currentLevel >= 3) return 100;
    if (dto.currentLevel === 2) return Math.min(100, (h - 175) / 125 * 100);
    if (dto.currentLevel === 1) return Math.min(100, (h - 100) / 75 * 100);
    return Math.min(100, h / 100 * 100);
  }

  pillTargetHours(dto: CoachPlayerProgressionDto): number {
    if (dto.currentLevel >= 2) return 300;
    if (dto.currentLevel === 1) return 175;
    return 100;
  }

  pillNextTierName(dto: CoachPlayerProgressionDto): string {
    if (dto.currentLevel >= 2) return 'Gold';
    if (dto.currentLevel === 1) return 'Silver';
    return 'Bronze';
  }

  ringOffset(dto: CoachPlayerProgressionDto): number {
    return this.CIRC_SM * (1 - this.progressFraction(dto));
  }

  progInitials(dto: CoachPlayerProgressionDto): string {
    return (dto.counterpartFirstName[0] ?? '') + (dto.counterpartLastName[0] ?? '');
  }

  recInitials(rec: RecommendedCoachDto | RecommendedPlayerDto): string {
    return (rec.firstName[0] ?? '') + (rec.lastName[0] ?? '');
  }

  recMeta(rec: RecommendedCoachDto | RecommendedPlayerDto): string {
    if ('hourlyRate' in rec) {
      const rate = `${rec.hourlyRate.toLocaleString('en-US')} EUR/h`;
      return rec.primarySpecialty
        ? `${rec.city} · ${rate} · ${rec.primarySpecialty}`
        : `${rec.city} · ${rate}`;
    }
    return `${rec.city} · Level ${rec.skillLevel}`;
  }

  /** Route to the existing profile (where the booking / "Request a session"
   *  flow already lives) — coaches → /coaches/:id, players → /players/:id. */
  recRoute(rec: RecommendedCoachDto | RecommendedPlayerDto): string[] {
    return 'hourlyRate' in rec ? ['/coaches', rec.userId] : ['/players', rec.userId];
  }

  /** select_item for a recommended coach. index is the 1-based rank shown in the UI. */
  trackRecClick(rec: RecommendedCoachDto | RecommendedPlayerDto): void {
    if (!('hourlyRate' in rec)) return;
    this.analytics.selectRecommendedItem(coachItem(rec, rec.rank), this.experiment.recVariant, rec.score);
  }

  /** Up to 4 reason bullets from the ML response (empty list if none). */
  recReasons(rec: RecommendedCoachDto | RecommendedPlayerDto): string[] {
    return (rec.reasons ?? []).slice(0, 4);
  }

  hoursToGo(dto: CoachPlayerProgressionDto): number {
    return Math.ceil(this.pillTargetHours(dto) - dto.totalHours);
  }

  nextTierDiscount(dto: CoachPlayerProgressionDto): number {
    if (dto.currentLevel === 0) return 10;
    if (dto.currentLevel === 1) return 20;
    return 30;
  }

  ladderFillWidth(dto: CoachPlayerProgressionDto): number {
    return Math.min(dto.totalHours / 300 * 92, 92);
  }

  ladderCurrentLeft(dto: CoachPlayerProgressionDto): number {
    if (dto.currentLevel >= 3) return 92;
    return Math.max(4, Math.min(dto.totalHours / 300 * 92, 88));
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

  private weekMonday(offset: number): Date {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() + 6) % 7 + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  formatDate(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  formatTime(dt: string): string {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatDayAbbr(dt: string): string {
    return new Date(dt).toLocaleDateString('en-GB', { weekday: 'short' });
  }

  formatPrice(mkd: number): string {
    return mkd.toLocaleString('en-US') + ' EUR';
  }
}
