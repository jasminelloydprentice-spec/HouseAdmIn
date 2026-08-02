import { DocumentAnalysis, validateAnalysis } from '../schema';

function validAnalysis(): DocumentAnalysis {
  return {
    title: 'Aviva annual pension statement',
    provider: 'Aviva',
    category: 'pensions',
    doc_type: 'Annual pension statement',
    document_date: '2026-06-14',
    received_date: null,
    people: ['Jasmine Example'],
    address: null,
    summary: 'An annual pension statement showing the plan value.',
    action_required: null,
    deadline_date: null,
    renewal_date: null,
    expiry_date: null,
    appointment_at: null,
    contact_phone: '0800 000 0000',
    contact_email: null,
    keywords: ['pension', 'aviva'],
    is_important: true,
    supersedes_hint: null,
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
    ],
    pages: [{ page_number: 1, text: 'Your pension number: AV12345678', is_unreadable: false }],
  };
}

describe('documentAnalysisSchema', () => {
  it('accepts a fully valid analysis', () => {
    const result = validateAnalysis(validAnalysis());
    expect(result.ok).toBe(true);
  });

  it('accepts nulls for absent data — null over guessing', () => {
    const a = validAnalysis();
    a.title = null;
    a.provider = null;
    a.category = null;
    a.summary = null;
    expect(validateAnalysis(a).ok).toBe(true);
  });

  it('rejects unknown top-level keys (injection cannot smuggle data)', () => {
    const a = { ...validAnalysis(), grant_access: true };
    const result = validateAnalysis(a);
    expect(result.ok).toBe(false);
  });

  it('rejects non-ISO dates', () => {
    const a = validAnalysis();
    a.document_date = '14/06/2026' as never;
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('rejects impossible dates', () => {
    const a = validAnalysis();
    a.renewal_date = '2026-02-30' as never;
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    const a = validAnalysis();
    a.overall_confidence = 1.5;
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('rejects invalid category slugs', () => {
    const a = validAnalysis();
    a.category = 'crypto_investments' as never;
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('rejects fields whose value does not match their kind', () => {
    const a = validAnalysis();
    a.fields[0] = { ...a.fields[0], kind: 'date', value_date: null };
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('rejects malformed field keys', () => {
    const a = validAnalysis();
    a.fields[0] = { ...a.fields[0], key: 'Pension Number!' };
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('requires at least one page', () => {
    const a = validAnalysis();
    a.pages = [];
    expect(validateAnalysis(a).ok).toBe(false);
  });

  it('reports readable error paths', () => {
    const a = validAnalysis();
    a.overall_confidence = 2;
    const result = validateAnalysis(a);
    if (result.ok) throw new Error('expected failure');
    expect(result.errors.some((e) => e.includes('overall_confidence'))).toBe(true);
  });
});
