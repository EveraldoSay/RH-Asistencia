import { Injectable, inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { from, of, map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
   constructor(private keycloakService: KeycloakService) {}


   async getToken(): Promise<string | null> {
    try {
      const token = await this.keycloakService.getToken();
      return token || null;
    } catch (err) {
      console.error('Error obteniendo token:', err);
      return null;
    }
  }
  // getToken() {
  //     throw new Error('Method not implemented.');
  // }
  logoutLocal() {
      throw new Error('Method not implemented.');
  }
  refreshTokenIfNeeded(arg0: number): any {
      throw new Error('Method not implemented.');
  }
  private kc = inject(KeycloakService);

  isAuthenticated$(): Observable<boolean> {
    return of(this.kc.isLoggedIn()).pipe(
      map((result) => !!result)
    );
  }

  async login(): Promise<void> {
    await this.kc.login();
  }

  async logout(): Promise<void> {
    await this.kc.logout(window.location.origin);
  }

  async openAccount(): Promise<void> {
    await this.kc.getKeycloakInstance().accountManagement();
  }

  async loadProfile(): Promise<{ fullName: string; userName: string; email?: string }> {
    const p = await this.kc.loadUserProfile();
    const token = this.kc.getKeycloakInstance().tokenParsed as any;
    return {
      fullName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
      userName: token?.preferred_username ?? '',
      email: p.email ?? undefined,
    };
  }

  async hasRole(role: string): Promise<boolean> {
    return this.kc.isUserInRole(role);
  }
}
