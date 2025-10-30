// src/app/core/interceptors/access-token.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../app/services/auth.service';

export const accessTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // No tocar llamadas de auth
  if (req.url.includes('/auth/')) return next(req);

  const token = auth.getAccessToken();
  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
