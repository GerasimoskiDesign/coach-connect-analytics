export interface TrackingPlanEntry {
  event: string;
  type: string;
  trigger: string;
  parameters: string[];
  optionalParameters: string[];
  keyEvent: boolean;
  question: string;
}
export const ROOT: string;
export function parseCsv(text: string): Record<string, string>[];
export function loadTrackingPlan(): TrackingPlanEntry[];
export function isEcommerce(e: TrackingPlanEntry): boolean;
export function allParameters(e: TrackingPlanEntry): string[];
export const PERSISTENT_KEYS: string[];
export function eventLevelKeys(e: TrackingPlanEntry): string[];
