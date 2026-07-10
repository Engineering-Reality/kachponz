import argon2 from 'argon2';
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Kriptografi terpusat.
 *
 * CISO refs:
 *  - Code Review #30: AES-256, bukan RC4/MD5; no insecure RNG (pakai crypto.randomBytes).
 *  - Code Review #34/#37 (APP_TI): credential disimpan terenkripsi/hash, tidak plaintext.
 *  - API #10: Symmetric Signature HMAC_SHA512; AES-256.
 *  - API #2: 2FA signature untuk API transaksi finansial.
 */

// ---------- API key / secret hashing (argon2id) ----------

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export async function hashSecret(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS);
}

export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// ---------- Random key generation ----------

/** 32-byte random, base64url — untuk API key robot (pola AWS/Stripe). */
export function generateApiKey(): string {
  return randomBytes(32).toString('base64url');
}

/** Secret untuk signing HMAC per-robot (financial layer). */
export function generateSigningSecret(): string {
  return randomBytes(32).toString('base64url');
}

// ---------- HMAC-SHA512 signature (financial 2FA layer) ----------

/**
 * Canonical string yang ditandatangani:
 *   METHOD \n PATH \n X-Robot-Timestamp \n sha256(body)
 * Timestamp mencegah replay (dicek terhadap SIGNATURE_MAX_SKEW_SEC).
 */
export function buildSignaturePayload(params: {
  method: string;
  path: string;
  timestamp: string;
  bodySha256Hex: string;
}): string {
  return [params.method.toUpperCase(), params.path, params.timestamp, params.bodySha256Hex].join(
    '\n',
  );
}

export function hmacSha512Hex(secret: string, payload: string): string {
  const h = createHmac('sha512', env.SIGNATURE_PEPPER ? `${secret}:${env.SIGNATURE_PEPPER}` : secret);
  h.update(payload, 'utf8');
  return h.digest('hex');
}

/** Bandingkan dua signature hex dengan timing-safe compare. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

// ---------- AES-256-GCM (payload at-rest bila diperlukan) ----------

/**
 * Enkripsi AES-256-GCM. Key harus 32 byte. Mengembalikan
 * base64(iv).base64(tag).base64(ciphertext). Dipakai bila payload jsonb perlu
 * disimpan terenkripsi (CISO Kriptografi #70 APP_TI: kerahasiaan data tersimpan).
 */
export function aesGcmEncrypt(key: Buffer, plaintext: string): string {
  if (key.length !== 32) throw new Error('AES-256 key harus 32 byte');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function aesGcmDecrypt(key: Buffer, packed: string): string {
  if (key.length !== 32) throw new Error('AES-256 key harus 32 byte');
  const [ivB64, tagB64, dataB64] = packed.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('format ciphertext tidak valid');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
