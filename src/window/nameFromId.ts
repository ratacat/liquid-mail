import { createHash } from 'node:crypto';
import { WINDOW_ADJECTIVES, WINDOW_NOUNS } from './names';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

export function windowNameFromId(windowId: string): string {
  const digest = sha256(windowId);

  const hi = readU64BE(digest, 0);
  const adjectiveIndex = Number(hi % BigInt(WINDOW_ADJECTIVES.length));
  const nounIndex = Number((hi / BigInt(WINDOW_ADJECTIVES.length)) % BigInt(WINDOW_NOUNS.length));

  const adjective = slugToken(WINDOW_ADJECTIVES[adjectiveIndex] ?? 'window');
  const noun = slugToken(WINDOW_NOUNS[nounIndex] ?? 'id');

  const suffix = base32Suffix(digest, 8, 4);
  return `${adjective}-${noun}-${suffix}`;
}

function sha256(input: string): Uint8Array {
  return createHash('sha256').update(input).digest();
}

function readU64BE(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value = (value << 8n) | BigInt(bytes[offset + i] ?? 0);
  }
  return value;
}

function base32Suffix(bytes: Uint8Array, offset: number, length: number): string {
  // length chars = 5*length bits. Use 32 bits from the digest (enough for up to 6 chars).
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  const value = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;

  let out = '';
  for (let i = 0; i < length; i++) {
    const shift = (length - 1 - i) * 5;
    const idx = (value >>> shift) & 31;
    out += BASE32[idx] ?? 'a';
  }
  return out;
}

function slugToken(token: string): string {
  const ascii = token
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug || 'x';
}
