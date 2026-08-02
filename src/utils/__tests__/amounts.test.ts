import { formatAmount, parseAmount } from '../amounts';

describe('parseAmount', () => {
  it('parses plain and formatted amounts', () => {
    expect(parseAmount('1234')).toBe(1234);
    expect(parseAmount('£1,234.56')).toBe(1234.56);
    expect(parseAmount('GBP 342.18')).toBe(342.18);
    expect(parseAmount(' £ 48,210.55 ')).toBe(48210.55);
  });
  it('handles negatives and parenthesised negatives', () => {
    expect(parseAmount('-12.50')).toBe(-12.5);
    expect(parseAmount('(12.50)')).toBe(-12.5);
  });
  it('returns null for ambiguity rather than guessing', () => {
    expect(parseAmount('12.345')).toBeNull(); // three decimal places
    expect(parseAmount('about £100')).toBeNull();
    expect(parseAmount('12.5k')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe('formatAmount', () => {
  it('formats GBP UK-style', () => {
    expect(formatAmount(1234.5)).toBe('£1,234.50');
    expect(formatAmount(0)).toBe('£0.00');
  });
  it('falls back for invalid values', () => {
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount(Number.NaN)).toBe('—');
  });
});
