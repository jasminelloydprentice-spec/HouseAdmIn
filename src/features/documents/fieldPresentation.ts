import { DocumentFieldRow } from './types';
import { formatAmount } from '../../utils/amounts';
import { formatUkDate } from '../../utils/dates';

/** Human value for a typed field row. */
export function fieldDisplayValue(field: DocumentFieldRow): string {
  if (field.value_date) return formatUkDate(field.value_date);
  if (field.value_number !== null && field.value_number !== undefined) {
    return field.currency ? formatAmount(Number(field.value_number), field.currency) : String(field.value_number);
  }
  return field.value_text ?? '—';
}

export function provenanceLabel(source: DocumentFieldRow['source']): string {
  switch (source) {
    case 'ai':
      return 'AI extracted';
    case 'user_corrected':
      return 'Corrected by you';
    case 'manual':
      return 'Entered by you';
  }
}

/** Low-confidence AI fields get flagged in the UI. */
export function isLowConfidence(field: DocumentFieldRow): boolean {
  return field.source === 'ai' && field.confidence !== null && field.confidence < 0.7;
}

/** Sensible ordering: identifiers first, then dates, then amounts, then the rest. */
const KEY_ORDER = [
  'policy_number',
  'pension_number',
  'account_number',
  'claim_number',
  'nhs_reference',
  'reference_number',
  'document_date',
  'renewal_date',
  'expiry_date',
  'deadline',
  'appointment',
  'amount',
];

export function sortFields(fields: DocumentFieldRow[]): DocumentFieldRow[] {
  return [...fields].sort((a, b) => {
    const ai = KEY_ORDER.findIndex((k) => a.key.startsWith(k));
    const bi = KEY_ORDER.findIndex((k) => b.key.startsWith(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.label.localeCompare(b.label);
  });
}
