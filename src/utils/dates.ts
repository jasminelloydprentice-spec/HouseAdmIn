/**
 * Date helpers. Storage format is always ISO `YYYY-MM-DD` (unambiguous);
 * display format is always UK style ("14 June 2026").
 */

const UK_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a strict ISO date string; returns null for anything invalid. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject rolled-over dates like 2026-02-30
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Format an ISO date for UK display: "14 June 2026". Returns fallback for invalid input. */
export function formatUkDate(iso: string | null | undefined, fallback = '—'): string {
  const d = parseIsoDate(iso);
  if (!d) return fallback;
  return `${d.getUTCDate()} ${UK_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short UK format: "14 Jun 2026". */
export function formatUkDateShort(iso: string | null | undefined, fallback = '—'): string {
  const d = parseIsoDate(iso);
  if (!d) return fallback;
  return `${d.getUTCDate()} ${UK_MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

/** Today's date as ISO YYYY-MM-DD (local calendar day). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whole-day difference between two ISO dates (b - a), DST-safe because it
 * works in UTC day space.
 */
export function daysBetween(aIso: string, bIso: string): number | null {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Add whole days to an ISO date, returning ISO. */
export function addDaysIso(iso: string, days: number): string | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Human label for how far away a date is: "Today", "Tomorrow", "In 12 days",
 * "3 days ago". Null for invalid input.
 */
export function relativeDayLabel(iso: string, fromIso = todayIso()): string | null {
  const diff = daysBetween(fromIso, iso);
  if (diff === null) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/** True when the date is within `days` from `from` (inclusive) and not past. */
export function isWithinDays(iso: string | null | undefined, days: number, fromIso = todayIso()): boolean {
  if (!iso) return false;
  const diff = daysBetween(fromIso, iso);
  return diff !== null && diff >= 0 && diff <= days;
}

/** True when the date is strictly before `from`. */
export function isPast(iso: string | null | undefined, fromIso = todayIso()): boolean {
  if (!iso) return false;
  const diff = daysBetween(fromIso, iso);
  return diff !== null && diff < 0;
}

/**
 * Parse user-typed UK date input into ISO. Accepts "14/06/2026",
 * "14-06-2026", "14 June 2026", "14 Jun 2026" and ISO "2026-06-14".
 * Returns null for anything ambiguous or invalid — never guesses.
 */
export function parseUkDateInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    return parseIsoDate(trimmed) ? trimmed : null;
  }
  const numeric = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(trimmed);
  if (numeric) {
    const [, d, m, y] = numeric;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return parseIsoDate(iso) ? iso : null;
  }
  const worded = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (worded) {
    const [, d, monthName, y] = worded;
    const lower = monthName.toLowerCase();
    // Accept only a full month name or its exact 3-letter abbreviation —
    // "Juny" must not silently become June.
    const monthIndex = UK_MONTHS.findIndex((m) => m.toLowerCase() === lower || m.toLowerCase().slice(0, 3) === lower);
    if (monthIndex === -1) return null;
    const iso = `${y}-${String(monthIndex + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    return parseIsoDate(iso) ? iso : null;
  }
  return null;
}

/** Format a timestamp (ISO 8601 with time) for UK display: "14 June 2026, 09:30". */
export function formatUkDateTime(isoTimestamp: string | null | undefined, fallback = '—'): string {
  if (!isoTimestamp) return fallback;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return fallback;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
