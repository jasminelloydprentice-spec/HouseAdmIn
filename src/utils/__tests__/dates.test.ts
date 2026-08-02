import {
  addDaysIso,
  daysBetween,
  formatUkDate,
  formatUkDateShort,
  isPast,
  isWithinDays,
  parseIsoDate,
  parseUkDateInput,
  relativeDayLabel,
} from '../dates';

describe('parseIsoDate', () => {
  it('parses valid ISO dates', () => {
    expect(parseIsoDate('2026-06-14')?.getUTCDate()).toBe(14);
  });
  it('rejects invalid formats', () => {
    expect(parseIsoDate('14/06/2026')).toBeNull();
    expect(parseIsoDate('2026-6-14')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
  it('rejects impossible dates instead of rolling them over', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
  });
  it('accepts leap-day only in leap years', () => {
    expect(parseIsoDate('2024-02-29')).not.toBeNull();
    expect(parseIsoDate('2026-02-29')).toBeNull();
  });
});

describe('formatUkDate', () => {
  it('formats UK style', () => {
    expect(formatUkDate('2026-06-14')).toBe('14 June 2026');
    expect(formatUkDateShort('2026-06-14')).toBe('14 Jun 2026');
  });
  it('falls back for invalid input', () => {
    expect(formatUkDate('nonsense')).toBe('—');
    expect(formatUkDate(null, 'n/a')).toBe('n/a');
  });
});

describe('parseUkDateInput', () => {
  it('parses UK numeric formats day-first', () => {
    expect(parseUkDateInput('14/06/2026')).toBe('2026-06-14');
    expect(parseUkDateInput('1-2-2026')).toBe('2026-02-01');
    expect(parseUkDateInput('14.06.2026')).toBe('2026-06-14');
  });
  it('parses worded formats', () => {
    expect(parseUkDateInput('14 June 2026')).toBe('2026-06-14');
    expect(parseUkDateInput('14 Jun 2026')).toBe('2026-06-14');
    expect(parseUkDateInput('1st September 2026')).toBe('2026-09-01');
  });
  it('passes through valid ISO', () => {
    expect(parseUkDateInput('2026-06-14')).toBe('2026-06-14');
  });
  it('returns null rather than guessing', () => {
    expect(parseUkDateInput('32/01/2026')).toBeNull();
    expect(parseUkDateInput('14 Juny 2026')).toBeNull();
    expect(parseUkDateInput('soon')).toBeNull();
    expect(parseUkDateInput('')).toBeNull();
  });
});

describe('day maths', () => {
  it('daysBetween works across DST boundaries', () => {
    // UK DST starts 29 March 2026
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('addDaysIso adds correctly over month ends', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('relativeDayLabel gives friendly labels', () => {
    expect(relativeDayLabel('2026-06-14', '2026-06-14')).toBe('Today');
    expect(relativeDayLabel('2026-06-15', '2026-06-14')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-06-26', '2026-06-14')).toBe('In 12 days');
    expect(relativeDayLabel('2026-06-11', '2026-06-14')).toBe('3 days ago');
  });
  it('isWithinDays and isPast behave inclusively/exclusively', () => {
    expect(isWithinDays('2026-06-20', 30, '2026-06-14')).toBe(true);
    expect(isWithinDays('2026-08-14', 30, '2026-06-14')).toBe(false);
    expect(isWithinDays('2026-06-13', 30, '2026-06-14')).toBe(false); // past
    expect(isPast('2026-06-13', '2026-06-14')).toBe(true);
    expect(isPast('2026-06-14', '2026-06-14')).toBe(false);
  });
});
