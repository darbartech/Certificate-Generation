-- DarbarTech Certificate System — Issuance Recovery Fields
-- V2 §12 (P0): issuance must be recoverable. A record is created in ISSUING
-- before any fallible render/storage work; these columns make a stuck attempt
-- visible, retryable, and eventually reviewable instead of silently orphaned.

ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS issuing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Fast scan for the recovery job: stale ISSUING rows.
CREATE INDEX IF NOT EXISTS idx_certificates_issuing_started
    ON certificates (status, issuing_started_at)
    WHERE status = 'ISSUING';

-- Backfill: existing ISSUED rows are treated as a single successful attempt.
UPDATE certificates
SET attempt_count = 1
WHERE attempt_count = 0
  AND status IN ('ISSUED', 'REISSUED');
