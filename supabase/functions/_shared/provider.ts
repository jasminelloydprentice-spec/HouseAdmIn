import type { DocumentAnalysis } from './analysisSchema.ts';

/**
 * Document-analysis provider interface. Keeps the app free of AI-vendor
 * lock-in: implementations exist for Claude (real) and a deterministic mock
 * (development / offline). Add another vendor by implementing this
 * interface — nothing outside the process-document function changes.
 */

export interface AnalyseDocumentFile {
  /** base64-encoded file content. */
  base64: string;
  mimeType: string;
  /** 1-based page number for image pages; null for a whole PDF. */
  pageNumber: number | null;
}

export interface AnalyseDocumentInput {
  files: AnalyseDocumentFile[];
  /** ISO date the analysis runs (lets the model resolve e.g. "within 30 days"). */
  todayIso: string;
}

export interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface DocumentAnalysisResult {
  analysis: DocumentAnalysis;
  usage: AnalysisUsage;
}

export class AnalysisProviderError extends Error {
  constructor(
    message: string,
    /** True when the caller may retry (rate limit, transient network). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AnalysisProviderError';
  }
}

export interface DocumentAnalysisProvider {
  analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysisResult>;
}
