import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('service_accounts', {
    api_key_prefix: { type: 'varchar(8)' },
  });
  pgm.createIndex('service_accounts', 'api_key_prefix');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('service_accounts', 'api_key_prefix');
  pgm.dropColumn('service_accounts', 'api_key_prefix');
}
