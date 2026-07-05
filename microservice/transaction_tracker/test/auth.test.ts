import { describe, it, expect, vi, afterEach } from 'vitest';
import { authenticateRobot } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';
import { SignJWT } from 'jose';

describe('OAuth2 / JWT Authentication', () => {
  afterEach(() => {
    env.OAUTH2_JWT_SECRET = undefined;
    vi.restoreAllMocks();
  });

  it('mengizinkan akses dengan Bearer token yang valid (stateless)', async () => {
    env.OAUTH2_JWT_SECRET = 'secret_yang_sangat_panjang_sekali_minimal_16_char';
    const secret = new TextEncoder().encode(env.OAUTH2_JWT_SECRET);
    
    // Generate valid JWT
    const token = await new SignJWT({
      name: 'RobotA',
      companyId: '123e4567-e89b-12d3-a456-426614174000',
      allowedTypes: ['import_lc']
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('999e4567-e89b-12d3-a456-426614174999')
      .sign(secret);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      auth: undefined as any,
    } as any;
    
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await authenticateRobot(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(req.auth).toBeDefined();
    expect(req.auth.serviceAccountId).toBe('999e4567-e89b-12d3-a456-426614174999');
    expect(req.auth.companyId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(req.auth.allowedTypes).toEqual(['import_lc']);
  });

  it('menolak akses bila Bearer token invalid', async () => {
    env.OAUTH2_JWT_SECRET = 'secret_yang_sangat_panjang_sekali_minimal_16_char';
    
    const req = {
      headers: { authorization: `Bearer token_palsu` },
      auth: undefined as any,
    } as any;
    
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await authenticateRobot(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'UNAUTHORIZED', message: 'Token JWT tidak valid atau kedaluwarsa' }
    });
    expect(req.auth).toBeUndefined();
  });
});
