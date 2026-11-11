// Validates gtm/container.json and keeps the tracking IDs in sync across files.
// Run: node --test tests/unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, eventLevelKeys, isEcommerce, loadTrackingPlan } from '../../scripts/tracking-plan.mjs';
import {
  CONTAINER_PATH, DLV_KEYS, GA4_MEASUREMENT_ID, GTM_PUBLIC_ID, INITIALIZATION_ALL_PAGES,
  USER_ID_KEY, USER_PROPERTIES, buildContainer, dlvName, eventParams, serialize, sourceOf,
} from '../../gtm/build-container.mjs';

const raw = readFileSync(CONTAINER_PATH, 'utf8');
const plan = loadTrackingPlan();
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const param = (entity, key) => entity.parameter.find(p => p.key === key);
const tableRows = (p) => p.list.map(row => Object.fromEntries(row.map.map(m => [m.key, m.value])));
const sorted = (list) => [...list].sort();

test('container.json is valid JSON and matches the generator output', () => {
  const parsed = JSON.parse(raw);
  assert.equal(parsed.exportFormatVersion, 2);
  assert.equal(raw.replace(/\r\n/g, '\n'), serialize(buildContainer()), 'run: node gtm/build-container.mjs');
});

const cv = JSON.parse(raw).containerVersion;
const eventTags = cv.tag.filter(t => t.type === 'gaawe');
const ecommerceTag = eventTags.find(t => param(t, 'sendEcommerceData').value === 'true');
const otherTag = eventTags.find(t => param(t, 'sendEcommerceData').value === 'false');
const tagFor = (e) => (isEcommerce(e) ? ecommerceTag : otherTag);
const variableByRef = (value) => cv.variable.find(v => `{{${v.name}}}` === value);

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

test('DLVs exist for the account keys and the booking dimensions', () => {
  const required = [
    'user.user_id', 'user.user_role', 'user.signup_date', 'user.player_level',
    'user_role', 'player_level', 'coach_id', 'rec_algorithm', 'rec_index', 'interaction_type',
  ];
  for (const key of required) assert.ok(DLV_KEYS.includes(key), `missing DLV for ${key}`);
});

test('event name lookup maps page_view_spa to page_view and passes the rest through', () => {
  const lookup = cv.variable.find(v => v.name === 'GA4 Event Name');
  assert.equal(lookup.type, 'smm');
  assert.equal(param(lookup, 'input').value, '{{Event}}');
  assert.equal(param(lookup, 'defaultValue').value, '{{Event}}');
  assert.deepEqual(tableRows(param(lookup, 'map')), [{ key: 'page_view_spa', value: 'page_view' }]);
});

const userIdRow = { parameter: 'user_id', parameterValue: `{{${dlvName(USER_ID_KEY)}}}` };
const userPropertyRows = Object.entries(USER_PROPERTIES).map(([name, key]) => ({ name, value: `{{${dlvName(key)}}}` }));

test('Google tag: measurement ID, no automatic page_view, user_id, user properties, Initialization trigger', () => {
  const g = cv.tag.find(t => t.type === 'googtag');
  assert.equal(param(g, 'tagId').value, '{{GA4 Measurement ID}}');
  assert.deepEqual(g.firingTriggerId, [INITIALIZATION_ALL_PAGES]);

  const config = variableByRef(param(g, 'configSettingsVariable').value);
  assert.deepEqual(tableRows(param(config, 'configSettingsTable')), [
    { parameter: 'send_page_view', parameterValue: 'false' },
    userIdRow,
  ]);

  const settings = variableByRef(param(g, 'eventSettingsVariable').value);
  assert.deepEqual(tableRows(param(settings, 'eventSettingsTable')), [userIdRow]);
  assert.deepEqual(tableRows(param(settings, 'userProperties')), userPropertyRows);
  assert.deepEqual(Object.keys(USER_PROPERTIES), ['rec_variant', 'user_role', 'signup_date', 'player_level']);
});

test('GA4 event tags: event name lookup, measurement ID override, ecommerce only on the ecommerce tag', () => {
  assert.equal(eventTags.length, 2);
  assert.ok(ecommerceTag && otherTag);
  for (const t of eventTags) {
    assert.equal(param(t, 'eventName').value, '{{GA4 Event Name}}');
    assert.equal(param(t, 'measurementIdOverride').value, '{{GA4 Measurement ID}}');
    assert.equal(param(t, 'eventSettingsVariable').value, '{{GA4 Event Settings}}');
    for (const row of tableRows(param(t, 'eventSettingsTable'))) {
      assert.equal(row.parameterValue, `{{${dlvName(sourceOf(row.parameter))}}}`, `${row.parameter} is not mapped to its DLV`);
    }
    assert.deepEqual(tableRows(param(t, 'userProperties')), userPropertyRows, `${t.name} user properties`);
  }
  assert.equal(param(ecommerceTag, 'getEcommerceDataFrom').value, 'dataLayer');
});

test('each event tag sends exactly the top-level parameters of its events, plus user_id', () => {
  for (const t of eventTags) {
    const own = plan.filter(e => tagFor(e) === t);
    const expected = [...new Set(['user_id', ...own.flatMap(eventParams)])];
    const sent = tableRows(param(t, 'eventSettingsTable')).map(r => r.parameter);
    assert.deepEqual(sorted(sent), sorted(expected), t.name);
  }
  // User properties are never sent as event parameters.
  for (const t of eventTags) {
    const sent = tableRows(param(t, 'eventSettingsTable')).map(r => r.parameterValue);
    for (const key of Object.values(USER_PROPERTIES)) assert.ok(!sent.includes(`{{${dlvName(key)}}}`), `${t.name} sends ${key} as a parameter`);
  }
});

test('one custom event trigger per tracking-plan event, on the right tag', () => {
  assert.equal(cv.trigger.length, plan.length);
  for (const e of plan) {
    const matching = cv.trigger.filter(t => {
      const f = t.customEventFilter?.[0];
      return t.type === 'CUSTOM_EVENT' && f?.type === 'EQUALS'
        && f.parameter.find(p => p.key === 'arg0').value === '{{_event}}'
        && f.parameter.find(p => p.key === 'arg1').value === e.event;
    });
    assert.equal(matching.length, 1, `${e.event}: expected one trigger`);
    const [trigger] = matching;
    assert.equal(trigger.name, `CE - ${e.event}`);
    const firing = eventTags.filter(t => t.firingTriggerId.includes(trigger.triggerId));
    assert.deepEqual(firing, [tagFor(e)], `${e.event} must fire exactly its own tag`);
  }
});

test('EVENT_SCOPED_KEYS in analytics.service.ts matches the event-level parameters of the tracking plan', () => {
  const source = read('src', 'app', 'core', 'analytics', 'analytics.service.ts');
  const block = source.match(/const EVENT_SCOPED_KEYS = \[([\s\S]*?)\] as const;/);
  assert.ok(block, 'EVENT_SCOPED_KEYS not found');
  const inService = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const inPlan = [...new Set(plan.flatMap(eventLevelKeys))];
  assert.deepEqual(sorted(inService), sorted(inPlan));
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
