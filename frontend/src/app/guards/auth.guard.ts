// src/app/guards/auth.guard.ts
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private auth = inject(AuthService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    const ok = await firstValueFrom(this.auth.isAuthenticated$());
    if (!ok) {
      await this.auth.login();
      return false;
    }
    return true;
  }
}

export const canActivateAuth: CanActivateFn = async () => {
  const guard = inject(AuthGuard);
  return guard.canActivate();
};
