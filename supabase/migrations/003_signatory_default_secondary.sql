-- DarbarTech Certificate System Schema v3
-- Data-driven default secondary signatory flag.
-- Only one signatory may hold is_default_secondary = TRUE; the API layer
-- enforces that invariant when creating/updating signatories.

ALTER TABLE signatories
    ADD COLUMN IF NOT EXISTS is_default_secondary BOOLEAN NOT NULL DEFAULT FALSE;