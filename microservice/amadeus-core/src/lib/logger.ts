import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Structured logging (Pino).
 *
 * CISO Code Security Review:
 *  - #15 Sanitasi/validasi data yang masuk log.
 *  - #24 Session id tidak di-expose di log.
 *  - #34/#35 Password/credential/connection string tidak masuk log.
 * Redaksi di bawah menyensor field sensitif otomatis di seluruh child logger.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers["x-robot-key"]',
      'req.headers["x-signature"]',
      'req.headers.authorization',
      'apiKey',
      'api_key',
      'signing_secret',
      'password',
      'connectionString',
      'DATABASE_URL',
      '*.api_key_hash',
      '*.signing_secret_hash',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Child logger dengan correlation id transaksi. */
export function txLogger(transactionId: string) {
  return logger.child({ transaction_id: transactionId });
}
