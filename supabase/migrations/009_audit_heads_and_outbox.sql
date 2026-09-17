-- DarbarTech Certificate System — Audit Concurrency & Durability
-- V2 §10/§11 (P0): concurrent audit writes must not fork the hash chain, and
-- critical lifecycle events must never silently disappear.

-- 1) Deterministic verification: jsonb does not preserve key order on read, so
--    the exact text that was hashed is retained alongside the parsed object.
ALTER TABLE certificate_events
    ADD COLUMN IF NOT EXISTS metadata_canonical TEXT;

-- 2) One head row per certificate. `append_audit_event` locks it FOR UPDATE,
--    so two concurrent writers serialize and each event gets exactly one
--    predecessor. The application computes the hash (single hashing source of
--    truth) and passes its expected predecessor; on conflict the RPC declines
--    and returns the actual predecessor so the caller can re-chain and retry.
CREATE TABLE IF NOT EXISTS certificate_audit_heads (
    certificate_id UUID PRIMARY KEY REFERENCES certificates(id) ON DELETE CASCADE,
    last_event_hash TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION append_audit_event(
    p_id UUID,
    p_certificate_id UUID,
    p_event_type TEXT,
    p_actor_id TEXT,
    p_created_at TIMESTAMPTZ,
    p_metadata JSONB,
    p_metadata_canonical TEXT,
    p_expected_previous TEXT,
    p_event_hash TEXT,
    p_request_id TEXT,
    p_ip TEXT,
    p_user_agent TEXT
) RETURNS JSONB AS $$
DECLARE
    v_previous TEXT;
    v_version BIGINT;
BEGIN
    INSERT INTO certificate_audit_heads (certificate_id, last_event_hash, version, updated_at)
    VALUES (p_certificate_id, NULL, 0, now())
    ON CONFLICT (certificate_id) DO NOTHING;

    SELECT last_event_hash, version
    INTO v_previous, v_version
    FROM certificate_audit_heads
    WHERE certificate_id = p_certificate_id
    FOR UPDATE;

    IF COALESCE(v_previous, '') <> COALESCE(p_expected_previous, '') THEN
        -- Someone appended since we read the head. Report the real predecessor.
        RETURN jsonb_build_object(
            'ok', false,
            'previous_event_hash', v_previous,
            'version', v_version
        );
    END IF;

    INSERT INTO certificate_events (
        id, certificate_id, event_type, actor_id, metadata, metadata_canonical,
        created_at, previous_event_hash, event_hash, request_id, ip_address, user_agent
    ) VALUES (
        p_id, p_certificate_id, p_event_type, p_actor_id, p_metadata, p_metadata_canonical,
        p_created_at, v_previous, p_event_hash, p_request_id, p_ip, p_user_agent
    );

    UPDATE certificate_audit_heads
    SET last_event_hash = p_event_hash,
        version = v_version + 1,
        updated_at = now()
    WHERE certificate_id = p_certificate_id;

    RETURN jsonb_build_object(
        'ok', true,
        'previous_event_hash', v_previous,
        'version', v_version + 1
    );
END;
$$ LANGUAGE plpgsql;

-- 3) Durable outbox (§11). When the head-locked append cannot be completed
--    (total outage), a critical event is written here first and drained by the
--    background processor, so a state change never loses its audit record.
CREATE TABLE IF NOT EXISTS certificate_event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_certificate_event_outbox_pending
    ON certificate_event_outbox (created_at)
    WHERE processed_at IS NULL;

ALTER TABLE certificate_event_outbox ENABLE ROW LEVEL SECURITY;

-- Enqueue is a plain insert; the unique id inside `payload` makes retries
-- idempotent (a duplicate id is ignored).
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_event_outbox_event_id
    ON certificate_event_outbox ((payload->>'id'));
