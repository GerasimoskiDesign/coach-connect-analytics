import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { PillComponent } from '../../../shared/ui/pill/pill.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CoachProfileDto } from '../../../core/models/discovery.models';
import { Specialty } from '../../../core/models/auth.models';

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

@Component({
  selector: 'app-coach-card',
  standalone: true,
  imports: [CardComponent, AvatarComponent, PillComponent, ButtonComponent],
  template: `
    <app-card [hoverable]="true">
      <div class="inner">

        <div class="header">
          <app-avatar [initials]="initials" size="md" variant="warm" />
          <div class="header-text">
            <span class="name">{{ coach.firstName }} {{ coach.lastName }}</span>
            <span class="city">{{ coach.city }}</span>
          </div>
          <app-pill
            [label]="coach.acceptingNewPlayers ? 'Accepting' : 'Not accepting'"
            [variant]="coach.acceptingNewPlayers ? 'gold' : 'muted'" />
        </div>

        <div class="stats">
          <div class="stat">
            <span class="stat-value">{{ coach.hourlyRate.toLocaleString('en-US') }}</span>
            <span class="stat-label">EUR/hour</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-value">{{ coach.yearsCoaching }}</span>
            <span class="stat-label">yrs coaching</span>
          </div>
        </div>

        @if (coach.specialties.length > 0) {
          <div class="specialties">
            @for (s of visibleSpecialties; track s) {
              <app-pill [label]="specialtyLabel(s)" variant="muted" />
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

    .specialties {
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
export class CoachCardComponent {
  private readonly router = inject(Router);

  @Input({ required: true }) coach!: CoachProfileDto;
  @Input() discountPercent: number = 0;

  get initials(): string {
    return `${this.coach.firstName[0]}${this.coach.lastName[0]}`;
  }

  get visibleSpecialties(): Specialty[] {
    return this.coach.specialties.slice(0, 3);
  }

  get remainingCount(): number {
    return Math.max(0, this.coach.specialties.length - 3);
  }

  specialtyLabel(s: Specialty): string {
    return SPECIALTY_LABELS[s] ?? s;
  }

  viewProfile(): void {
    this.router.navigate(['/coaches', this.coach.userId]);
  }
}
