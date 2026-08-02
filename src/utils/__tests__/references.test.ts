import { isPlausibleReference, looksLikeAmount, looksLikeUkPhoneNumber, normaliseReference } from '../references';

describe('normaliseReference', () => {
  it('uppercases and strips separators', () => {
    expect(normaliseReference('hi-2244 6688')).toBe('HI22446688');
    expect(normaliseReference('av 123 456 78')).toBe('AV12345678');
  });
});

describe('looksLikeUkPhoneNumber', () => {
  it('detects common UK formats', () => {
    expect(looksLikeUkPhoneNumber('0800 000 0000')).toBe(true);
    expect(looksLikeUkPhoneNumber('07700 900123')).toBe(true);
    expect(looksLikeUkPhoneNumber('+44 7700 900123')).toBe(true);
    expect(looksLikeUkPhoneNumber('(0100) 000-0001')).toBe(true);
  });
  it('rejects references', () => {
    expect(looksLikeUkPhoneNumber('AV12345678')).toBe(false);
    expect(looksLikeUkPhoneNumber('55511122')).toBe(false);
  });
});

describe('isPlausibleReference', () => {
  it('accepts realistic references', () => {
    expect(isPlausibleReference('AV12345678')).toBe(true);
    expect(isPlausibleReference('HI-2244-6688')).toBe(true);
    expect(isPlausibleReference('WR-2024-1105')).toBe(true);
    expect(isPlausibleReference('QQ123456C')).toBe(true); // NI-style
  });
  it('rejects phone numbers, amounts, and junk', () => {
    expect(isPlausibleReference('0800 000 0000')).toBe(false);
    expect(isPlausibleReference('£342.18')).toBe(false);
    expect(isPlausibleReference('1,845.60')).toBe(false);
    expect(isPlausibleReference('ab')).toBe(false);
    expect(isPlausibleReference('')).toBe(false);
    expect(isPlausibleReference(null)).toBe(false);
  });
  it('amount detection sanity', () => {
    expect(looksLikeAmount('£342.18')).toBe(true);
    expect(looksLikeAmount('AV12345678')).toBe(false);
  });
});
