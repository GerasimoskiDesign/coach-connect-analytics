export interface TrackingPlanEntry {
  event: string;
  type: string;
  trigger: string;
  parameters: string[];
  keyEvent: boolean;
  question: string;
}
export const ROOT: string;
export function parseCsv(text: string): Record<string, string>[];
export function loadTrackingPlan(): TrackingPlanEntry[];
export function isEcommerce(e: TrackingPlanEntry): boolean;
