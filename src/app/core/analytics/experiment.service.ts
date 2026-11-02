import { Injectable } from '@angular/core';
import { RecVariant } from '../models/recommendation.models';
import { readStorage, writeStorage } from '../storage/safe-storage';

export const REC_VARIANT_KEY = 'cc_rec_variant';
const VARIANTS: readonly RecVariant[] = ['content_based', 'popularity'];

/**
 * Recommendation A/B test. On a visitor's first visit we assign one of two
 * ranking algorithms (50/50) and persist it, so the same visitor always sees
 * the same ranking and GA4 can compare the variants as a user-scoped dimension.
 *
 * A `?rec_variant=` query parameter forces a variant. It exists for QA and for
 * demoing both arms; it is persisted like a normal assignment.
 */
@Injectable({ providedIn: 'root' })
export class ExperimentService {
  readonly recVariant: RecVariant = this.resolve();

  private resolve(): RecVariant {
    const forced = new URLSearchParams(window.location.search).get('rec_variant');
    if (isVariant(forced)) {
      writeStorage(REC_VARIANT_KEY, forced);
      return forced;
    }
    const stored = readStorage(REC_VARIANT_KEY);
    if (isVariant(stored)) return stored;

    const assigned: RecVariant = Math.random() < 0.5 ? 'content_based' : 'popularity';
    writeStorage(REC_VARIANT_KEY, assigned);
    return assigned;
  }
}

function isVariant(v: string | null): v is RecVariant {
  return v !== null && (VARIANTS as readonly string[]).includes(v);
}
