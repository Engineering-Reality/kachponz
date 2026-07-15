import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS uipath_job_trace (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id        UUID REFERENCES agents(agent_id) ON DELETE SET NULL,
      tool_id         UUID REFERENCES tools(tool_id) ON DELETE SET NULL,
      session_label   VARCHAR,
      job_id          VARCHAR NOT NULL,
      job_key         VARCHAR,
      release_key     VARCHAR,
      process_name    VARCHAR,
      folder_id       VARCHAR,
      queue_name      VARCHAR,
      state           VARCHAR NOT NULL DEFAULT 'Pending',
      triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_polled_at  TIMESTAMPTZ,
      started_at      TIMESTAMPTZ,
      ended_at        TIMESTAMPTZ,
      info            TEXT,
      raw_last_response JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_agent ON uipath_job_trace (agent_id);
    CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_job   ON uipath_job_trace (job_id);
    CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_state ON uipath_job_trace (state);
    ALTER TABLE uipath_job_trace ADD CONSTRAINT uq_uipath_job_trace_job_id UNIQUE (job_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('uipath_job_trace');
}
