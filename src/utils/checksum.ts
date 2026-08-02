/** Hex encoding + duplicate helpers. Hashing itself uses expo-crypto at the call site. */

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** SHA-256 hex checksums are 64 lowercase hex chars. */
export function isValidChecksum(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/**
 * Duplicate detection: same checksum within the same household means the
 * same original bytes were uploaded before.
 */
export function findDuplicate<T extends { id: string; checksum: string | null }>(
  checksum: string | null,
  existing: T[],
): T | null {
  if (!isValidChecksum(checksum)) return null;
  return existing.find((d) => d.checksum === checksum) ?? null;
}
