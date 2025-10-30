// src/app/core/interceptors/handle-errors.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../../app/services/auth.service';

export const handleErrorsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth   = inject(AuthService);

  return next(req).pipe(
    catchError((error: any): Observable<never> => {
      const status = error?.status;
      const body   = error?.error;

      if ((status === 401 || status === 403) && !req.url.includes('/auth/')) {
        auth.logout();
        router.navigateByUrl('/login');
      }

      // Intenta sacar el mensaje del backend
      const backendMessage =
        (body && (body.message || body.error || body.description)) ||
        'Ocurrió un error. Intenta nuevamente.';

      // 422 / 404 los relanzamos para que el componente decida
      if (status === 422 || status === 404 || status === 409) {
        return throwError(() => ({ ...error, message: backendMessage }));
      }

      // Por defecto relanza con mensaje amigable
      return throwError(() => ({ ...error, message: backendMessage }));
    })
  );
};
