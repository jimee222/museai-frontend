import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SupportedLanguage } from './language-preference.service';

interface SculptureDescriptionRequest {
  name: string;
  labels: string[];
  language: SupportedLanguage;
}

@Injectable({ providedIn: 'root' })
export class AiDescriptionsService {
  readonly imagePromptTemplate = `Provide a short, vivid description in {{language}} of the artwork shown in the attached image.
Focus on the visible subject, medium, style, and mood.
Avoid inventing details or metadata that aren't clearly visible.
Return 2–3 sentences, no preamble.`;

  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'api/ai/descriptions';

  describeImage(imageBase64: string, language: SupportedLanguage): Observable<string> {
    const body = { imageBase64, language };
    return this.http
      .post<unknown>(`${this.baseUrl}/image`, body)
      .pipe(map((res) => this.extractDescription(res)));
  }

  generateSculptureDescription(
    request: SculptureDescriptionRequest,
  ): Observable<string> {
    return this.http
      .post<unknown>(`${this.baseUrl}/sculpture`, request)
      .pipe(map((res) => this.extractDescription(res)));
  }

  private extractDescription(response: unknown): string {
    const payload = (response as any)?.data ?? response;
    const text =
      (payload as any)?.description ??
      (payload as any)?.text ??
      (payload as any)?.result ??
      (typeof payload === 'string' ? payload : '');
    return typeof text === 'string' ? text.trim() : '';
  }
}
