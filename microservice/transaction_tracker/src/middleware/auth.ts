import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { jwtVerify } from 'jose';
import { findActiveAccountByApiKey, getSigningSecretHash } from '../services/serviceAccounts.js';
import {
  buildSignaturePayload,
  hmacSha512Hex,
  safeEqualHex,
  verifySecret,
} from '../lib/crypto.js';
import { env } from '../config/env.js';
import type { AuthContext } from '../types/domain.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const ROBOT_KEY_HEADER = 'x-robot-key';
const SIG_HEADER = 'x-signature'; // hex HMAC-SHA512
const SIG_TS_HEADER = 'x-robot-timestamp'; // unix seconds
const SIG_SECRET_HEADER = 'x-robot-signing-secret'; // hanya dikirim saat step finansial

/**
 * Layer 1 — X-Robot-Key.
 * Validasi header X-Robot-Key terhadap service_accounts (bandingkan hash argon2).
 * 401 tanpa/dengan key salah. (prompt #3, #8)
 */
export async function authenticateRobot(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Layer JWT / OAuth2 (O(1) Stateless)
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ') && env.OAUTH2_JWT_SECRET) {
    const token = authHeader.substring(7);
    try {
      const secret = new TextEncoder().encode(env.OAUTH2_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      
      req.auth = {
        serviceAccountId: payload.sub as string,
        robotName: payload.name as string,
        companyId: payload.companyId as string,
        allowedTypes: (payload.allowedTypes as string[]) ?? null,
        financiallySigned: false,
      };
      return; // Berhasil autentikasi stateless tanpa query DB
    } catch (err) {
      await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token JWT tidak valid atau kedaluwarsa' } });
      return;
    }
  }

  // Fallback: Layer X-Robot-Key
  const key = req.headers[ROBOT_KEY_HEADER];
  if (typeof key !== 'string' || key.length === 0) {
    await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Kredensial wajib disertakan (JWT atau X-Robot-Key)' } });
    return;
  }

  const acct = await findActiveAccountByApiKey(key);
  if (!acct) {
    // Pesan generik — tidak membocorkan apakah key ada/aktif. (CISO Code Review #18/#32)
    await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Kredensial tidak valid' } });
    return;
  }

  req.auth = {
    serviceAccountId: acct.id,
    robotName: acct.robot_name,
    companyId: acct.company_id,
    allowedTypes: acct.allowed_types,
    financiallySigned: false,
  };
}

/**
 * Layer 2 — Financial signature (HMAC-SHA512), opsional per-request.
 * Bila robot mengirim X-Signature + X-Robot-Timestamp (+ signing secret),
 * verifikasi dan set financiallySigned=true. Dipakai untuk step finansial.
 *
 * Anti-replay: timestamp dicek terhadap SIGNATURE_MAX_SKEW_SEC.
 * Signing secret dikirim di header sekali per request dan diverifikasi terhadap
 * signing_secret_hash (argon2) — TIDAK disimpan plaintext di DB. (CISO #37)
 *
 * Catatan desain: mengirim secret di header lalu memakainya sebagai kunci HMAC
 * memang "membuktikan kepemilikan secret" (2FA di atas X-Robot-Key). Untuk
 * hardening penuh sesuai OAuth2/mTLS lihat docs/security_compliance.md roadmap.
 */
export async function verifyFinancialSignature(
  req: FastifyRequest,
): Promise<void> {
  if (!req.auth) return; // authenticateRobot harus jalan lebih dulu

  const sig = req.headers[SIG_HEADER];
  const ts = req.headers[SIG_TS_HEADER];
  const secret = req.headers[SIG_SECRET_HEADER];
  if (typeof sig !== 'string' || typeof ts !== 'string' || typeof secret !== 'string') {
    return; // tidak ada signature → biarkan; gate finansial akan menolak bila step butuh
  }

  // Anti-replay window.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > env.SIGNATURE_MAX_SKEW_SEC) return;

  // Verifikasi secret milik service account ini.
  const secretHash = await getSigningSecretHash(req.auth.serviceAccountId);
  if (!secretHash) return;
  const secretOk = await verifySecret(secretHash, secret);
  if (!secretOk) return;

  // Hitung ulang signature dan bandingkan timing-safe.
  const rawBody =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const bodySha256 = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const payload = buildSignaturePayload({
    method: req.method,
    path: req.url.split('?')[0] ?? req.url,
    timestamp: ts,
    bodySha256Hex: bodySha256,
  });
  const expected = hmacSha512Hex(secret, payload);
  if (safeEqualHex(expected, sig)) {
    req.auth.financiallySigned = true;
  }
}
