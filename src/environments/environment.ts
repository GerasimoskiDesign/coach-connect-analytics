export const environment = {
  production: false,
  apiUrl: '/api/v1',
  // Step 5C: Python ML service, called directly (fire-and-forget) for
  // /admin/reload after onboarding. Empty string disables the call.
  mlServiceUrl: 'http://localhost:8000',
};
