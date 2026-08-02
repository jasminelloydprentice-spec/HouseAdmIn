import { bytesToHex, findDuplicate, isValidChecksum } from '../checksum';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('bytesToHex', () => {
  it('encodes bytes as lowercase hex with padding', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255, 16]))).toBe('0001ff10');
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });
});

describe('isValidChecksum', () => {
  it('accepts only 64-char lowercase hex', () => {
    expect(isValidChecksum(HASH_A)).toBe(true);
    expect(isValidChecksum(HASH_A.toUpperCase())).toBe(false);
    expect(isValidChecksum('abc')).toBe(false);
    expect(isValidChecksum(null)).toBe(false);
  });
});

describe('findDuplicate', () => {
  const existing = [
    { id: '1', checksum: HASH_A },
    { id: '2', checksum: HASH_B },
    { id: '3', checksum: null },
  ];
  it('finds a matching checksum', () => {
    expect(findDuplicate(HASH_B, existing)?.id).toBe('2');
  });
  it('returns null when absent or invalid', () => {
    expect(findDuplicate('c'.repeat(64), existing)).toBeNull();
    expect(findDuplicate(null, existing)).toBeNull();
    expect(findDuplicate('not-a-hash', existing)).toBeNull();
  });
});
