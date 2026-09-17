-- DarbarTech Certificate System — Database-Level Business Constraints
-- V2 §29 (P1): constraints supplement (never replace) application validation so
-- bad data cannot be introduced by a bug, a manual SQL statement, or a future
-- code path that forgets to validate.

-- Certificate status vocabulary. Kept in lockstep with the CertificateStatus
-- union in src/lib/types.ts (ADMIN_REVIEW, ISSUE_FAILED, etc. are intentional).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'certificates_status_check'
    ) THEN
        ALTER TABLE certificates
            ADD CONSTRAINT certificates_status_check CHECK (
                status IN (
                    'DRAFT',
                    'ISSUING',
                    'PREVIEW',
                    'ISSUE_FAILED',
                    'ADMIN_REVIEW',
                    'ISSUED',
                    'SUPERSEDED',
                    'REVOKED',
                    'REISSUED',
                    'CANCELLED'
                )
            );
    END IF;
END $$;

-- A certificate cannot be completed after it was issued.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'certificates_dates_check'
    ) THEN
        ALTER TABLE certificates
            ADD CONSTRAINT certificates_dates_check CHECK (
                completion_date IS NULL OR issue_date IS NULL OR completion_date <= issue_date
            );
    END IF;
END $$;

-- At most one active default secondary signatory may exist at any time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signatories_default_secondary
    ON signatories ((is_default_secondary))
    WHERE is_default_secondary = TRUE AND active = TRUE;

-- Certificate numbers are already UNIQUE on the column (001); keep an explicit
-- index name for operational clarity and to support prefix scans.
CREATE INDEX IF NOT EXISTS idx_certificates_number_prefix
    ON certificates (certificate_number text_pattern_ops);
