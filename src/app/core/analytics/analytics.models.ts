// Typed shapes for everything pushed to window.dataLayer. Names follow GA4
// recommended events where one exists; the tracking plan (docs/tracking_plan.csv)
// is the source of truth and the Playwright suite checks pushes against it.

import { RecVariant } from '../models/recommendation.models';

export type Currency = 'EUR';
export type ConsentState = 'granted' | 'denied';
export type SessionTypeParam = 'coaching' | 'practice';

/** GA4 ecommerce item. */
export interface GaItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
  price?: number;
  quantity?: number;
}

export interface PageViewSpa {
  event: 'page_view_spa';
  page_path: string;
  page_title: string;
  page_location: string;
}

export interface AuthEvent {
  event: 'sign_up' | 'login';
  method: 'email';
}

export interface SearchEvent {
  event: 'search';
  search_term: string;
  filter_level: string;
  filter_city: string;
}

export interface ViewItemListEvent {
  event: 'view_item_list';
  ecommerce: { item_list_id: string; item_list_name: string; items: GaItem[] };
}

export interface SelectItemEvent {
  event: 'select_item';
  ecommerce: { item_list_id: string; item_list_name: string; items: GaItem[] };
  rec_algorithm: RecVariant;
  rec_score: number;
}

export interface ViewItemEvent {
  event: 'view_item';
  ecommerce: { currency: Currency; value: number; items: GaItem[] };
}

export interface BookSessionEvent {
  event: 'book_session';
  coach_id: string;
  session_type: SessionTypeParam;
  value: number;
  currency: Currency;
}

export interface PurchaseEvent {
  event: 'purchase';
  ecommerce: { transaction_id: string; value: number; currency: Currency; items: GaItem[] };
}

export interface SetUserPropertiesEvent {
  event: 'set_user_properties';
  rec_variant: RecVariant;
}

export type TrackedEvent =
  | PageViewSpa
  | AuthEvent
  | SearchEvent
  | ViewItemListEvent
  | SelectItemEvent
  | ViewItemEvent
  | BookSessionEvent
  | PurchaseEvent
  | SetUserPropertiesEvent;

/** Anything the service may push: a tracked event, the ecommerce reset, or a plain data key. */
export type DataLayerEntry = TrackedEvent | { ecommerce: null } | { rec_variant: RecVariant };

export const RECOMMENDED_LIST = {
  item_list_id: 'recommended_coaches',
  item_list_name: 'Recommended coaches',
} as const;
