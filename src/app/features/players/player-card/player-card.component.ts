import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { PillComponent } from '../../../shared/ui/pill/pill.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { PlayerProfileDto } from '../../../core/models/discovery.models';
import { MainGoal } from '../../../core/models/auth.models';

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

@Component({
  selector: 'app-player-card',
  standalone: true,
  imports: [CardComponent, AvatarComponent, PillComponent, ButtonComponent],
  template: `
    <app-card [hoverable]="true">
      <div class="inner">

        <div class="header">
          <app-avatar [initials]="initials" size="md" variant="dark" />
          <div class="header-text">
            <span class="name">{{ player.firstName }} {{ player.lastName }}</span>
            <span class="city">{{ player.city }}</span>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="stat-value">{{ player.skillLevel }}</span>
            <span class="stat-label">skill level</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-value">{{ player.yearsPlaying }}</span>
            <span class="stat-label">yrs playing</span>
          </div>
        </div>

        @if (player.mainGoals.length > 0) {
          <div class="goals">
            @for (g of visibleGoals; track g) {
              <app-pill [label]="goalLabel(g)" variant="muted" />
            }
            @if (remainingCount > 0) {
              <app-pill [label]="'+' + remainingCount" variant="muted" />
            }
          </div>
        }

        <div class="card-actions">
          <app-button label="View Profile" variant="ghost" (click)="viewProfile()" />
        </div>

      </div>
    </app-card>
  `,
  styles: [`
    :host { display: block; }

    .inner {
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .header {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }

    .header-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .name {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .city {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .stats {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .stat {
      display: flex;
      align-items: baseline;
      gap: 3px;
    }

    .stat-value {
      font-size: var(--text-lg);
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
      height: 20px;
      background: var(--color-line);
    }

    .goals {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .card-actions {
      display: flex;
      gap: var(--space-2);

      app-button { flex: 1; }
    }
  `],
})
export class PlayerCardComponent {
  private readonly router = inject(Router);

  @Input({ required: true }) player!: PlayerProfileDto;

  get initials(): string {
    return `${this.player.firstName[0]}${this.player.lastName[0]}`;
  }

  get visibleGoals(): MainGoal[] {
    return this.player.mainGoals.slice(0, 2);
  }

  get remainingCount(): number {
    return Math.max(0, this.player.mainGoals.length - 2);
  }

  goalLabel(g: MainGoal): string {
    return MAIN_GOAL_LABELS[g] ?? g;
  }

  viewProfile(): void {
    this.router.navigate(['/players', this.player.userId]);
  }
}
