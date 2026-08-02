import { AnswerCitation, confidenceNote, dedupeCitations, formatCitation } from '../citations';

const base: AnswerCitation = {
  documentId: 'doc-1',
  title: 'Aviva Annual Statement',
  provider: 'Aviva',
  documentDate: '2026-06-14',
  pageNumber: 1,
  quote: 'Your pension number: AV12345678',
};

describe('formatCitation', () => {
  it('matches the product answer format', () => {
    expect(formatCitation(base)).toBe('Source: Aviva Annual Statement, dated 14 June 2026, page 1.');
  });
  it('omits missing date and page gracefully', () => {
    expect(formatCitation({ ...base, documentDate: null, pageNumber: null })).toBe('Source: Aviva Annual Statement.');
    expect(formatCitation({ ...base, pageNumber: null })).toBe('Source: Aviva Annual Statement, dated 14 June 2026.');
  });
});

describe('dedupeCitations', () => {
  it('removes duplicates of the same document+page but keeps distinct pages', () => {
    const result = dedupeCitations([base, { ...base, quote: 'other' }, { ...base, pageNumber: 2 }]);
    expect(result).toHaveLength(2);
  });
});

describe('confidenceNote', () => {
  it('is silent for high confidence and warns otherwise', () => {
    expect(confidenceNote('high')).toBeNull();
    expect(confidenceNote('medium')).toContain('check');
    expect(confidenceNote('low')).toContain('verify');
  });
});
