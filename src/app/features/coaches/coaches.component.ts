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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, map, of, startWith } from 'rxjs';
import { NavComponent } from '../../shared/ui/nav/nav.component';
import { CoachCardComponent } from './coach-card/coach-card.component';
import { CoachesService } from './coaches.service';
import { ProgressionService } from '../progression/progression.service';
import { CoachProfileDto } from '../../core/models/discovery.models';
import { CoachingStyle, SkillLevelGroup } from '../../core/models/auth.models';
import { AnalyticsService } from '../../core/analytics/analytics.service';

// filter_level values sent with the search event. Same labels as coach levels.
const LEVEL_LABELS: Record<SkillLevelGroup, string> = {
  Group1To3: 'Beginner',
  Group4To6: 'Intermediate',
  Group7To8: 'Advanced',
  Group9To10: 'Elite',
};

const PAGE_SIZE = 50;

const CITIES = [
  'Skopje', 'Bitola', 'Kumanovo', 'Prilep',
  'Tetovo', 'Veles', 'Ohrid', 'Gostivar', 'Strumica', 'Shtip',
] as const;

@Component({
  selector: 'app-coaches',
  standalone: true,
  imports: [NavComponent, ReactiveFormsModule, CoachCardComponent],
  template: `
    <div class="page">
      <app-nav />
      <main class="content">

        <div class="page-header">
          <h1 class="title">Find a Coach</h1>
          <p class="subtitle">Browse certified coaches and find your perfect match.</p>
        </div>

        <form class="search" role="search" (submit)="submitSearch($event)">
          <input
            type="search"
            class="search-input"
            [formControl]="searchControl"
            placeholder="Search by name, city or specialty"
            aria-label="Search coaches"
            data-testid="coach-search-input" />
          <button type="submit" class="search-btn" data-testid="coach-search-submit">Search</button>
        </form>

        <div class="filters" [formGroup]="filterForm">
          <select formControlName="skillLevelGroup" class="filter-select" data-testid="filter-level">
            <option [ngValue]="null">All skill groups</option>
            <option [ngValue]="'Group1To3'">Beginner (1–3)</option>
            <option [ngValue]="'Group4To6'">Intermediate (4–6)</option>
            <option [ngValue]="'Group7To8'">Advanced (7–8)</option>
            <option [ngValue]="'Group9To10'">Elite (9–10)</option>
          </select>

          <select formControlName="acceptingNewPlayers" class="filter-select">
            <option [ngValue]="null">Any availability</option>
            <option [ngValue]="true">Accepting players</option>
            <option [ngValue]="false">Not accepting</option>
          </select>

          <select formControlName="trainingStyle" class="filter-select">
            <option [ngValue]="null">Any coaching style</option>
            <option [ngValue]="'Demanding'">Demanding</option>
            <option [ngValue]="'Balanced'">Balanced</option>
            <option [ngValue]="'Relaxed'">Relaxed</option>
          </select>

          <select formControlName="city" class="filter-select" data-testid="filter-city">
            <option [ngValue]="null">All cities</option>
            @for (c of cities; track c) {
              <option [ngValue]="c">{{ c }}</option>
            }
          </select>
        </div>

        @if (loading()) {
          <p class="state-msg">Loading coaches…</p>
        } @else if (coaches().length === 0) {
          <p class="state-msg">No coaches match your filters.</p>
        } @else {
          <div class="grid">
            @for (coach of coaches(); track coach.userId) {
              <app-coach-card [coach]="coach" [discountPercent]="progressionMap().get(coach.userId) ?? 0" />
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

    .search {
      display: flex;
      gap: var(--space-2);
      max-width: 560px;
    }

    .search-input {
      flex: 1;
      height: 40px;
      padding: 0 var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      outline: none;

      &:focus { border-color: var(--color-ink); }
    }

    .search-btn {
      height: 40px;
      padding: 0 var(--space-5);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--color-ink);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-sans);
      cursor: pointer;
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
export class CoachesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel', { static: true }) private sentinelRef!: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly coachesService = inject(CoachesService);
  private readonly progressionService = inject(ProgressionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly analytics = inject(AnalyticsService);

  readonly cities = CITIES;
  readonly filterForm = this.fb.group({
    skillLevelGroup: [null as SkillLevelGroup | null],
    acceptingNewPlayers: [null as boolean | null],
    trainingStyle: [null as CoachingStyle | null],
    city: [null as string | null],
  });

  readonly searchControl = this.fb.nonNullable.control('');

  readonly coaches = signal<CoachProfileDto[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);

  readonly progressionMap = toSignal(
    this.progressionService.getMyProgression().pipe(
      map(list => new Map(list.map(r => [r.counterpartUserId, r.discountPercent]))),
      catchError(() => of(new Map<string, number>())),
    ),
    { initialValue: new Map<string, number>() },
  );

  private page = 1;
  private generation = 0;
  private currentSkillLevelGroup: SkillLevelGroup | null = null;
  private currentAcceptingNewPlayers: boolean | null = null;
  private currentTrainingStyle: CoachingStyle | null = null;
  private currentCity: string | null = null;
  private currentQuery = '';

  private readonly scrollListener = (): void => this.maybeLoadMore();

  constructor() {
    this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.value),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(v => {
      this.currentSkillLevelGroup = v.skillLevelGroup ?? null;
      this.currentAcceptingNewPlayers = v.acceptingNewPlayers ?? null;
      this.currentTrainingStyle = v.trainingStyle ?? null;
      this.currentCity = v.city ?? null;
      this.resetAndLoad();
    });
  }

  /** Explicit search (Enter or the button). Filter changes alone do not send a search event. */
  submitSearch(event: Event): void {
    event.preventDefault();
    this.currentQuery = this.searchControl.value.trim();
    this.analytics.search({
      search_term: this.currentQuery,
      filter_level: this.currentSkillLevelGroup ? LEVEL_LABELS[this.currentSkillLevelGroup] : 'all',
      filter_city: this.currentCity ?? 'all',
    });
    this.resetAndLoad();
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
    this.coaches.set([]);
    this.hasMore.set(true);
    this.loading.set(true);
    this.fetchPage(gen);
  }

  private fetchPage(gen: number): void {
    this.coachesService.getCoaches({
      skillLevelGroup: this.currentSkillLevelGroup ?? undefined,
      acceptingNewPlayers: this.currentAcceptingNewPlayers ?? undefined,
      trainingStyle: this.currentTrainingStyle ?? undefined,
      city: this.currentCity ?? undefined,
      q: this.currentQuery || undefined,
      page: this.page,
      pageSize: PAGE_SIZE,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: results => {
        if (gen !== this.generation) return;
        if (this.page === 1) {
          this.coaches.set(results);
        } else {
          this.coaches.update(prev => [...prev, ...results]);
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
