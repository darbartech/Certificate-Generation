-- DarbarTech Certificate System — Drop Raw Verification Token
-- V2 §7 (P0): the raw verification token must never be stored. Verification
-- links carry the token; only SHA-256(token) is retained. Migration 005 added
-- and backfilled `verification_token_hash`; this migration removes the raw
-- column entirely.

-- Final backfill in case any raw tokens were written between 005 and this
-- deploy (covers legacy rows only — new code writes the hash only).
UPDATE certificates
SET verification_token_hash = encode(
    sha256(convert_to(verification_token, 'UTF8')),
    'hex'
)
WHERE verification_token IS NOT NULL
  AND verification_token <> ''
  AND (verification_token_hash IS NULL OR verification_token_hash = '');

-- The explicit index from 001 and the column's implicit UNIQUE constraint are
-- removed with the column.
DROP INDEX IF EXISTS idx_certificates_verification_token;

ALTER TABLE certificates
    DROP COLUMN IF EXISTS verification_token CASCADE;
