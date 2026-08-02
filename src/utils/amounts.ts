/**
 * Monetary amount helpers. Amounts are stored as numeric values with a
 * currency code; display is UK style ("£1,234.56").
 */

/**
 * Parse a human monetary string ("£1,234.56", "1234", "£12.5k" is NOT
 * supported — no magnitude suffixes) into a number. Returns null for
 * anything ambiguous or non-numeric; never guesses.
 */
export function parseAmount(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.trim().replace(/£|GBP/gi, '').replace(/\s+/g, '');
  if (!cleaned) return null;
  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith('-');
  const digits = cleaned.replace(/^\(|\)$/g, '').replace(/^-/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Format a number as UK currency: 1234.5 → "£1,234.50". */
export function formatAmount(value: number | null | undefined, currency = 'GBP', fallback = '—'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
  } catch {
    return `£${value.toFixed(2)}`;
  }
}
