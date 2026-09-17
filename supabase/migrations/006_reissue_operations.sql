-- DarbarTech Certificate System — Reissue Idempotency & Transactional Finalize
-- V2 §13/§14 (P0): a browser retry or double-click must not mint a second
-- replacement certificate. Each reissue is recorded under a unique
-- idempotency key, and the supersede + relationship updates commit atomically.

CREATE TABLE IF NOT EXISTS reissue_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    original_certificate_id UUID NOT NULL REFERENCES certificates(id),
    replacement_certificate_id UUID REFERENCES certificates(id),
    requested_by TEXT,
    status TEXT NOT NULL DEFAULT 'REISSUING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT reissue_operations_status_check CHECK (
        status IN (
            'REISSUE_REQUESTED',
            'REISSUING',
            'REPLACEMENT_CREATED',
            'ORIGINAL_SUPERSEDED',
            'COMPLETED',
            'REISSUE_FAILED'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_reissue_operations_original
    ON reissue_operations(original_certificate_id);
CREATE INDEX IF NOT EXISTS idx_reissue_operations_status
    ON reissue_operations(status);

ALTER TABLE reissue_operations ENABLE ROW LEVEL SECURITY;

-- Atomic finalize (§13). Runs in the caller's transaction: it either supersedes
-- the original, links the replacement and completes the operation together, or
-- raises and rolls all of it back. Locking the original row prevents two
-- concurrent reissues from both superseding the same certificate.
CREATE OR REPLACE FUNCTION finalize_reissue(
    p_operation_id UUID,
    p_original_id UUID,
    p_replacement_id UUID
) RETURNS VOID AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM certificates
    WHERE id = p_original_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Original certificate % not found', p_original_id;
    END IF;

    IF v_status NOT IN ('ISSUED', 'REISSUED') THEN
        RAISE EXCEPTION 'Original certificate % is not supersedable (status %)',
            p_original_id, v_status;
    END IF;

    UPDATE certificates
    SET status = 'SUPERSEDED',
        superseded_at = NOW(),
        superseded_by_id = p_replacement_id,
        updated_at = NOW()
    WHERE id = p_original_id;

    UPDATE certificates
    SET reissued_from_id = p_original_id,
        updated_at = NOW()
    WHERE id = p_replacement_id;

    IF p_operation_id IS NOT NULL THEN
        UPDATE reissue_operations
        SET status = 'COMPLETED',
            replacement_certificate_id = p_replacement_id,
            completed_at = NOW()
        WHERE id = p_operation_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
