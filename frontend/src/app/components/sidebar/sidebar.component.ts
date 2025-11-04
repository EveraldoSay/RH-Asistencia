import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../../environments/environment';
import { defer, from, of, switchMap, map, catchError, take } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  private kc = inject(KeycloakService);

  // 1) Observable que dice si está autenticado
  isAuthenticated$ = defer(async () => this.kc.isLoggedIn()).pipe(
    map(isLoggedIn => !!isLoggedIn)
  );

  // 2) Cargamos el perfil SOLO si está autenticado
  vm$ = this.isAuthenticated$.pipe(
    switchMap(ok => ok
      ? from(this.kc.loadUserProfile()).pipe(
          map(profile => {
            const userName = profile.username ?? '';
            const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || userName;
            const email = profile.email ?? '';
            const roles = this.kc.getUserRoles(true) || [];
            const isAdminRole = roles.includes('admin') || roles.includes('realm-admin');
            const initials = (fullName || userName)
              .split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase();

            const base = environment.keycloak.url.replace(/\/+$/, '');
            const realm = environment.keycloak.realm;
            const accountUrl = `${base}/realms/${realm}/account`;

            return { ok, userName, fullName, email, initials, isAdminRole, accountUrl };
          }),
          catchError(() => of({ ok: true, userName:'', fullName:'', email:'', initials:'', isAdminRole:false, accountUrl:'' }))
        )
      : of({ ok: false, userName:'', fullName:'', email:'', initials:'', isAdminRole:false, accountUrl:'' })
    ),
    take(1) 
  );

  openAccount(url: string) { if (url) window.open(url, '_blank'); }

  async logout() {
    try {
      await this.kc.logout(window.location.origin);
    } catch {
      const base = environment.keycloak.url.replace(/\/+$/, '');
      const realm = environment.keycloak.realm;
      const clientId = environment.keycloak.clientId;
      const redirect = encodeURIComponent(window.location.origin);
      window.location.href =
        `${base}/realms/${realm}/protocol/openid-connect/logout` +
        `?client_id=${clientId}&post_logout_redirect_uri=${redirect}`;

    }
  }
  
}
