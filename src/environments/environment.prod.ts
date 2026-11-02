export const environment = {
  production: true,
  apiUrl: '/api/v1',
  // The Python ML service is not part of this repo. Empty disables the
  // post-onboarding /admin/reload call (see RecommendationsService).
  mlServiceUrl: '',
  // Serve every API call from the in-browser mock backend (core/mock).
  useMockBackend: true,
  // Public tracking IDs. They are visible in every page load by design.
  // index.html hard-codes the same GTM ID; tests/unit/container.test.mjs keeps them in sync.
  gtmContainerId: 'GTM-M69PG8QQ',
  ga4MeasurementId: 'G-GQKEFPELG9',
};
