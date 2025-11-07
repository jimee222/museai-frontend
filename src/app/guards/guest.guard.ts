// src/app/guards/guest.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const GuestGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth   = inject(AuthService);

  // Permite entrar si NO hay sesión
  if (!auth.check()) {
    return true;
  }

  // Si ya hay sesión, redirige al menú inicial
  return router.parseUrl('/app/menu');
};
