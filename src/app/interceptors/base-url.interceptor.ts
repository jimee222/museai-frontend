// src/app/core/interceptors/base-url.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';

const isAbsolute = (url: string) => /^https?:\/\//i.test(url);
const isAsset    = (url: string) => url.startsWith('assets/') || url.startsWith('/assets/');

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAbsolute(req.url) || isAsset(req.url)) return next(req);

  const base = environment.apiUrl.trim().replace(/\/+$/,''); // sin espacios o slash final
  const path = req.url.replace(/^\/+/, '');                   // sin slash inicial
  const url  = `${base}/${path}`;

  return next(req.clone({
    url,
    setHeaders: { Accept: 'application/json' }
  }));
};
