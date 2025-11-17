import { HttpEvent, HttpHandler, HttpInterceptor, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { defer, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';


function isApi(req: HttpRequest<unknown>): boolean {

  return (
    req.url.startsWith(environment.apiBase) ||
    req.url.startsWith('http://localhost:8020') ||
    req.url.startsWith('/api')
  );
}

export const kcBearerInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApi(req)) {
    return next(req);
  }

  const kc = inject(KeycloakService, { optional: true });
  if (!kc) {
    const token =
      localStorage.getItem('kc_access_token') ||
      localStorage.getItem('kc_token') ||
      '';
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
    return next(authReq);
  }

  // Asegura que lo que devuelva updateToken se trate como Promesa
  return defer(() => Promise.resolve(kc.updateToken(30))) 
    .pipe(
      catchError(() => of(false)), 
      map(() => kc.getKeycloakInstance().token || ''),
      switchMap((token) => {
        const authReq = token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req; 
        return next(authReq);
      })
    );
};

@Injectable()
export class KcBearerInterceptor implements HttpInterceptor {
  constructor(private kc: KeycloakService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Solo tu API
    if (!req.url.startsWith(environment.apiBase)) {
      return next.handle(req);
    }
    return from(this.kc.getToken()).pipe(
      switchMap(token => {
        if (!token) return next.handle(req);
        const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
        return next.handle(authReq);
      })
    );
  }
}
