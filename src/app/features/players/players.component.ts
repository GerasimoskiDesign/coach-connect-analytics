import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { NavComponent } from '../../shared/ui/nav/nav.component';
import { PlayerCardComponent } from './player-card/player-card.component';
import { PlayersService } from './players.service';
import { PlayerProfileDto } from '../../core/models/discovery.models';
import { AuthService } from '../../core/services/auth.service';

const PAGE_SIZE = 50;

const SKILL_RANGE_MAP: Record<string, { min: number; max: number }> = {
  Group1To3:  { min: 1, max: 3 },
  Group4To6:  { min: 4, max: 6 },
  Group7To8:  { min: 7, max: 8 },
  Group9To10: { min: 9, max: 10 },
};

const CITIES = [
  'Skopje', 'Bitola', 'Kumanovo', 'Prilep',
  'Tetovo', 'Veles', 'Ohrid', 'Gostivar', 'Strumica', 'Shtip',
] as const;

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [NavComponent, ReactiveFormsModule, PlayerCardComponent],
  template: `
    <div class="page">
      <app-nav />
      <main class="content">

        <div class="page-header">
          <h1 class="title">Find a Player</h1>
          <p class="subtitle">Browse players looking for coaching or practice partners.</p>
        </div>

        <div class="filters" [formGroup]="filterForm">
          <select formControlName="skillRange" class="filter-select">
            <option [ngValue]="null">All skill levels</option>
            <option [ngValue]="'Group1To3'">Beginner (1–3)</option>
            <option [ngValue]="'Group4To6'">Intermediate (4–6)</option>
            <option [ngValue]="'Group7To8'">Advanced (7–8)</option>
            <option [ngValue]="'Group9To10'">Elite (9–10)</option>
          </select>

          <select formControlName="city" class="filter-select">
            <option [ngValue]="null">All cities</option>
            @for (c of cities; track c) {
              <option [ngValue]="c">{{ c }}</option>
            }
          </select>
        </div>

        @if (loading()) {
          <p class="state-msg">Loading players…</p>
        } @else if (players().length === 0) {
          <p class="state-msg">No players match your filters.</p>
        } @else {
          <div class="grid">
            @for (player of players(); track player.userId) {
              <app-player-card [player]="player" />
            }
          </div>
        }

        <div #sentinel class="sentinel"></div>

        @if (loadingMore()) {
          <p class="state-msg state-more">Loading more…</p>
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
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .title {
      font-size: var(--text-3xl);
      font-weight: var(--font-semibold);
      color: var(--color-ink);
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
    }

    .filters {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .filter-select {
      height: 36px;
      padding: 0 var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: var(--color-ink);
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-4);
    }

    .state-msg {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      padding: var(--space-8) 0;
      text-align: center;
    }

    .sentinel {
      height: 1px;
    }

    .state-more {
      padding: var(--space-4) 0;
      font-size: var(--text-sm);
    }
  `],
})
export class PlayersComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel', { static: true }) private sentinelRef!: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly playersService = inject(PlayersService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cities = CITIES;
  readonly filterForm = this.fb.group({
    skillRange: [null as string | null],
    city: [null as string | null],
  });

  readonly players = signal<PlayerProfileDto[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);

  private page = 1;
  private generation = 0;
  private currentSkillRange: string | null = null;
  private currentCity: string | null = null;

  private readonly scrollListener = (): void => this.maybeLoadMore();

  constructor() {
    this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.value),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(v => {
      this.currentSkillRange = v.skillRange ?? null;
      this.currentCity = v.city ?? null;
      this.resetAndLoad();
    });
  }

  ngAfterViewInit(): void {
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollListener);
  }

  private maybeLoadMore(): void {
    if (!this.hasMore() || this.loading() || this.loadingMore()) return;
    const sentinel = this.sentinelRef?.nativeElement;
    if (!sentinel) return;
    if (sentinel.getBoundingClientRect().top <= window.innerHeight + 300) {
      this.page++;
      this.loadingMore.set(true);
      this.fetchPage(this.generation);
    }
  }

  private resetAndLoad(): void {
    const gen = ++this.generation;
    this.page = 1;
    this.players.set([]);
    this.hasMore.set(true);
    this.loading.set(true);
    this.fetchPage(gen);
  }

  private fetchPage(gen: number): void {
    const range = this.currentSkillRange ? SKILL_RANGE_MAP[this.currentSkillRange] : undefined;
    const me = this.authService.currentUser$.value;

    this.playersService.getPlayers({
      minSkillLevel: range?.min,
      maxSkillLevel: range?.max,
      city: this.currentCity ?? undefined,
      page: this.page,
      pageSize: PAGE_SIZE,
      excludeUserId: me?.role === 'Player' ? me.userId : undefined,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: results => {
        if (gen !== this.generation) return;
        if (this.page === 1) {
          this.players.set(results);
        } else {
          this.players.update(prev => [...prev, ...results]);
        }
        if (results.length < PAGE_SIZE) this.hasMore.set(false);
        this.loading.set(false);
        this.loadingMore.set(false);
        setTimeout(() => this.maybeLoadMore());
      },
      error: () => {
        if (gen !== this.generation) return;
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }
}
