import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';
import { KEYCLOAK_INITIALIZER } from './keycloak-init';
import { kcBearerInterceptor } from './interceptors/kc-bearer.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    //Registramos nuestro interceptor explícitamente
    provideHttpClient(withInterceptors([kcBearerInterceptor])),

    importProvidersFrom(KeycloakAngularModule),
    KEYCLOAK_INITIALIZER,
    KeycloakService,
  ],
};


