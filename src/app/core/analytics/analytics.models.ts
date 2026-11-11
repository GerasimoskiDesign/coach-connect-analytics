// Typed shapes for everything pushed to window.dataLayer. Names follow GA4
// recommended events where one exists; the tracking plan (docs/tracking_plan.csv)
// is the source of truth and the Playwright suite checks pushes against it.

import { RecVariant } from '../models/recommendation.models';

export type Currency = 'EUR';
export type ConsentState = 'granted' | 'denied';
export type SessionTypeParam = 'coaching' | 'practice';
export type RoleParam = 'player' | 'coach';
export type PlayerLevel = 'amateur' | 'intermediate' | 'professional';
export type InteractionType = 'player_coach' | 'coach_player' | 'player_player';
export type SignUpMethod = 'email' | 'auto_login';
export type RequestResponse = 'accepted' | 'declined' | 'rescheduled';

/** The algorithm behind a recommendation list. Coach lists follow the A/B variant. */
export type RecAlgorithm = RecVariant | 'skill_match';
export type RecListId = 'rec_coaches' | 'rec_players';

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
  /** Item-scoped custom parameter: the recommendation algorithm that led to this item. */
  rec_algorithm?: RecAlgorithm;
}

/**
 * Account-level values, cleared on logout. They live under one `user` key so
 * they never collide with event-level parameters of the same name (an event can
 * carry the player_level of the other person in a session, for example).
 */
export interface UserKeys {
  user_id?: string;
  user_role?: RoleParam;
  /** YYYY-MM-DD */
  signup_date?: string;
  /** Players only. */
  player_level?: PlayerLevel;
}

/** Recommendation context of a booking. Empty strings when it did not come from a recommendation. */
export interface RecContextParams {
  rec_list_id: RecListId | '';
  rec_algorithm: RecAlgorithm | '';
  rec_index: number | '';
}

export interface PageViewSpa {
  event: 'page_view_spa';
  page_path: string;
  page_title: string;
  page_location: string;
}

export interface SignUpEvent {
  event: 'sign_up';
  method: SignUpMethod;
  user_role: RoleParam;
}

export interface LoginEvent {
  event: 'login';
  method: 'email';
  user_role: RoleParam;
}

export interface SearchEvent {
  event: 'search';
  search_term: string;
  filter_level: string;
  filter_city: string;
}

export interface EcommerceList {
  item_list_id: RecListId;
  item_list_name: string;
  items: GaItem[];
}

export interface ViewItemListEvent {
  event: 'view_item_list';
  ecommerce: EcommerceList;
  rec_algorithm: RecAlgorithm;
}

export interface SelectItemEvent {
  event: 'select_item';
  ecommerce: EcommerceList;
  rec_algorithm: RecAlgorithm;
  rec_score: number;
}

export interface ViewItemEvent {
  event: 'view_item';
  ecommerce: { currency: Currency; value: number; items: GaItem[] };
}

export interface BookSessionEvent extends RecContextParams {
  event: 'book_session';
  session_request_id: string;
  interaction_type: InteractionType;
  requester_role: RoleParam;
  receiver_id: string;
  receiver_role: RoleParam;
  /** The coach's user ID, or 'none' for a player-to-player session. */
  coach_id: string;
  session_type: SessionTypeParam;
  /** Level of the player in the session ('' if unknown). */
  player_level: PlayerLevel | '';
  duration_minutes: number;
  value: number;
  currency: Currency;
}

export interface SessionRequestRespondedEvent {
  event: 'session_request_responded';
  session_request_id: string;
  response: RequestResponse;
  responder_role: RoleParam;
  interaction_type: InteractionType;
}

export interface PurchaseEvent {
  event: 'purchase';
  ecommerce: { transaction_id: string; value: number; currency: Currency; items: GaItem[] };
  player_level: PlayerLevel | '';
}

export interface SetUserPropertiesEvent {
  event: 'set_user_properties';
  rec_variant: RecVariant;
  user: UserKeys;
}

export type TrackedEvent =
  | PageViewSpa
  | SignUpEvent
  | LoginEvent
  | SearchEvent
  | ViewItemListEvent
  | SelectItemEvent
  | ViewItemEvent
  | BookSessionEvent
  | SessionRequestRespondedEvent
  | PurchaseEvent
  | SetUserPropertiesEvent;

/** Anything the service may push: a tracked event, the ecommerce reset, or plain data keys. */
export type DataLayerEntry =
  | TrackedEvent
  | { ecommerce: null }
  | { rec_variant?: RecVariant; user?: UserKeys };

export const REC_LISTS: Record<RecListId, { item_list_id: RecListId; item_list_name: string }> = {
  rec_coaches: { item_list_id: 'rec_coaches', item_list_name: 'Recommended coaches' },
  rec_players: { item_list_id: 'rec_players', item_list_name: 'Recommended players' },
};
