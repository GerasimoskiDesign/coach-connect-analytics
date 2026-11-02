import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { readStorage, writeStorage } from '../storage/safe-storage';
import { ExperimentService } from './experiment.service';
import {
  BookSessionEvent,
  ConsentState,
  DataLayerEntry,
  GaItem,
  RECOMMENDED_LIST,
  SearchEvent,
  TrackedEvent,
} from './analytics.models';
import { RecVariant } from '../models/recommendation.models';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const USER_PROPS_SENT_KEY = 'cc_user_props_sent';
const PURCHASES_SENT_KEY = 'cc_purchases_sent';

/**
 * The only code in the app that writes to window.dataLayer. Components call
 * typed methods; this service shapes the payload, clears the previous
 * ecommerce object before every ecommerce event and pushes. Google Tag Manager
 * picks the events up from there (see gtm/container.json).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly experiment = inject(ExperimentService);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;

  /** Called once at bootstrap (app.config.ts). */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.publishRecVariant(this.experiment.recVariant);

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.pageView());
  }

  // ── Consent ──────────────────────────────────────────────────────────────

  /** Consent Mode v2 update for all four signals. The default (all denied) is set in index.html. */
  updateConsent(state: ConsentState): void {
    this.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }

  // ── Events ───────────────────────────────────────────────────────────────

  signUp(): void {
    this.push({ event: 'sign_up', method: 'email' });
  }

  login(): void {
    this.push({ event: 'login', method: 'email' });
  }

  search(params: Omit<SearchEvent, 'event'>): void {
    this.push({ event: 'search', ...params });
  }

  viewRecommendedList(items: GaItem[]): void {
    this.pushEcommerce({ event: 'view_item_list', ecommerce: { ...RECOMMENDED_LIST, items } });
  }

  selectRecommendedItem(item: GaItem, algorithm: RecVariant, score: number): void {
    this.pushEcommerce({
      event: 'select_item',
      ecommerce: {
        ...RECOMMENDED_LIST,
        items: [{ item_id: item.item_id, item_name: item.item_name, index: item.index }],
      },
      rec_algorithm: algorithm,
      rec_score: score,
    });
  }

  viewItem(item: GaItem): void {
    this.pushEcommerce({
      event: 'view_item',
      ecommerce: { currency: 'EUR', value: item.price ?? 0, items: [item] },
    });
  }

  /** Key event: a session request was sent. */
  bookSession(params: Omit<BookSessionEvent, 'event' | 'currency'>): void {
    this.push({ event: 'book_session', ...params, currency: 'EUR' });
  }

  /**
   * Key event: a paid booking was confirmed. Deduplicated per transaction so a
   * reload of the confirmation screen cannot report the same revenue twice.
   */
  purchase(transactionId: string, value: number, items: GaItem[]): void {
    const sent = (readStorage(PURCHASES_SENT_KEY, 'session') ?? '').split(',');
    if (sent.includes(transactionId)) return;
    this.pushEcommerce({
      event: 'purchase',
      ecommerce: { transaction_id: transactionId, value, currency: 'EUR', items },
    });
    writeStorage(PURCHASES_SENT_KEY, [...sent.filter(Boolean), transactionId].join(','), 'session');
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * The A/B variant goes out as a set_user_properties event once per browser
   * session. On later page loads in the same session it is pushed as a plain
   * key so the GTM variable still resolves for every event on that page.
   */
  private publishRecVariant(variant: RecVariant): void {
    if (readStorage(USER_PROPS_SENT_KEY, 'session') === variant) {
      this.push({ rec_variant: variant });
      return;
    }
    this.push({ event: 'set_user_properties', rec_variant: variant });
    writeStorage(USER_PROPS_SENT_KEY, variant, 'session');
  }

  private pageView(): void {
    this.push({
      event: 'page_view_spa',
      page_path: window.location.pathname + window.location.search,
      page_title: this.routeTitle() ?? document.title,
      page_location: window.location.href,
    });
  }

  // The router emits NavigationEnd before it updates document.title, so read
  // the title from the activated route instead of from the document.
  private routeTitle(): string | undefined {
    let snap: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title: string | undefined;
    while (snap) {
      if (typeof snap.title === 'string') title = snap.title;
      snap = snap.firstChild;
    }
    return title;
  }

  private pushEcommerce(event: TrackedEvent & { ecommerce: object }): void {
    // GTM merges pushes into one data model; without this reset, items from
    // the previous ecommerce event would leak into this one.
    this.push({ ecommerce: null });
    this.push(event);
  }

  private push(entry: DataLayerEntry): void {
    (window.dataLayer = window.dataLayer ?? []).push(entry);
  }

  private gtag(...args: unknown[]): void {
    if (typeof window.gtag === 'function') {
      window.gtag(...args);
      return;
    }
    // Same shape as the stub in index.html: gtag commands are pushed as an
    // Arguments object, which is what GTM looks for.
    (function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer = window.dataLayer ?? []).push(arguments);
    }).apply(null, args as []);
  }
}
