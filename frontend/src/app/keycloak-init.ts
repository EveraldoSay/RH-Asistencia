import { APP_INITIALIZER, Provider } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../environments/environment';

export function initializeKeycloak(kc: KeycloakService) {
  return () =>
    kc.init({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId
      },
      initOptions: { onLoad: 'login-required', checkLoginIframe: false },
      enableBearerInterceptor: true,
      bearerExcludedUrls: ['/assets', '/favicon.ico']
    });
}

export const KEYCLOAK_INITIALIZER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeKeycloak,
  deps: [KeycloakService],
  multi: true
};
