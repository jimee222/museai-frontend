export type AiUsageModule = 'IMAGE_DESCRIPTION' | 'TRANSLATION' | 'SCULPTURE_DESCRIPTION';

export interface TokenUsageEntry {
  date: string;
  module: AiUsageModule;
  userEmail: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenUsageReport {
  startDate: string;
  endDate: string;
  tokenLimit: number;
  alertThreshold: number;
  totalTokensUsed: number;
  usagePercentage: number;
  alert: boolean;
  details: TokenUsageEntry[];
}
