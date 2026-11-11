import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, tap } from 'rxjs';
import { NavComponent } from '../../../shared/ui/nav/nav.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { PillComponent } from '../../../shared/ui/pill/pill.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CoachesService } from '../coaches.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProgressionService } from '../../progression/progression.service';
import { BookingModalComponent } from '../../session-requests/booking-modal/booking-modal.component';
import { CoachProfileDto } from '../../../core/models/discovery.models';
import { SessionRequestDto } from '../../../core/models/session-request.models';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { coachItem } from '../../../core/analytics/analytics-items';
import { AgeGroup, SkillLevelGroup, Specialty, Surface } from '../../../core/models/auth.models';

const SPECIALTY_LABELS: Record<Specialty, string> = {
  Technique: 'Technique',
  Serve: 'Serve',
  Forehand: 'Forehand',
  Backhand: 'Backhand',
  Footwork: 'Footwork',
  Fitness: 'Fitness',
  MatchStrategy: 'Match Strategy',
  TournamentPreparation: 'Tournament Prep',
  JuniorDevelopment: 'Junior Dev',
  BeginnerCoaching: 'Beginner',
};

const SURFACE_LABELS: Record<Surface, string> = {
  Clay: 'Clay',
  HardCourt: 'Hard Court',
  Grass: 'Grass',
  NoPreference: 'No Preference',
};

const SKILL_GROUP_LABELS: Record<SkillLevelGroup, string> = {
  Group1To3: 'Beginner (1–3)',
  Group4To6: 'Intermediate (4–6)',
  Group7To8: 'Advanced (7–8)',
  Group9To10: 'Elite (9–10)',
};

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  Children6To12: 'Children (6–12)',
  Juniors13To18: 'Juniors (13–18)',
  Adults18Plus: 'Adults (18+)',
  Seniors35Plus: 'Seniors (35+)',
};

@Component({
  selector: 'app-coach-profile',
  standalone: true,
  imports: [NavComponent, CardComponent, AvatarComponent, PillComponent, ButtonComponent, RouterLink, BookingModalComponent],
  template: `
    <div class="page">
      <app-nav />
      <main class="content">

        @if (viewState().type === 'loading') {
          <p class="state-msg">Loading…</p>

        } @else if (viewState().type === 'error') {
          <div class="state-block">
            <p class="state-msg">Coach not found.</p>
            <a routerLink="/coaches" class="back-link">← Back to coaches</a>
          </div>

        } @else if (viewState().type === 'loaded') {
          @if (viewState().coach; as c) {
          <a routerLink="/coaches" class="back-link">← Back to coaches</a>

          <div class="hero">
            <app-avatar [initials]="c.firstName[0] + c.lastName[0]" size="lg" variant="warm" />
            <div class="hero-info">
              <h1 class="name">{{ c.firstName }} {{ c.lastName }}</h1>
              <span class="city">{{ c.city }}</span>
              <app-pill
                [label]="c.acceptingNewPlayers ? 'Accepting players' : 'Not accepting'"
                [variant]="c.acceptingNewPlayers ? 'gold' : 'muted'" />
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">{{ c.hourlyRate.toLocaleString('en-US') }}</span>
              <span class="stat-label">EUR/hour</span>
            </div>
            @if (c.rating) {
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ c.rating.toFixed(1) }}</span>
                <span class="stat-label">{{ c.reviewCount }} reviews</span>
              </div>
            }
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ c.yearsCoaching }}</span>
              <span class="stat-label">yrs coaching</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ c.trainingStyle }}</span>
              <span class="stat-label">style</span>
            </div>
          </div>

          <app-card>
            <div class="section">
              <h2 class="section-title">Specialties</h2>
              <div class="chips">
                @for (s of c.specialties; track s) {
                  <app-pill [label]="specialtyLabel(s)" variant="muted" />
                }
              </div>
            </div>
          </app-card>

          <app-card>
            <div class="section">
              <h2 class="section-title">Player Fit</h2>
              <div class="fit-rows">
                <div class="fit-row">
                  <span class="fit-label">Surfaces</span>
                  <div class="chips">
                    @for (s of c.preferredSurfaces; track s) {
                      <app-pill [label]="surfaceLabel(s)" variant="muted" />
                    }
                  </div>
                </div>
                <div class="fit-row">
                  <span class="fit-label">Skill levels</span>
                  <div class="chips">
                    @for (g of c.skillLevelGroups; track g) {
                      <app-pill [label]="skillGroupLabel(g)" variant="muted" />
                    }
                  </div>
                </div>
                <div class="fit-row">
                  <span class="fit-label">Age groups</span>
                  <div class="chips">
                    @for (a of c.ageGroups; track a) {
                      <app-pill [label]="ageGroupLabel(a)" variant="muted" />
                    }
                  </div>
                </div>
              </div>
            </div>
          </app-card>

          <app-card>
            <div class="section">
              <h2 class="section-title">Background</h2>
              <div class="text-block">
                <span class="text-label">Diplomas &amp; Certifications</span>
                <p class="text-body">{{ c.diplomas }}</p>
              </div>
              <div class="text-block">
                <span class="text-label">Coaching History</span>
                <p class="text-body">{{ c.coachingHistory }}</p>
              </div>
            </div>
          </app-card>

          @if (c.bio) {
            <app-card>
              <div class="section">
                <h2 class="section-title">About</h2>
                <p class="text-body">{{ c.bio }}</p>
              </div>
            </app-card>
          }

          @if (currentUser()?.role === 'Player') {
            @if (c.acceptingNewPlayers) {
              <div class="cta">
                <app-button label="Request a session" variant="dark" data-testid="request-session" (click)="bookingOpen = true" />
              </div>
              <app-booking-modal
                [visible]="bookingOpen"
                [receiverId]="c.userId"
                [receiverName]="c.firstName + ' ' + c.lastName"
                receiverRole="Coach"
                [hourlyRate]="c.hourlyRate"
                [discountPercent]="discountPercent()"
                (closed)="bookingOpen = false"
                (submitted)="onBooked($event)" />
            } @else {
              <div class="cta">
                <p class="not-accepting">This coach is not accepting new players right now.</p>
              </div>
            }
          }

          }
        }
      </main>
    </div>
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
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .back-link {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      width: fit-content;
      transition: color var(--transition-fast);

      &:hover {
        color: var(--color-ink);
      }
    }

    .state-msg {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      text-align: center;
      padding: var(--space-8) 0;
    }

    .state-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8) 0;
    }

    .hero {
      display: flex;
      align-items: flex-start;
      gap: var(--space-5);
    }

    .hero-info {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-top: var(--space-2);
    }

    .name {
      font-size: var(--text-3xl);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.02em;
    }

    .city {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
    }

    .stat-item {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .stat-value {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.02em;
    }

    .stat-label {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .stat-divider {
      width: 1px;
      height: 24px;
      background: var(--color-line);
    }

    .section {
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .section-title {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .fit-rows {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .fit-row {
      display: flex;
      align-items: flex-start;
      gap: var(--space-4);
    }

    .fit-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      min-width: 90px;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .text-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .text-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
    }

    .text-body {
      font-size: var(--text-base);
      color: var(--color-text-primary);
      line-height: 1.65;
    }

    .cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-6) 0;

      app-button {
        max-width: 320px;
        width: 100%;
      }
    }

    .not-accepting {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
    }
  `],
})
export class CoachProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly coachesService = inject(CoachesService);
  private readonly authService = inject(AuthService);
  private readonly progressionService = inject(ProgressionService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly viewState = toSignal(
    this.coachesService.getCoachById(this.id).pipe(
      tap(coach => this.analytics.viewItem(coachItem(coach))),
      map(coach => ({ type: 'loaded' as const, coach })),
      catchError(() => of({ type: 'error' as const, coach: null as CoachProfileDto | null })),
      startWith({ type: 'loading' as const, coach: null as CoachProfileDto | null })
    ),
    { requireSync: true }
  );

  readonly currentUser = toSignal(this.authService.currentUser$);

  readonly discountPercent = toSignal(
    this.progressionService.getMyProgression().pipe(
      map(list => list.find(r => r.counterpartUserId === this.id)?.discountPercent ?? 0),
      catchError(() => of(0))
    ),
    { initialValue: 0 }
  );

  bookingOpen = false;

  /** Paid coaching sessions continue to checkout; free ones are done once sent. */
  onBooked(request: SessionRequestDto): void {
    this.bookingOpen = false;
    if (request.estimatedPriceMkd) {
      this.router.navigate(['/checkout', request.id]);
    }
  }

  specialtyLabel(s: Specialty): string { return SPECIALTY_LABELS[s] ?? s; }
  surfaceLabel(s: Surface): string { return SURFACE_LABELS[s] ?? s; }
  skillGroupLabel(g: SkillLevelGroup): string { return SKILL_GROUP_LABELS[g] ?? g; }
  ageGroupLabel(a: AgeGroup): string { return AGE_GROUP_LABELS[a] ?? a; }
}
