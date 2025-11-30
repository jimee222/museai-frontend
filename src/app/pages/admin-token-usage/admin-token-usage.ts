import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TokenUsageService } from '../../services/token-usage.service';
import { TokenUsageReport } from '../../interfaces/token-usage';

@Component({
  selector: 'app-admin-token-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="token-usage">
      <header class="page-header">
        <div>
          <p class="eyebrow">Control de consumo</p>
          <h1>Consumo de tokens de IA</h1>
          <p class="subtitle">Monitorea por fecha, módulo y usuario; exporta reportes en CSV o PDF.</p>
        </div>
        <div class="export-actions">
          <button type="button" class="secondary" (click)="onExportCsv()">Exportar CSV</button>
          <button type="button" class="primary" (click)="onExportPdf()">Exportar PDF</button>
        </div>
      </header>

      <div
        class="alert"
        *ngIf="report().alert"
        [class.critical]="report().usagePercentage >= report().alertThreshold + 0.1"
      >
        <div>
          <strong>Alerta:</strong>
          {{ (report().usagePercentage * 100) | number : '1.0-0' }}% del límite consumido.
        </div>
        <small>Considera aumentar el límite o reducir llamadas para evitar sobrecostos.</small>
      </div>

      <section class="filters">
        <div class="field">
          <label for="from">Desde</label>
          <input id="from" type="date" [(ngModel)]="filters.startDate" />
        </div>
        <div class="field">
          <label for="to">Hasta</label>
          <input id="to" type="date" [(ngModel)]="filters.endDate" />
        </div>
        <button type="button" class="primary" (click)="loadReport()">Aplicar filtros</button>
      </section>

      <section class="summary">
        <article class="card">
          <p class="label">Total tokens</p>
          <h3>{{ report().totalTokensUsed | number }}</h3>
          <small>Límite: {{ report().tokenLimit | number }}</small>
        </article>
        <article class="card" [class.warn]="report().usagePercentage * 100 >= 80">
          <p class="label">% del límite</p>
          <h3>{{ (report().usagePercentage * 100) | number : '1.0-0' }}%</h3>
          <small>Umbral de alerta: {{ (report().alertThreshold * 100) | number : '1.0-0' }}%</small>
        </article>
        <article class="card">
          <p class="label">Top módulo</p>
          <h3>{{ topModule()?.module || 'N/D' }}</h3>
          <small>{{ topModule()?.tokens | number }} tokens</small>
        </article>
        <article class="card">
          <p class="label">Top usuario</p>
          <h3>{{ topUser()?.userEmail || 'N/D' }}</h3>
          <small>{{ topUser()?.tokens | number }} tokens</small>
        </article>
      </section>

      <section class="table-wrapper">
        <header class="table-header">
          <h2>Registro de solicitudes</h2>
          <span>{{ report().details.length }} registros</span>
        </header>
        <div class="table-scroller">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Módulo</th>
                <th>Usuario</th>
                <th>Prompt</th>
                <th>Completion</th>
                <th>Total tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of report().details">
                <td>{{ entry.date | date: 'mediumDate' }}</td>
                <td><span class="pill">{{ entry.module }}</span></td>
                <td>{{ entry.userEmail }}</td>
                <td>{{ entry.promptTokens | number }}</td>
                <td>{{ entry.completionTokens | number }}</td>
                <td>{{ entry.totalTokens | number }}</td>
              </tr>
              <tr *ngIf="!report().details.length">
                <td colspan="6" class="empty">Sin datos para los filtros seleccionados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: calc(100vh - 70px);
        padding: 1.75rem 2rem 2.25rem;
        background: radial-gradient(circle at 14% 18%, rgba(34, 197, 94, 0.08), transparent 28%),
          radial-gradient(circle at 88% 12%, rgba(59, 130, 246, 0.05), transparent 22%),
          #05060a;
        color: #e2e8f0;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .token-usage {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: rgba(226, 232, 240, 0.65);
      }
      h1 {
        margin: 0.15rem 0;
        font-size: 1.7rem;
      }
      .subtitle {
        margin: 0;
        color: rgba(226, 232, 240, 0.82);
      }
      .export-actions {
        display: flex;
        gap: 0.5rem;
      }
      button {
        font: inherit;
        cursor: pointer;
        border-radius: 12px;
        padding: 0.55rem 1rem;
        border: 1px solid transparent;
        transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
      }
      button:hover {
        transform: translateY(-1px);
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .primary {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.32), rgba(34, 197, 94, 0.22));
        color: #d1fae5;
        border-color: rgba(34, 197, 94, 0.45);
        box-shadow: 0 10px 30px rgba(34, 197, 94, 0.2);
      }
      .primary:hover {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.42), rgba(34, 197, 94, 0.3));
      }
      .secondary {
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
        border-color: rgba(255, 255, 255, 0.14);
      }
      .secondary:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .alert {
        border: 1px solid rgba(251, 191, 36, 0.5);
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.14), rgba(251, 191, 36, 0.08));
        color: #fef3c7;
        border-radius: 14px;
        padding: 0.85rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        box-shadow: 0 15px 40px rgba(251, 191, 36, 0.15);
      }
      .alert.critical {
        border-color: rgba(239, 68, 68, 0.6);
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.12));
        color: #fee2e2;
        box-shadow: 0 15px 45px rgba(239, 68, 68, 0.2);
      }
      .filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.9rem;
        align-items: end;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem;
        border-radius: 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .field label {
        font-size: 0.9rem;
        color: rgba(226, 232, 240, 0.8);
      }
      input,
      select {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: #e2e8f0;
        border-radius: 12px;
        padding: 0.5rem 0.65rem;
        font: inherit;
      }
      input:focus,
      select:focus {
        outline: none;
        border-color: rgba(34, 197, 94, 0.55);
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.85rem;
      }
      .card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 1rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }
      .card.warn {
        border-color: rgba(251, 191, 36, 0.35);
        box-shadow: 0 12px 28px rgba(251, 191, 36, 0.12);
      }
      .card .label {
        color: rgba(226, 232, 240, 0.7);
        margin: 0 0 0.35rem;
      }
      .card h3 {
        margin: 0;
        font-size: 1.35rem;
      }
      .card small {
        color: rgba(226, 232, 240, 0.7);
      }
      .table-wrapper {
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.03);
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
      }
      .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.85rem 1.1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .table-scroller {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 620px;
      }
      th,
      td {
        text-align: left;
        padding: 0.85rem 1.1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      th {
        color: rgba(226, 232, 240, 0.7);
        font-weight: 700;
        font-size: 0.92rem;
      }
      tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.14);
        color: #bbf7d0;
        border: 1px solid rgba(34, 197, 94, 0.26);
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .empty {
        text-align: center;
        color: rgba(226, 232, 240, 0.7);
      }
      @media (max-width: 768px) {
        :host {
          padding: 1.25rem 1rem 1.75rem;
        }
        .export-actions {
          width: 100%;
        }
        .filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminTokenUsagePage implements OnInit {
  private readonly service = inject(TokenUsageService);

  readonly report = signal<TokenUsageReport>({
    startDate: '',
    endDate: '',
    tokenLimit: 0,
    alertThreshold: 0,
    totalTokensUsed: 0,
    usagePercentage: 0,
    alert: false,
    details: [],
  });

  filters: { startDate?: string; endDate?: string } = {};

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.service.fetchReport(this.filters).subscribe((data) => this.report.set(data));
  }

  onExportCsv(): void {
    this.service.exportCsv(this.filters).subscribe({
      next: (blob) => this.downloadFile(blob, 'ai-usage.csv'),
      error: () => this.service.downloadCsvFallback(this.report().details),
    });
  }

  onExportPdf(): void {
    this.service.exportPdf(this.filters).subscribe({
      next: (blob) => this.downloadFile(blob, 'ai-usage.pdf'),
    });
  }

  topModule(): { module: string; tokens: number } | undefined {
    const totals = this.report().details.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.module] = (acc[entry.module] ?? 0) + entry.totalTokens;
      return acc;
    }, {});
    return Object.entries(totals)
      .map(([module, tokens]) => ({ module, tokens }))
      .sort((a, b) => b.tokens - a.tokens)[0];
  }

  topUser(): { userEmail: string; tokens: number } | undefined {
    const totals = this.report().details.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.userEmail] = (acc[entry.userEmail] ?? 0) + entry.totalTokens;
      return acc;
    }, {});
    return Object.entries(totals)
      .map(([userEmail, tokens]) => ({ userEmail, tokens }))
      .sort((a, b) => b.tokens - a.tokens)[0];
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
