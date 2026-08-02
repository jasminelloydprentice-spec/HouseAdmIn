import { formatUkDate } from '../../utils/dates';

export interface AnswerCitation {
  documentId: string;
  title: string;
  provider: string | null;
  documentDate: string | null;
  pageNumber: number | null;
  quote: string | null;
}

export interface AssistantAnswer {
  answer: string;
  citations: AnswerCitation[];
  notFound: boolean;
  confidence: 'high' | 'medium' | 'low';
  conversationId: string | null;
}

/**
 * Human citation line, e.g.
 * "Source: Aviva Annual Statement, dated 14 June 2026, page 1."
 */
export function formatCitation(citation: AnswerCitation): string {
  const parts = [`Source: ${citation.title}`];
  if (citation.documentDate) parts.push(`dated ${formatUkDate(citation.documentDate)}`);
  if (citation.pageNumber) parts.push(`page ${citation.pageNumber}`);
  return `${parts.join(', ')}.`;
}

/** De-duplicate citations pointing at the same document+page. */
export function dedupeCitations(citations: AnswerCitation[]): AnswerCitation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.documentId}:${c.pageNumber ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function confidenceNote(confidence: AssistantAnswer['confidence']): string | null {
  switch (confidence) {
    case 'high':
      return null;
    case 'medium':
      return 'Some of this was read automatically — check the original document for anything critical.';
    case 'low':
      return 'Low confidence: the source text was hard to read. Please verify against the original document.';
  }
}
