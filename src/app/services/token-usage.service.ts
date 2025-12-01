import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TokenUsageReport } from '../interfaces/token-usage';
import { downloadBlob } from '../sculptor/utils/download';

@Injectable({
  providedIn: 'root',
})
export class TokenUsageService {
  constructor(private readonly http: HttpClient) {}

  fetchReport(params: { startDate?: string; endDate?: string }): Observable<TokenUsageReport> {
    const httpParams = this.buildParams(params);
    return this.http
      .get<TokenUsageReport>('/api/ai/usage', { params: httpParams })
      .pipe(catchError(() => of(this.buildEmptyReport())));
  }

  exportCsv(params: { startDate?: string; endDate?: string }): Observable<Blob> {
    const httpParams = this.buildParams({ ...params, format: 'csv' });
    return this.http.get('/api/ai/usage/export', {
      params: httpParams,
      responseType: 'blob',
    });
  }

  exportPdf(params: { startDate?: string; endDate?: string }): Observable<Blob> {
    const httpParams = this.buildParams({ ...params, format: 'pdf' });
    return this.http.get('/api/ai/usage/export', {
      params: httpParams,
      responseType: 'blob',
    });
  }

  downloadCsvFallback(entries: TokenUsageReport['details']): void {
    const header = ['Fecha', 'Módulo', 'Usuario', 'Prompt', 'Completion', 'Tokens'];
    const rows = entries.map((entry) => [
      entry.date,
      entry.module,
      entry.userEmail,
      entry.promptTokens.toString(),
      entry.completionTokens.toString(),
      entry.totalTokens.toString(),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `token-usage-${Date.now()}.csv`);
  }

  private buildParams(params: Record<string, string | undefined>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        httpParams = httpParams.set(key, value);
      }
    });
    return httpParams;
  }

  private buildEmptyReport(): TokenUsageReport {
    return {
      startDate: '',
      endDate: '',
      tokenLimit: 0,
      alertThreshold: 0,
      totalTokensUsed: 0,
      usagePercentage: 0,
      alert: false,
      details: [],
    };
  }
}
