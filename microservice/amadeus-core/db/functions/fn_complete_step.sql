-- Atomic write path for services/transactions.ts completeStep(). All business-rule
-- validation (transition legality, financial gating, company/type checks — see
-- src/config/stepFlows.ts) happens in TypeScript BEFORE this is called; this function
-- only owns idempotency check + optimistic-lock update + event insert as one round trip.
CREATE OR REPLACE FUNCTION fn_complete_step(
  p_transaction_id   UUID,
  p_expected_version INT,
  p_new_step         TEXT,
  p_new_status       TEXT,
  p_actor            TEXT,
  p_reason           TEXT,
  p_idempotency_key  TEXT,
  p_payload          JSONB,
  p_financial        BOOLEAN
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
  SELECT * INTO v_existing_event
    FROM transaction_events
   WHERE transaction_id = p_transaction_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RETURN QUERY SELECT
      v_tx.id, v_tx.type, v_tx.current_step, v_tx.status, v_tx.company_id, v_tx.version,
      v_tx.created_at, v_tx.updated_at,
      v_existing_event.id, v_existing_event.step, v_existing_event.status, v_existing_event.actor,
      v_existing_event.reason, v_existing_event.idempotency_key, v_existing_event.payload,
      v_existing_event.signed, v_existing_event.created_at,
      TRUE;
    RETURN;
  END IF;

  UPDATE transactions
     SET current_step = p_new_step,
         status       = p_new_status,
         version      = version + 1,
         updated_at   = now()
   WHERE id = p_transaction_id
     AND version = p_expected_version
  RETURNING * INTO v_tx;

  IF NOT FOUND THEN
    PERFORM 1 FROM transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
    ELSE
      RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  INSERT INTO transaction_events
    (transaction_id, step, status, actor, reason, idempotency_key, payload, signed)
  VALUES
    (p_transaction_id, p_new_step, 'completed', p_actor, p_reason, p_idempotency_key, p_payload, p_financial)
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
