import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ---- a2a_tasks ----
  pgm.createTable('a2a_tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    transaction_id: {
      type: 'uuid',
      notNull: true,
      references: 'transactions',
      onDelete: 'RESTRICT',
    },
    step: { type: 'text', notNull: true },
    state: { type: 'text', notNull: true },
    submitted_by: { type: 'text', notNull: true },
    assignee_hint: { type: 'text', notNull: false },
    correlation_id: { type: 'text', notNull: true },
    input_required_msg: { type: 'text', notNull: false },
    result_data: { type: 'jsonb', notNull: false },
    fail_reason: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('a2a_tasks', 'chk_a2a_tasks_state', {
    check: "state IN ('submitted','working','input_required','completed','failed','canceled')"
  });

  pgm.createIndex('a2a_tasks', 'transaction_id');
  pgm.createIndex('a2a_tasks', 'state', { where: "state IN ('submitted','working','input_required')" });

  // ---- a2a_task_messages ----
  pgm.createTable('a2a_task_messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: {
      type: 'uuid',
      notNull: true,
      references: 'a2a_tasks',
      onDelete: 'CASCADE',
    },
    seq: { type: 'integer', notNull: true },
    role: { type: 'text', notNull: true },
    message_type: { type: 'text', notNull: true },
    content: { type: 'jsonb', notNull: true },
    signature: { type: 'text', notNull: false }, // HMAC hex
    sent_at: { type: 'timestamptz', notNull: true },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('a2a_task_messages', 'chk_a2a_task_messages_role', {
    check: "role IN ('client','agent')"
  });
  
  pgm.createConstraint('a2a_task_messages', 'uq_a2a_task_messages_seq', {
    unique: ['task_id', 'seq']
  });

  pgm.createIndex('a2a_task_messages', ['task_id', 'seq']);

  // Immutability trigger for a2a_task_messages
  pgm.sql(`
    CREATE TRIGGER trg_a2atxevents_no_update
      BEFORE UPDATE OR DELETE ON a2a_task_messages
      FOR EACH ROW EXECUTE FUNCTION amadeus_block_mutation();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS trg_a2atxevents_no_update ON a2a_task_messages;');
  pgm.dropTable('a2a_task_messages');
  pgm.dropTable('a2a_tasks');
}
