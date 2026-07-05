import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  hashSecret,
  verifySecret,
  generateApiKey,
  buildSignaturePayload,
  hmacSha512Hex,
  safeEqualHex,
  aesGcmEncrypt,
  aesGcmDecrypt,
} from '../src/lib/crypto.js';

describe('crypto', () => {
  it('argon2 hash/verify roundtrip; key salah ditolak', async () => {
    const key = generateApiKey();
    const hash = await hashSecret(key);
    expect(hash).not.toContain(key); // tidak plaintext
    expect(await verifySecret(hash, key)).toBe(true);
    expect(await verifySecret(hash, 'salah')).toBe(false);
  });

  it('generateApiKey menghasilkan key acak base64url 32-byte', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(a, 'base64url').length).toBe(32);
  });

  it('HMAC-SHA512 deterministik untuk payload sama, beda untuk beda', () => {
    const secret = generateApiKey();
    const p1 = buildSignaturePayload({
      method: 'POST',
      path: '/a2a',
      timestamp: '1700000000',
      bodySha256Hex: 'abc',
    });
    const s1 = hmacSha512Hex(secret, p1);
    const s2 = hmacSha512Hex(secret, p1);
    const s3 = hmacSha512Hex(secret, p1 + 'x');
    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(s3);
    expect(s1).toHaveLength(128); // sha512 hex
  });

  it('safeEqualHex benar untuk sama, false untuk beda/panjang beda', () => {
    const secret = generateApiKey();
    const sig = hmacSha512Hex(secret, 'payload');
    expect(safeEqualHex(sig, sig)).toBe(true);
    expect(safeEqualHex(sig, sig.slice(0, -2) + '00')).toBe(false);
    expect(safeEqualHex(sig, 'ff')).toBe(false);
  });

  it('AES-256-GCM encrypt/decrypt roundtrip; tamper terdeteksi', () => {
    const key = randomBytes(32);
    const packed = aesGcmEncrypt(key, 'rahasia LC settlement');
    expect(aesGcmDecrypt(key, packed)).toBe('rahasia LC settlement');
    // tamper ciphertext → auth tag gagal
    const parts = packed.split('.');
    parts[2] = Buffer.from('tampered-data').toString('base64');
    expect(() => aesGcmDecrypt(key, parts.join('.'))).toThrow();
  });
});
