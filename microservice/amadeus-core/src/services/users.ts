import type pg from 'pg';
import { query } from '../db/pool.js';

export interface UserAccount {
  user_id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  is_active: boolean;
}

export interface UserCompanyRole {
  companyId: string;
  roleId: number | null;
  roleName: string | null;
}

export async function findActiveUserByEmail(email: string): Promise<UserAccount | null> {
  const res = await query<UserAccount>(
    `SELECT user_id, email, password_hash, display_name, is_active
       FROM users
      WHERE lower(email) = lower($1) AND is_active = true`,
    [email],
  );
  return res.rows[0] ?? null;
}

/** MVP: satu user hanya di satu company (ambil baris pertama). */
export async function findUserCompanyAndRole(userId: string): Promise<UserCompanyRole | null> {
  const res = await query<{ company_id: string; role_id: number | null; role_name: string | null }>(
    `SELECT uc.company_id, uc.role_id, r.role_name
       FROM user_companies uc
       LEFT JOIN roles r ON r.role_id = uc.role_id
      WHERE uc.user_id = $1
      LIMIT 1`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { companyId: row.company_id, roleId: row.role_id, roleName: row.role_name };
}

/** Dipakai CLI registrasi (scripts/registerUser.ts). */
export async function activeUserEmailExists(email: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS(
        SELECT 1 FROM users WHERE lower(email) = lower($1) AND is_active = true
     ) AS exists`,
    [email],
  );
  return res.rows[0]?.exists === true;
}

export async function insertUser(
  client: pg.PoolClient,
  params: { email: string; passwordHash: string; displayName: string | null },
): Promise<string> {
  const res = await client.query<{ user_id: string }>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING user_id`,
    [params.email, params.passwordHash, params.displayName],
  );
  const id = res.rows[0]?.user_id;
  if (!id) throw new Error('gagal insert user');
  return id;
}

export async function assignUserToCompany(
  client: pg.PoolClient,
  params: { userId: string; companyId: string; roleId: number | null },
): Promise<void> {
  await client.query(
    `INSERT INTO user_companies (user_id, company_id, role_id) VALUES ($1, $2, $3)`,
    [params.userId, params.companyId, params.roleId],
  );
}

/** Dipakai canShareResource() (lib/sharing.ts) untuk cek keanggotaan email di share_editor_with/share_visitor_with — daftar itu berisi email, bukan user_id. */
export async function findUserEmailById(userId: string): Promise<string | null> {
  const res = await query<{ email: string }>(
    `SELECT email FROM users WHERE user_id = $1 AND is_active = true`,
    [userId],
  );
  return res.rows[0]?.email ?? null;
}

export async function findRoleIdByName(roleName: string): Promise<number | null> {
  const res = await query<{ role_id: number }>(
    `SELECT role_id FROM roles WHERE role_name = $1 LIMIT 1`,
    [roleName],
  );
  return res.rows[0]?.role_id ?? null;
}
