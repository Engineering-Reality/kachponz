import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { env } from '../config/env.js';
import { verifySecret } from '../lib/crypto.js';
import { findActiveUserByEmail, findUserCompanyAndRole } from '../services/users.js';
import { DomainError } from '../types/domain.js';

const LoginBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

/**
 * POST /auth/login — bukan robot, ini login manusia (admin dashboard).
 * Tidak dipasang di belakang authenticateRobot (jelas, itu justru cara
 * mendapatkan kredensial). JWT yang diterbitkan berbentuk PERSIS sama
 * dengan yang diverifikasi authenticateRobot's Bearer path (lihat
 * src/middleware/auth.ts + test/auth.test.ts) — tidak perlu middleware baru.
 */
export const registerAuthRoutes: FastifyPluginAsync = async (rootApp: FastifyInstance) => {
  await rootApp.register(async (app) => {
    // Rate-limit hanya di sini — jangan bocorkan apakah email terdaftar lewat
    // brute force (CISO Code Review #18/#32 pattern, sama seperti X-Robot-Key).
    await app.register(rateLimit, {
      max: 5,
      timeWindow: '1 minute',
    });

    app.post(
      '/auth/login',
      { schema: { body: LoginBody } },
      async (request, reply) => {
        const { email, password } = request.body as z.infer<typeof LoginBody>;

        const user = await findActiveUserByEmail(email);
        if (!user) {
          throw new DomainError('UNAUTHORIZED', 'Kredensial tidak valid', 401);
        }
        const ok = await verifySecret(user.password_hash, password);
        if (!ok) {
          throw new DomainError('UNAUTHORIZED', 'Kredensial tidak valid', 401);
        }

        const membership = await findUserCompanyAndRole(user.user_id);
        if (!membership) {
          // User ada tapi belum di-assign ke company manapun — bukan
          // kesalahan kredensial, tapi tetap tidak bisa login (tidak ada
          // companyId untuk discope req.auth).
          throw new DomainError('UNAUTHORIZED', 'Akun belum ter-assign ke company manapun', 401);
        }

        if (!env.OAUTH2_JWT_SECRET) {
          throw new DomainError('UNAUTHORIZED', 'Login dinonaktifkan (OAUTH2_JWT_SECRET belum di-set)', 401);
        }
        const secret = new TextEncoder().encode(env.OAUTH2_JWT_SECRET);
        const token = await new SignJWT({
          name: user.display_name ?? user.email,
          companyId: membership.companyId,
          allowedTypes: null,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(user.user_id)
          .setIssuedAt()
          .setExpirationTime('12h')
          .sign(secret);

        return reply.code(200).send({
          token,
          user: {
            id: user.user_id,
            email: user.email,
            displayName: user.display_name,
            companyId: membership.companyId,
            role: membership.roleName,
          },
        });
      },
    );
  });
};
