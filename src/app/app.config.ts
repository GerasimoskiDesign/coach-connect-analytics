import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { mockBackendInterceptor } from './core/mock/mock-backend.interceptor';
import { environment } from '../environments/environment';
import { AnalyticsService } from './core/analytics/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        jwtInterceptor,
        errorInterceptor,
        // Last in the chain so the JWT and 401-refresh interceptors run exactly
        // as they would against the real API.
        ...(environment.useMockBackend ? [mockBackendInterceptor] : []),
      ])
    ),
    // Start SPA page view tracking and publish the A/B variant before the first navigation ends.
    provideAppInitializer(() => inject(AnalyticsService).start()),
  ],
};
