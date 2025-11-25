import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  TranslationRequest,
  TranslationResponse,
} from '../interfaces/translation';

@Injectable({ providedIn: 'root' })
export class DescriptionTranslationService {
  private readonly url = '/ai/translations/description';
  private readonly cache = new Map<string, TranslationResponse>();
  private readonly supportedLanguages: Array<TranslationRequest['targetLanguage']> = ['es', 'en', 'fr'];

  constructor(private readonly http: HttpClient) {}

  translate(request: TranslationRequest): Observable<TranslationResponse> {
    if (!this.supportedLanguages.includes(request.targetLanguage)) {
      return throwError(() => new Error('Unsupported language'));
    }

    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.http.post<TranslationResponse>(this.url, request).pipe(
      map((res) => {
        const response: TranslationResponse = {
          artworkId: res.artworkId,
          targetLanguage: res.targetLanguage,
          translatedText: res.translatedText,
        };
        this.cache.set(cacheKey, response);
        return response;
      }),
      catchError(() =>
        throwError(() => new Error('Error al traducir, intente nuevamente'))
      )
    );
  }

  private buildCacheKey(request: TranslationRequest): string {
    const hash = this.hashText(request.originalText);
    return `${request.artworkId}|${request.targetLanguage}|${hash}`;
  }

  private hashText(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
