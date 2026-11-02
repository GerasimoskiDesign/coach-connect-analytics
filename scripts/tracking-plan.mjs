// Reads docs/tracking_plan.csv. Shared by the GTM container generator, the
// container test and the Playwright suite, so all three use one definition.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export function loadTrackingPlan() {
  const rows = parseCsv(readFileSync(join(ROOT, 'docs', 'tracking_plan.csv'), 'utf8'));
  return rows.map(r => ({
    event: r.event_name,
    type: r.type,
    trigger: r.trigger,
    parameters: r.parameters.split(';').map(p => p.trim()).filter(Boolean),
    keyEvent: r.key_event === 'yes',
    question: r.business_question,
  }));
}

/** Events whose payload carries an `ecommerce` object. */
export const isEcommerce = (e) => e.parameters.some(p => p.startsWith('ecommerce.'));
