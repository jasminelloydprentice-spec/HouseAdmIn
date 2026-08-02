/**
 * Reference-number helpers: policy numbers, account numbers, NI numbers etc.
 * These normalise for search and sanity-check that a value plausibly *is* a
 * reference rather than a phone number or an amount.
 */

/** Normalise a reference for comparison/search: uppercase, strip spaces and hyphens. */
export function normaliseReference(value: string): string {
  return value.toUpperCase().replace(/[\s\-–]/g, '');
}

/** UK phone numbers: 07/01/02/03/08/09 prefixes or +44, 10–11 digits. */
export function looksLikeUkPhoneNumber(value: string): boolean {
  const digits = value.replace(/[\s\-()]/g, '');
  if (/^\+44\d{9,10}$/.test(digits)) return true;
  return /^0[123789]\d{8,9}$/.test(digits);
}

/** Monetary-looking strings should not be stored as references. */
export function looksLikeAmount(value: string): boolean {
  return /^[£$€]?\s?-?[\d,]+(\.\d{1,2})?$/.test(value.trim()) && /\d/.test(value);
}

/**
 * A plausible document reference: 4–30 chars after normalisation, contains a
 * digit or is a known letter-format (e.g. NI number), and is neither a phone
 * number nor a bare amount.
 */
export function isPlausibleReference(value: string | null | undefined): boolean {
  if (!value) return false;
  const norm = normaliseReference(value.trim());
  if (norm.length < 4 || norm.length > 30) return false;
  if (looksLikeUkPhoneNumber(value)) return false;
  if (looksLikeAmount(value)) return false;
  return /\d/.test(norm) || /^[A-Z]{2}\d{6}[A-Z]$/.test(norm);
}
