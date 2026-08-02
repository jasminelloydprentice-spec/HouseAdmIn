import { DocumentAnalysis } from './analysisSchema.ts';
import { AnalyseDocumentInput, DocumentAnalysisProvider, DocumentAnalysisResult } from './provider.ts';

/**
 * Deterministic mock provider for development (MOCK_ANALYSIS=true).
 * Returns a clearly-fictional Aviva-style pension statement so the full
 * capture → analyse → review → ask loop works without any AI API calls.
 * All data is invented; no real accounts, people or addresses.
 */
export class MockProvider implements DocumentAnalysisProvider {
  analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysisResult> {
    const pageCount = Math.max(1, input.files.filter((f) => f.pageNumber !== null).length || 1);
    const analysis: DocumentAnalysis = {
      title: 'Aviva annual pension statement (FICTIONAL DEMO)',
      provider: 'Aviva',
      category: 'pensions',
      doc_type: 'Annual pension statement',
      document_date: '2026-06-14',
      received_date: null,
      people: ['Jasmine Example'],
      address: null,
      summary:
        'FICTIONAL demo extraction: an annual statement for a personal pension. It shows the plan value and confirms no action is required. (Mock analysis — no AI was called.)',
      action_required: null,
      deadline_date: null,
      renewal_date: null,
      expiry_date: null,
      appointment_at: null,
      contact_phone: '0800 000 0000',
      contact_email: null,
      keywords: ['pension', 'aviva', 'statement', 'retirement', 'demo'],
      is_important: true,
      supersedes_hint: 'Statement says it replaces last year’s annual statement.',
      overall_confidence: 0.95,
      fields: [
        {
          key: 'pension_number',
          label: 'Pension number',
          kind: 'text',
          value_text: 'AV12345678',
          value_date: null,
          value_number: null,
          currency: null,
          confidence: 0.97,
          page_number: 1,
          evidence_text: 'Your pension number: AV12345678',
        },
        {
          key: 'pension_value',
          label: 'Current pension value',
          kind: 'amount',
          value_text: null,
          value_date: null,
          value_number: 48210.55,
          currency: 'GBP',
          confidence: 0.93,
          page_number: 1,
          evidence_text: 'Value of your plan on 1 June 2026: £48,210.55',
        },
        {
          key: 'statement_date',
          label: 'Statement date',
          kind: 'date',
          value_text: null,
          value_date: '2026-06-14',
          value_number: null,
          currency: null,
          confidence: 0.96,
          page_number: 1,
          evidence_text: 'Statement date: 14 June 2026',
        },
      ],
      pages: Array.from({ length: pageCount }, (_, i) => ({
        page_number: i + 1,
        text:
          i === 0
            ? 'FICTIONAL DEMO DOCUMENT — Aviva. Your annual pension statement. Your pension number: AV12345678. Statement date: 14 June 2026. Value of your plan on 1 June 2026: £48,210.55. You do not need to do anything. Call us on 0800 000 0000. This statement replaces last year’s annual statement.'
            : `FICTIONAL DEMO DOCUMENT — page ${i + 1} of the mock statement with supporting notes about contributions and charges.`,
        is_unreadable: false,
      })),
    };
    return Promise.resolve({
      analysis,
      usage: { inputTokens: 0, outputTokens: 0, model: 'mock' },
    });
  }
}
