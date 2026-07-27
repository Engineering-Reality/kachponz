import argon2 from 'argon2';
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
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
