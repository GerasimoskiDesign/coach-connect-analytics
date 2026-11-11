// Generates gtm/container.json, an importable GTM web container
// (Admin > Import Container, exportFormatVersion 2).
//
//   node gtm/build-container.mjs           write gtm/container.json
//   node gtm/build-container.mjs --check   exit 1 if the file is out of date
//
// Event names and parameters come from docs/tracking_plan.csv: one custom event
// trigger per event, and each GA4 event tag sends exactly the top-level
// parameters of the events it fires on.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, allParameters, isEcommerce, loadTrackingPlan } from '../scripts/tracking-plan.mjs';

export const GA4_MEASUREMENT_ID = 'G-GQKEFPELG9';
export const GTM_PUBLIC_ID = 'GTM-M69PG8QQ';
export const INITIALIZATION_ALL_PAGES = '2147479573';

/** dataLayer key holding the User-ID. Sent to GA4 as `user_id`. */
export const USER_ID_KEY = 'user.user_id';

/** GA4 user properties and the dataLayer key each one reads. */
export const USER_PROPERTIES = {
  rec_variant: 'rec_variant',
  user_role: 'user.user_role',
  signup_date: 'user.signup_date',
  player_level: 'user.player_level',
};

/** Top-level parameters of a plan entry that a GA4 event tag sends (user properties excluded). */
export const eventParams = (e) =>
  allParameters(e).filter(p => !p.includes('.') && !Object.values(USER_PROPERTIES).includes(p));

const uniq = (list) => [...new Set(list)];

/** Data Layer Variables (v2): every top-level parameter in the plan, plus the account keys. */
export function dlvKeys(plan = loadTrackingPlan()) {
  return uniq([...plan.flatMap(eventParams), USER_ID_KEY, ...Object.values(USER_PROPERTIES)]);
}
export const DLV_KEYS = dlvKeys();

/** GA4 parameter name -> dataLayer key, where they differ. */
export const sourceOf = (param) => (param === 'user_id' ? USER_ID_KEY : param);

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

export function buildContainer() {
  const plan = loadTrackingPlan();
  const ecommerceEvents = plan.filter(isEcommerce);
  const otherEvents = plan.filter(e => !isEcommerce(e));
  const ecommerceParams = uniq(ecommerceEvents.flatMap(eventParams));
  const otherParams = uniq(otherEvents.flatMap(eventParams));

  let nextId = 1;
  const id = () => String(nextId++);

  // ── Variables ────────────────────────────────────────────────────────────
  const variables = [];
  const variable = (name, type, parameter) => {
    variables.push({ ...base, variableId: id(), name, type, parameter, fingerprint: FINGERPRINT, formatValue: {} });
    return name;
  };

  const measurementId = variable('GA4 Measurement ID', 'c', [tpl('value', GA4_MEASUREMENT_ID)]);

  for (const key of dlvKeys(plan)) {
    variable(dlvName(key), 'v', [int('dataLayerVersion', 2), bool('setDefaultValue', false), tpl('name', key)]);
  }

  // GA4 event name: page_view_spa becomes page_view, every other event passes through.
  const eventName = variable('GA4 Event Name', 'smm', [
    bool('setDefaultValue', true),
    tpl('input', '{{Event}}'),
    list('map', [map({ key: 'page_view_spa', value: 'page_view' })]),
    tpl('defaultValue', '{{Event}}'),
  ]);

  const userIdRow = map({ parameter: 'user_id', parameterValue: ref(dlvName(USER_ID_KEY)) });
  const userPropertyRows = () => Object.entries(USER_PROPERTIES).map(([name, key]) => map({ name, value: ref(dlvName(key)) }));

  // Disables the automatic page_view on load (page views come only from
  // page_view_spa) and sets the User-ID when the page loads signed in.
  const configSettings = variable('GA4 Configuration Settings', 'gtcs', [
    list('configSettingsTable', [map({ parameter: 'send_page_view', parameterValue: 'false' }), userIdRow]),
  ]);

  // Shared settings for every GA4 hit: the User-ID (per event, so it follows a
  // login or logout inside the single-page app) and the user properties.
  const eventSettings = variable('GA4 Event Settings', 'gtes', [
    list('eventSettingsTable', [userIdRow]),
    list('userProperties', userPropertyRows()),
  ]);

  // ── Triggers ─────────────────────────────────────────────────────────────
  const triggers = [];
  // One custom event trigger per tracked event, exact match on the event name.
  const trigger = (name) => {
    const triggerId = id();
    triggers.push({
      ...base, triggerId, name: `CE - ${name}`, type: 'CUSTOM_EVENT',
      customEventFilter: [{
        type: 'EQUALS',
        parameter: [tpl('arg0', '{{_event}}'), tpl('arg1', name)],
      }],
      fingerprint: FINGERPRINT,
    });
    return triggerId;
  };

  const otherTriggers = otherEvents.map(e => trigger(e.event));
  const ecommerceTriggers = ecommerceEvents.map(e => trigger(e.event));

  // ── Tags ─────────────────────────────────────────────────────────────────
  const tags = [];
  const tag = (name, type, parameter, firingTriggerId) => {
    tags.push({
      ...base, tagId: id(), name, type, parameter, fingerprint: FINGERPRINT,
      firingTriggerId, tagFiringOption: 'ONCE_PER_EVENT',
      monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' },
    });
  };

  // user_id and the user properties are also set directly on each event tag, so
  // they are present even if the shared Event Settings variable is edited or
  // detached later.
  const eventTable = (keys) => list('eventSettingsTable', [
    userIdRow,
    ...keys.map(k => map({ parameter: k, parameterValue: ref(dlvName(sourceOf(k))) })),
  ]);
  const userProps = list('userProperties', userPropertyRows());

  tag('Google tag - GA4', 'googtag', [
    tpl('tagId', ref(measurementId)),
    tpl('configSettingsVariable', ref(configSettings)),
    tpl('eventSettingsVariable', ref(eventSettings)),
  ], [INITIALIZATION_ALL_PAGES]);

  tag('GA4 - Event - Custom and recommended', 'gaawe', [
    bool('sendEcommerceData', false),
    bool('enhancedUserId', false),
    tpl('eventName', ref(eventName)),
    tpl('measurementIdOverride', ref(measurementId)),
    tpl('eventSettingsVariable', ref(eventSettings)),
    eventTable(otherParams),
    userProps,
  ], otherTriggers);

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
    eventTable(ecommerceParams),
    userProps,
  ], ecommerceTriggers);

  return {
    exportFormatVersion: 2,
    exportTime: '2026-11-11 00:00:00',
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
