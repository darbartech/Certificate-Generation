-- DarbarTech Certificate System Schema v5 — Production Hardening (Phase 2)
-- Covers: revocation category (leading hardening §16/§17), verification-token
-- hashing at rest (§12), one-default-secondary-signatory uniqueness (§21) and
-- a transactional course+module update RPC (§18).

-- 1) Internal revocation bookkeeping. revocation_reason stays internal (never
--    exposed on the public verification API); a stable category is stored so
--    revocation reporting never depends on free-text.
ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS revocation_category TEXT;

-- 2) Verification-token hashes (§12). The public link carries the raw token;
--    the DB stores SHA-256(token) so a database compromise does not reveal
--    working verification links. Zero-downtime compatible: add column, backfill
--    from the existing raw column, code then writes both (raw retained for
--    legacy admin flows). Lookups go through the hash column.
ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;

UPDATE certificates
SET verification_token_hash = encode(
    sha256(convert_to(verification_token, 'UTF8')),
    'hex'
)
WHERE verification_token IS NOT NULL
  AND verification_token <> ''
  AND (verification_token_hash IS NULL OR verification_token_hash = '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_verification_token_hash
    ON certificates (verification_token_hash)
    WHERE verification_token_hash IS NOT NULL;

-- 3) Database-enforced invariant (§21): at most one signatory may be the
--    default secondary. Application logic also validates, but the schema is
--    the source of truth.
CREATE UNIQUE INDEX IF NOT EXISTS one_default_secondary_signatory
    ON signatories (is_default_secondary)
    WHERE is_default_secondary = TRUE;

-- 4) Transactional course save (§18). The admin course editor replaces a
--    course's field values AND its module grid at once; previously that was
--    DELETE-then-INSERT outside a transaction, so a mid-way failure left the
--    course with its new fields but an empty module set. This RPC is a single
--    BEGIN/COMMIT unit: any failure rolls back everything.
CREATE OR REPLACE FUNCTION update_course_with_modules(
    p_course_id UUID,
    p_fields JSONB,
    p_modules JSONB
) RETURNS boolean AS $$
DECLARE
    v_mod JSONB;
BEGIN
    UPDATE courses
    SET code = COALESCE(p_fields->>'code', code),
        title = COALESCE(p_fields->>'title', title),
        duration = COALESCE(p_fields->>'duration', duration),
        active = (CASE WHEN p_fields ? 'active' THEN (p_fields->>'active')::boolean ELSE active END),
        certificate_title = COALESCE(p_fields->>'certificate_title', certificate_title),
        certificate_template_id = COALESCE(p_fields->>'certificate_template_id', certificate_template_id),
        certificate_template_version = COALESCE(p_fields->>'certificate_template_version', certificate_template_version),
        provider_name = COALESCE(p_fields->>'provider_name', provider_name),
        completion_statement = COALESCE(p_fields->>'completion_statement', completion_statement),
        updated_at = NOW()
    WHERE id = p_course_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF p_modules IS NOT NULL AND jsonb_array_length(p_modules) >= 0 THEN
        DELETE FROM course_modules WHERE course_id = p_course_id;

        FOR v_mod IN SELECT * FROM jsonb_array_elements(p_modules) LOOP
            INSERT INTO course_modules (course_id, sort_order, title, subtitle, active)
            VALUES (
                p_course_id,
                (v_mod->>'order')::int,
                COALESCE(v_mod->>'title', ''),
                COALESCE(v_mod->>'subtitle', NULL),
                COALESCE((v_mod->>'active')::boolean, true)
            );
        END LOOP;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;