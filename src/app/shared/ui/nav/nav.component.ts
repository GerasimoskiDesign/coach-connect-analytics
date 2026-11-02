import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonComponent],
  template: `
    <nav class="nav">
      <a class="brand" routerLink="/dashboard">
        <span class="mark"></span>
        <span class="wordmark">Coach Connect+</span>
      </a>
      <div class="links">
        <a routerLink="/dashboard" routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: true }" class="link">Dashboard</a>
        <a routerLink="/profile" routerLinkActive="active" class="link">Profile</a>
        @if (currentUser()?.role !== 'Coach') {
          <a routerLink="/coaches" routerLinkActive="active" class="link">Coaches</a>
        }
        <a routerLink="/players" routerLinkActive="active" class="link">Players</a>
        <a routerLink="/requests" routerLinkActive="active" class="link">
          <span class="link-text">
            Requests
            @if (pendingCount() > 0) {
              <span class="nav-badge">{{ pendingCount() > 9 ? '9+' : pendingCount() }}</span>
            }
          </span>
        </a>
      </div>
      <div class="right">
        <app-button label="Log out" variant="ghost" (click)="logout()" />
      </div>
    </nav>
  `,
  styles: [`
    :host { display: block; }

    .nav {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      padding: 0 var(--space-6);
      height: 64px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      flex-shrink: 0;
      cursor: pointer;
      transition: opacity var(--transition-fast);

      &:hover {
        opacity: 0.75;
      }
    }

    .mark {
      width: 28px;
      height: 28px;
      background: var(--color-ink);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &::after {
        content: '';
        width: 8px;
        height: 8px;
        background: #fff;
        border-radius: 50%;
      }
    }

    .wordmark {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.01em;
    }

    .links {
      display: flex;
      align-items: stretch;
      gap: var(--space-1);
      flex: 1;
    }

    .link {
      display: flex;
      align-items: center;
      padding: 0 var(--space-3);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      text-decoration: none;
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
          bottom: 0;
          left: var(--space-3);
          right: var(--space-3);
          height: 2px;
          background: var(--color-gold);
          border-radius: 1px;
        }
      }
    }

    .link-text {
      position: relative;
      display: inline-block;
    }

    .nav-badge {
      position: absolute;
      top: -6px;
      right: -14px;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      background: #e53935;
      color: #fff;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    .right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
      flex-shrink: 0;
    }

    app-button {
      width: fit-content;
    }
  `],
})
export class NavComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);

  readonly currentUser = toSignal(this.authService.currentUser$);
  readonly pendingCount = this.notificationsService.pendingCount;

  logout(): void {
    this.authService.logout();
  }
}
