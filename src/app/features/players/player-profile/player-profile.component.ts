import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { NavComponent } from '../../../shared/ui/nav/nav.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { PillComponent } from '../../../shared/ui/pill/pill.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { PlayersService } from '../players.service';
import { AuthService } from '../../../core/services/auth.service';
import { BookingModalComponent } from '../../session-requests/booking-modal/booking-modal.component';
import { PlayerProfileDto } from '../../../core/models/discovery.models';
import { CoachingStyle, MainGoal, Surface, TrainingFrequencyPerDay } from '../../../core/models/auth.models';

const SKILL_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Never played tennis before.',
  2: 'Tried tennis, knows basic rules, can make contact.',
  3: 'Plays casually with no structured training.',
  4: 'Trains or has trained, rallies but lacks consistency.',
  5: 'Plays consistently with solid fundamentals.',
  6: 'Trains regularly, competes at club level.',
  7: 'Competes in national tournaments and leagues.',
  8: 'Top national or starting international level.',
  9: 'Near professional, very high competitive level.',
  10: 'Professional player earning from tennis.',
};

const MAIN_GOAL_LABELS: Record<MainGoal, string> = {
  ImproveTechnique: 'Improve Technique',
  ImproveFitness: 'Improve Fitness',
  PrepareForTournaments: 'Tournament Prep',
  FindHittingPartners: 'Hitting Partners',
  ReturnToTennis: 'Return to Tennis',
  TrainRecreationally: 'Recreational',
  BecomeProfessional: 'Go Pro',
  ImproveServe: 'Improve Serve',
  ImproveFootwork: 'Improve Footwork',
  ImproveConsistency: 'Improve Consistency',
  ImproveMatchPlay: 'Improve Match Play',
  ReduceInjuryRisk: 'Reduce Injury Risk',
  PlayCompetitivelyAgain: 'Play Competitively Again',
  LearnTennis: 'Learn Tennis',
  ImproveMentalGame: 'Improve Mental Game',
  FindSocialPlaying: 'Find Social Playing',
};

const SURFACE_LABELS: Record<Surface, string> = {
  Clay: 'Clay',
  HardCourt: 'Hard Court',
  Grass: 'Grass',
  NoPreference: 'No Preference',
};

const FREQUENCY_LABELS: Record<TrainingFrequencyPerDay, string> = {
  OncePerDay: 'Once per day',
  TwicePerDay: 'Twice per day',
  Flexible: 'Flexible',
};

const COACHING_STYLE_LABELS: Record<CoachingStyle, string> = {
  Demanding: 'Demanding',
  Balanced: 'Balanced',
  Relaxed: 'Relaxed',
};

@Component({
  selector: 'app-player-profile',
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
            <p class="state-msg">Player not found.</p>
            <a routerLink="/players" class="back-link">← Back to players</a>
          </div>

        } @else if (viewState().type === 'loaded') {
          @if (viewState().player; as p) {
          <a routerLink="/players" class="back-link">← Back to players</a>

          <div class="hero">
            <app-avatar [initials]="p.firstName[0] + p.lastName[0]" size="lg" variant="dark" />
            <div class="hero-info">
              <h1 class="name">{{ p.firstName }} {{ p.lastName }}</h1>
              <span class="city">{{ p.city }}</span>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">{{ p.skillLevel }}</span>
              <span class="stat-label">/10 skill</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ p.yearsPlaying }}</span>
              <span class="stat-label">yrs playing</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">{{ p.trainingDaysPerWeek }}</span>
              <span class="stat-label">days/week</span>
            </div>
          </div>

          <p class="skill-desc">{{ skillDesc(p.skillLevel) }}</p>

          <app-card>
            <div class="section">
              <h2 class="section-title">Playing Style</h2>
              <div class="fit-rows">
                <div class="fit-row">
                  <span class="fit-label">Preferred hand</span>
                  <app-pill [label]="p.preferredHand" variant="muted" />
                </div>
                <div class="fit-row">
                  <span class="fit-label">Backhand</span>
                  <app-pill [label]="backhandLabel(p)" variant="muted" />
                </div>
              </div>
            </div>
          </app-card>

          @if (p.mainGoals.length > 0) {
            <app-card>
              <div class="section">
                <h2 class="section-title">Goals</h2>
                <div class="chips">
                  @for (g of p.mainGoals; track g) {
                    <app-pill [label]="goalLabel(g)" variant="muted" />
                  }
                </div>
              </div>
            </app-card>
          }

          <app-card>
            <div class="section">
              <h2 class="section-title">Training Preferences</h2>
              <div class="fit-rows">
                <div class="fit-row">
                  <span class="fit-label">Surface</span>
                  <app-pill [label]="surfaceLabel(p.preferredSurface)" variant="muted" />
                </div>
                <div class="fit-row">
                  <span class="fit-label">Frequency</span>
                  <app-pill [label]="frequencyLabel(p.trainingFrequencyPerDay)" variant="muted" />
                </div>
                <div class="fit-row">
                  <span class="fit-label">Session length</span>
                  <app-pill [label]="p.preferredSessionDurationMinutes + ' min'" variant="muted" />
                </div>
                <div class="fit-row">
                  <span class="fit-label">Coaching style</span>
                  <app-pill [label]="coachingStyleLabel(p.preferredCoachingStyle)" variant="muted" />
                </div>
              </div>
            </div>
          </app-card>

          @if (!p.favoritePlayerNone || !p.wantsToPlayLikeNone) {
            <app-card>
              <div class="section">
                <h2 class="section-title">Inspirations</h2>
                <div class="fit-rows">
                  @if (!p.favoritePlayerNone && p.favoritePlayer) {
                    <div class="fit-row">
                      <span class="fit-label">Favourite player</span>
                      <span class="fit-value">{{ p.favoritePlayer }}</span>
                    </div>
                  }
                  @if (!p.wantsToPlayLikeNone && p.wantsToPlayLike) {
                    <div class="fit-row">
                      <span class="fit-label">Wants to play like</span>
                      <span class="fit-value">{{ p.wantsToPlayLike }}</span>
                    </div>
                  }
                </div>
              </div>
            </app-card>
          }

          @if (p.bio) {
            <app-card>
              <div class="section">
                <h2 class="section-title">About</h2>
                <p class="text-body">{{ p.bio }}</p>
              </div>
            </app-card>
          }

          @if (showBookingButton(p)) {
            <div class="cta">
              <app-button label="Request a session" variant="dark" data-testid="request-session" (click)="bookingOpen = true" />
            </div>
            <app-booking-modal
              [visible]="bookingOpen"
              [receiverId]="p.userId"
              [receiverName]="p.firstName + ' ' + p.lastName"
              receiverRole="Player"
              [receiverSkillLevel]="p.skillLevel"
              (closed)="bookingOpen = false"
              (submitted)="bookingOpen = false" />
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

    .skill-desc {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: calc(var(--space-5) * -1) 0 0;
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
      min-width: 130px;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .fit-value {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      padding-top: 2px;
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
  `],
})
export class PlayerProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly playersService = inject(PlayersService);
  private readonly authService = inject(AuthService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly viewState = toSignal(
    this.playersService.getPlayerById(this.id).pipe(
      map(player => ({ type: 'loaded' as const, player })),
      catchError(() => of({ type: 'error' as const, player: null as PlayerProfileDto | null })),
      startWith({ type: 'loading' as const, player: null as PlayerProfileDto | null })
    ),
    { requireSync: true }
  );

  readonly currentUser = toSignal(this.authService.currentUser$);

  bookingOpen = false;

  showBookingButton(p: PlayerProfileDto): boolean {
    const u = this.currentUser();
    if (!u) return false;
    if (u.role === 'Coach') return true;
    if (u.role === 'Player') return u.userId !== p.userId;
    return false;
  }

  skillDesc(level: number): string { return SKILL_LEVEL_DESCRIPTIONS[level] ?? ''; }
  goalLabel(g: MainGoal): string { return MAIN_GOAL_LABELS[g] ?? g; }
  surfaceLabel(s: Surface): string { return SURFACE_LABELS[s] ?? s; }
  frequencyLabel(f: TrainingFrequencyPerDay): string { return FREQUENCY_LABELS[f] ?? f; }
  coachingStyleLabel(s: CoachingStyle): string { return COACHING_STYLE_LABELS[s] ?? s; }

  backhandLabel(p: PlayerProfileDto): string {
    return p.backhandType === 'OneHanded' ? 'One-Handed' : 'Two-Handed';
  }
}
