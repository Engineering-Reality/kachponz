-- Atomic write path for services/transactions.ts failStep(). Unlike fn_complete_step,
-- failing a step never advances current_step/version — it only records an audit event.
-- Business-rule validation (step-match, company/type checks) happens in TypeScript first.
CREATE OR REPLACE FUNCTION fn_fail_step(
  p_transaction_id   UUID,
  p_step             TEXT,
  p_actor            TEXT,
  p_reason           TEXT,
  p_idempotency_key  TEXT,
  p_payload          JSONB
)
RETURNS TABLE (
  out_tx_id                 UUID,
  out_tx_type                TEXT,
  out_tx_current_step        TEXT,
  out_tx_status               TEXT,
  out_tx_company_id           UUID,
  out_tx_version               INT,
  out_tx_created_at            TIMESTAMPTZ,
  out_tx_updated_at            TIMESTAMPTZ,
  out_event_id                 UUID,
  out_event_step               TEXT,
  out_event_status             TEXT,
  out_event_actor              TEXT,
  out_event_reason             TEXT,
  out_event_idempotency_key    TEXT,
  out_event_payload            JSONB,
  out_event_signed             BOOLEAN,
  out_event_created_at         TIMESTAMPTZ,
  out_idempotent_replay        BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_event transaction_events%ROWTYPE;
  v_tx transactions%ROWTYPE;
  v_event transaction_events%ROWTYPE;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing_event
    FROM transaction_events
   WHERE transaction_id = p_transaction_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_tx.id, v_tx.type, v_tx.current_step, v_tx.status, v_tx.company_id, v_tx.version,
      v_tx.created_at, v_tx.updated_at,
      v_existing_event.id, v_existing_event.step, v_existing_event.status, v_existing_event.actor,
      v_existing_event.reason, v_existing_event.idempotency_key, v_existing_event.payload,
      v_existing_event.signed, v_existing_event.created_at,
      TRUE;
    RETURN;
  END IF;

  INSERT INTO transaction_events
    (transaction_id, step, status, actor, reason, idempotency_key, payload, signed)
  VALUES
    (p_transaction_id, p_step, 'failed', p_actor, p_reason, p_idempotency_key, p_payload, FALSE)
  RETURNING * INTO v_event;

  RETURN QUERY SELECT
    v_tx.id, v_tx.type, v_tx.current_step, v_tx.status, v_tx.company_id, v_tx.version,
    v_tx.created_at, v_tx.updated_at,
    v_event.id, v_event.step, v_event.status, v_event.actor,
    v_event.reason, v_event.idempotency_key, v_event.payload,
    v_event.signed, v_event.created_at,
    FALSE;
END;
$$;
