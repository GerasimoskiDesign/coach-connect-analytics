// Validates gtm/container.json and keeps the tracking IDs in sync across files.
// Run: node --test tests/unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, isEcommerce, loadTrackingPlan } from '../../scripts/tracking-plan.mjs';
import {
  CONTAINER_PATH, DLV_KEYS, GA4_MEASUREMENT_ID, GTM_PUBLIC_ID, INITIALIZATION_ALL_PAGES,
  buildContainer, dlvName, serialize,
} from '../../gtm/build-container.mjs';

const raw = readFileSync(CONTAINER_PATH, 'utf8');
const plan = loadTrackingPlan();
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const param = (entity, key) => entity.parameter.find(p => p.key === key);
const tableRows = (p) => p.list.map(row => Object.fromEntries(row.map.map(m => [m.key, m.value])));

test('container.json is valid JSON and matches the generator output', () => {
  const parsed = JSON.parse(raw);
  assert.equal(parsed.exportFormatVersion, 2);
  assert.equal(raw.replace(/\r\n/g, '\n'), serialize(buildContainer()), 'run: node gtm/build-container.mjs');
});

const cv = JSON.parse(raw).containerVersion;

test('container version has the sections GTM import expects', () => {
  for (const key of ['container', 'tag', 'trigger', 'variable', 'builtInVariable']) {
    assert.ok(cv[key], `missing containerVersion.${key}`);
  }
  assert.equal(cv.container.publicId, GTM_PUBLIC_ID);
  assert.deepEqual(cv.container.usageContext, ['WEB']);
});

test('ids are unique and every reference resolves', () => {
  const ids = (list, key) => list.map(x => x[key]);
  for (const [list, key] of [[cv.tag, 'tagId'], [cv.trigger, 'triggerId'], [cv.variable, 'variableId']]) {
    assert.equal(new Set(ids(list, key)).size, list.length, `duplicate ${key}`);
  }
  const triggerIds = new Set([...ids(cv.trigger, 'triggerId'), INITIALIZATION_ALL_PAGES]);
  for (const t of cv.tag) for (const f of t.firingTriggerId) assert.ok(triggerIds.has(f), `${t.name} -> unknown trigger ${f}`);

  const names = new Set([...cv.variable.map(v => v.name), ...cv.builtInVariable.map(b => b.name), '_event']);
  for (const ref of raw.matchAll(/\{\{([^}]+)\}\}/g)) assert.ok(names.has(ref[1]), `unresolved {{${ref[1]}}}`);
});

test('variables: measurement ID constant, one DLV v2 per parameter, built-in Event', () => {
  const constant = cv.variable.find(v => v.name === 'GA4 Measurement ID');
  assert.equal(constant.type, 'c');
  assert.equal(param(constant, 'value').value, GA4_MEASUREMENT_ID);

  for (const key of DLV_KEYS) {
    const v = cv.variable.find(x => x.name === dlvName(key));
    assert.ok(v, `missing ${dlvName(key)}`);
    assert.equal(v.type, 'v');
    assert.equal(param(v, 'dataLayerVersion').value, '2');
    assert.equal(param(v, 'name').value, key);
  }
  assert.ok(cv.builtInVariable.some(b => b.type === 'EVENT' && b.name === 'Event'));
});

test('event name lookup maps page_view_spa to page_view and passes the rest through', () => {
  const lookup = cv.variable.find(v => v.name === 'GA4 Event Name');
  assert.equal(lookup.type, 'smm');
  assert.equal(param(lookup, 'input').value, '{{Event}}');
  assert.equal(param(lookup, 'defaultValue').value, '{{Event}}');
  assert.deepEqual(tableRows(param(lookup, 'map')), [{ key: 'page_view_spa', value: 'page_view' }]);
});

test('Google tag: measurement ID, no automatic page_view, rec_variant user property, Initialization trigger', () => {
  const g = cv.tag.find(t => t.type === 'googtag');
  assert.equal(param(g, 'tagId').value, '{{GA4 Measurement ID}}');
  assert.deepEqual(g.firingTriggerId, [INITIALIZATION_ALL_PAGES]);

  const config = cv.variable.find(v => `{{${v.name}}}` === param(g, 'configSettingsVariable').value);
  assert.deepEqual(tableRows(param(config, 'configSettingsTable')), [{ parameter: 'send_page_view', parameterValue: 'false' }]);

  const settings = cv.variable.find(v => `{{${v.name}}}` === param(g, 'eventSettingsVariable').value);
  assert.deepEqual(tableRows(param(settings, 'userProperties')), [{ name: 'rec_variant', value: '{{DLV - rec_variant}}' }]);
});

test('GA4 event tags: event name lookup, measurement ID override, ecommerce only on the ecommerce tag', () => {
  const events = cv.tag.filter(t => t.type === 'gaawe');
  assert.equal(events.length, 2);
  for (const t of events) {
    assert.equal(param(t, 'eventName').value, '{{GA4 Event Name}}');
    assert.equal(param(t, 'measurementIdOverride').value, '{{GA4 Measurement ID}}');
    for (const row of tableRows(param(t, 'eventSettingsTable'))) {
      assert.equal(row.parameterValue, `{{${dlvName(row.parameter)}}}`, `${row.parameter} is not mapped to its DLV`);
    }
  }
  const ecommerce = events.find(t => param(t, 'sendEcommerceData').value === 'true');
  const other = events.find(t => param(t, 'sendEcommerceData').value === 'false');
  assert.ok(ecommerce && other);
  assert.equal(param(ecommerce, 'getEcommerceDataFrom').value, 'dataLayer');

  // Every DLV except the user property is sent by exactly one of the two tags.
  const sent = [ecommerce, other].flatMap(t => tableRows(param(t, 'eventSettingsTable')).map(r => r.parameter));
  assert.deepEqual([...sent].sort(), DLV_KEYS.filter(k => k !== 'rec_variant').sort());
});

test('triggers match exactly the tracked event names from the tracking plan', () => {
  const regexOf = (t) => new RegExp(t.customEventFilter[0].parameter.find(p => p.key === 'arg1').value);
  const tagFor = (pred) => cv.tag.find(t => t.type === 'gaawe' && pred(param(t, 'sendEcommerceData').value === 'true'));
  const triggerOf = (t) => cv.trigger.find(x => x.triggerId === t.firingTriggerId[0]);

  const ecoRe = regexOf(triggerOf(tagFor(isEco => isEco)));
  const otherRe = regexOf(triggerOf(tagFor(isEco => !isEco)));

  for (const e of plan) {
    const [own, others] = isEcommerce(e) ? [ecoRe, otherRe] : [otherRe, ecoRe];
    assert.ok(own.test(e.event), `${e.event} does not fire its tag`);
    assert.ok(!others.test(e.event), `${e.event} would fire both tags`);
  }
  for (const near of ['page_view', 'purchase_refund', 'xsearch', 'search2', 'gtm.js', 'select_item_x']) {
    assert.ok(!ecoRe.test(near) && !otherRe.test(near), `regex matches untracked "${near}"`);
  }
});

test('tracking IDs are identical in environments, index.html and the container', () => {
  for (const file of ['environment.ts', 'environment.prod.ts']) {
    const env = read('src', 'environments', file);
    assert.match(env, new RegExp(`gtmContainerId: '${GTM_PUBLIC_ID}'`), file);
    assert.match(env, new RegExp(`ga4MeasurementId: '${GA4_MEASUREMENT_ID}'`), file);
  }
  const html = read('src', 'index.html');
  assert.equal(html.match(/GTM-[A-Z0-9]+/g).filter(id => id !== GTM_PUBLIC_ID).length, 0);
  assert.equal(html.match(new RegExp(GTM_PUBLIC_ID, 'g')).length, 2, 'head snippet and noscript iframe');
  assert.ok(html.indexOf("gtag('consent', 'default'") < html.indexOf('googletagmanager.com/gtm.js'),
    'consent default must come before the GTM snippet');
});
