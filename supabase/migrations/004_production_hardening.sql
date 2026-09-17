-- DarbarTech Certificate System — Production Hardening (Phase 1)
-- Adds artifact integrity fields, lifecycle state columns and a tamper-evident
-- audit chain. See DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING.md §9/§25/§50-51.

ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS pdf_size BIGINT,
    ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES certificates(id),
    ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_certificates_superseded_by ON certificates(superseded_by_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issue_date ON certificates(issue_date);

ALTER TABLE certificate_events
    ADD COLUMN IF NOT EXISTS previous_event_hash TEXT,
    ADD COLUMN IF NOT EXISTS event_hash TEXT,
    ADD COLUMN IF NOT EXISTS request_id TEXT,
    ADD COLUMN IF NOT EXISTS ip_address TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_certificate_events_request_id ON certificate_events(request_id);

-- Chain helper: SHA-256 hex of the canonical, order-stable event digest.
CREATE OR REPLACE FUNCTION certificate_event_digest(
    event_id TEXT,
    certificate_id TEXT,
    event_type TEXT,
    actor_id TEXT,
    evt_ts TIMESTAMPTZ,
    evt_metadata JSONB,
    previous_hash TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        sha256(
            convert_to(
                COALESCE(event_id, '') || '|' ||
                COALESCE(certificate_id, '') || '|' ||
                COALESCE(event_type, '') || '|' ||
                COALESCE(actor_id, '') || '|' ||
                COALESCE(evt_ts, NOW())::text || '|' ||
                COALESCE(evt_metadata::text, '') || '|' ||
                COALESCE(previous_hash, ''),
                'UTF8'
            )
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;