import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * users: human login (admin dashboard), terpisah dari service_accounts (robot).
 * user_companies/roles sudah ada di DB (dibuat via migrate_supabase.ts, di luar
 * migration history) tapi user_companies.user_id belum punya FK karena tabel
 * users belum ada — tambahkan sekarang, aman karena user_companies masih kosong.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('users', {
    user_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true },
    password_hash: { type: 'text', notNull: true },
    display_name: { type: 'text', notNull: false },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    disabled_at: { type: 'timestamptz', notNull: false },
  });
  // createIndex's typings only accept plain column names, not expressions —
  // use raw SQL for the functional (lower(email)) unique index.
  pgm.sql('CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));');

  pgm.addConstraint('user_companies', 'user_companies_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(user_id)',
      onDelete: 'CASCADE',
    },
  });

  // roles sudah berisi baris (super admin/admin/staff/guest) — jangan asumsikan
  // role_id tertentu, cukup pastikan 'admin' ada.
  pgm.sql(`
    INSERT INTO roles (role_id, role_name, description)
    SELECT COALESCE((SELECT MAX(role_id) FROM roles), 0) + 1, 'admin', 'Full company administrative access'
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'admin');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('user_companies', 'user_companies_user_id_fkey');
  pgm.dropTable('users'); // uq_users_email_lower dropped automatically with the table
}
