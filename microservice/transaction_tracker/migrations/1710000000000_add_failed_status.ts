import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Menambahkan batasan (CHECK) untuk memformalkan "enum" status pada transaction_events,
  // termasuk status 'failed' untuk retry/kompensasi (P1).
  pgm.addConstraint('transaction_events', 'chk_transaction_events_status', {
    check: "status IN ('created', 'completed', 'failed')",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('transaction_events', 'chk_transaction_events_status');
}
