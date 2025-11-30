import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TokenUsageService } from '../../services/token-usage.service';
import { TokenUsageReport } from '../../interfaces/token-usage';

@Component({
  selector: 'app-admin-token-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-token-usage.html',
  styleUrl: './admin-token-usage.css',
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
    this.service.fetchReport(this.filters).subscribe((data) =>
      this.report.set(data)
    );
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
    const totals = this.report().details.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.module] = (acc[entry.module] ?? 0) + entry.totalTokens;
        return acc;
      },
      {}
    );
    return Object.entries(totals)
      .map(([module, tokens]) => ({ module, tokens }))
      .sort((a, b) => b.tokens - a.tokens)[0];
  }

  topUser(): { userEmail: string; tokens: number } | undefined {
    const totals = this.report().details.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.userEmail] =
          (acc[entry.userEmail] ?? 0) + entry.totalTokens;
        return acc;
      },
      {}
    );
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
