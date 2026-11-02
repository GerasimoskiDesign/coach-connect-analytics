// Generates gtm/container.json, an importable GTM web container
// (Admin > Import Container, exportFormatVersion 2).
//
//   node gtm/build-container.mjs           write gtm/container.json
//   node gtm/build-container.mjs --check   exit 1 if the file is out of date
//
// Event names come from docs/tracking_plan.csv so the trigger regexes always
// match the tracking plan exactly.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, isEcommerce, loadTrackingPlan } from '../scripts/tracking-plan.mjs';

export const GA4_MEASUREMENT_ID = 'G-GQKEFPELG9';
export const GTM_PUBLIC_ID = 'GTM-M69PG8QQ';
export const INITIALIZATION_ALL_PAGES = '2147479573';

/** Data Layer Variables (v2), one per custom parameter. */
export const DLV_KEYS = [
  'search_term', 'filter_level', 'filter_city', 'rec_algorithm', 'rec_score',
  'coach_id', 'session_type', 'value', 'currency', 'method', 'rec_variant',
  'page_path', 'page_title', 'page_location',
];

/** Parameters sent by the non-ecommerce event tag. */
const EVENT_PARAMS = DLV_KEYS.filter(k => k !== 'rec_variant');
/** Parameters sent by the ecommerce tag, on top of the ecommerce object. */
const ECOMMERCE_EXTRA_PARAMS = ['rec_algorithm', 'rec_score'];

const ACCOUNT = '0';
const CONTAINER = '0';
const FINGERPRINT = '0';
const base = { accountId: ACCOUNT, containerId: CONTAINER };

const tpl = (key, value) => ({ type: 'TEMPLATE', key, value });
const bool = (key, value) => ({ type: 'BOOLEAN', key, value: String(value) });
const int = (key, value) => ({ type: 'INTEGER', key, value: String(value) });
const map = (pairs) => ({ type: 'MAP', map: Object.entries(pairs).map(([k, v]) => tpl(k, v)) });
const list = (key, items) => ({ type: 'LIST', key, list: items });
export const dlvName = (key) => `DLV - ${key}`;
const ref = (name) => `{{${name}}}`;

function regexFor(events) {
  return `^(${events.map(e => e.event).join('|')})$`;
}

export function buildContainer() {
  const plan = loadTrackingPlan();
  const ecommerceEvents = plan.filter(isEcommerce);
  const otherEvents = plan.filter(e => !isEcommerce(e));

  let nextId = 1;
  const id = () => String(nextId++);

  // ── Variables ────────────────────────────────────────────────────────────
  const variables = [];
  const variable = (name, type, parameter) => {
    variables.push({ ...base, variableId: id(), name, type, parameter, fingerprint: FINGERPRINT, formatValue: {} });
    return name;
  };

  const measurementId = variable('GA4 Measurement ID', 'c', [tpl('value', GA4_MEASUREMENT_ID)]);

  for (const key of DLV_KEYS) {
    variable(dlvName(key), 'v', [int('dataLayerVersion', 2), bool('setDefaultValue', false), tpl('name', key)]);
  }

  // GA4 event name: page_view_spa becomes page_view, every other event passes through.
  const eventName = variable('GA4 Event Name', 'smm', [
    bool('setDefaultValue', true),
    tpl('input', '{{Event}}'),
    list('map', [map({ key: 'page_view_spa', value: 'page_view' })]),
    tpl('defaultValue', '{{Event}}'),
  ]);

  // Disables the automatic page_view on load: page views come only from page_view_spa.
  const configSettings = variable('GA4 Configuration Settings', 'gtcs', [
    list('configSettingsTable', [map({ parameter: 'send_page_view', parameterValue: 'false' })]),
  ]);

  // Shared user property for every GA4 hit: the recommendation A/B variant.
  const eventSettings = variable('GA4 Event Settings', 'gtes', [
    list('userProperties', [map({ name: 'rec_variant', value: ref(dlvName('rec_variant')) })]),
  ]);

  // ── Triggers ─────────────────────────────────────────────────────────────
  const triggers = [];
  const trigger = (name, events) => {
    const triggerId = id();
    triggers.push({
      ...base, triggerId, name, type: 'CUSTOM_EVENT',
      customEventFilter: [{
        type: 'MATCH_REGEX',
        parameter: [tpl('arg0', '{{_event}}'), tpl('arg1', regexFor(events))],
      }],
      fingerprint: FINGERPRINT,
    });
    return triggerId;
  };

  const otherTrigger = trigger('CE - GA4 events', otherEvents);
  const ecommerceTrigger = trigger('CE - GA4 ecommerce events', ecommerceEvents);

  // ── Tags ─────────────────────────────────────────────────────────────────
  const tags = [];
  const tag = (name, type, parameter, firingTriggerId) => {
    tags.push({
      ...base, tagId: id(), name, type, parameter, fingerprint: FINGERPRINT,
      firingTriggerId: [firingTriggerId], tagFiringOption: 'ONCE_PER_EVENT',
      monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' },
    });
  };

  const eventTable = (keys) => list('eventSettingsTable', keys.map(k => map({ parameter: k, parameterValue: ref(dlvName(k)) })));
  // Also set directly on each event tag, so the user property is present even
  // if the shared Event Settings variable is edited or detached later.
  const userProps = list('userProperties', [map({ name: 'rec_variant', value: ref(dlvName('rec_variant')) })]);

  tag('Google tag - GA4', 'googtag', [
    tpl('tagId', ref(measurementId)),
    tpl('configSettingsVariable', ref(configSettings)),
    tpl('eventSettingsVariable', ref(eventSettings)),
  ], INITIALIZATION_ALL_PAGES);

  tag('GA4 - Event - Custom and recommended', 'gaawe', [
    bool('sendEcommerceData', false),
    bool('enhancedUserId', false),
    tpl('eventName', ref(eventName)),
    tpl('measurementIdOverride', ref(measurementId)),
    tpl('eventSettingsVariable', ref(eventSettings)),
    eventTable(EVENT_PARAMS),
    userProps,
  ], otherTrigger);

  // Separate tag so that ecommerce data is only read for ecommerce events. With
  // one tag, the last ecommerce object in the data model would also be attached
  // to book_session, search and every other event.
  tag('GA4 - Event - Ecommerce', 'gaawe', [
    bool('sendEcommerceData', true),
    tpl('getEcommerceDataFrom', 'dataLayer'),
    bool('enhancedUserId', false),
    tpl('eventName', ref(eventName)),
    tpl('measurementIdOverride', ref(measurementId)),
    tpl('eventSettingsVariable', ref(eventSettings)),
    eventTable(ECOMMERCE_EXTRA_PARAMS),
    userProps,
  ], ecommerceTrigger);

  return {
    exportFormatVersion: 2,
    exportTime: '2026-11-02 00:00:00',
    containerVersion: {
      path: `accounts/${ACCOUNT}/containers/${CONTAINER}/versions/0`,
      ...base,
      containerVersionId: '0',
      container: {
        path: `accounts/${ACCOUNT}/containers/${CONTAINER}`,
        ...base,
        name: 'Coach Connect+ analytics',
        publicId: GTM_PUBLIC_ID,
        usageContext: ['WEB'],
        fingerprint: FINGERPRINT,
        tagManagerUrl: `https://tagmanager.google.com/#/container/accounts/${ACCOUNT}/containers/${CONTAINER}/workspaces?apiLink=container`,
        features: {
          supportUserPermissions: true, supportEnvironments: true, supportWorkspaces: true,
          supportGtagConfigs: false, supportBuiltInVariables: true, supportClients: false,
          supportFolders: true, supportTags: true, supportTemplates: true, supportTriggers: true,
          supportVariables: true, supportVersions: true, supportZones: true, supportTransformations: false,
        },
        tagIds: [GTM_PUBLIC_ID],
      },
      tag: tags,
      trigger: triggers,
      variable: variables,
      builtInVariable: [{ ...base, type: 'EVENT', name: 'Event' }],
      fingerprint: FINGERPRINT,
      tagManagerUrl: `https://tagmanager.google.com/#/versions/accounts/${ACCOUNT}/containers/${CONTAINER}/versions/0?apiLink=version`,
    },
  };
}

export const CONTAINER_PATH = join(ROOT, 'gtm', 'container.json');
export const serialize = (c) => JSON.stringify(c, null, 2) + '\n';

if (process.argv[1]?.endsWith('build-container.mjs')) {
  const fresh = serialize(buildContainer());
  if (process.argv.includes('--check')) {
    const current = readFileSync(CONTAINER_PATH, 'utf8');
    if (current.replace(/\r\n/g, '\n') !== fresh) {
      console.error('gtm/container.json is out of date. Run: node gtm/build-container.mjs');
      process.exit(1);
    }
    console.log('gtm/container.json is up to date.');
  } else {
    writeFileSync(CONTAINER_PATH, fresh);
    console.log('Wrote gtm/container.json');
  }
}
