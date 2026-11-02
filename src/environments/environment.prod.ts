export const environment = {
  production: true,
  apiUrl: '/api/v1',
  // No ML service deployment in V1 production — empty disables the
  // post-onboarding /admin/reload call (see RecommendationsService).
  mlServiceUrl: '',
};
