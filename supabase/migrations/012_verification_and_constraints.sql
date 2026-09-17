-- 012: Verification token hash uniqueness, self-reference guard,
-- superseded_by FK cascade, revocation category check.
-- Safe for idempotent apply; all CREATE/ADD use IF NOT EXISTS where supported.

-- -----------------------------------------------------------------------------
-- Pre-migration data-scrub queries (run manually BEFORE applying if your DB
-- is populated; they're commented here so we don't mutate data by surprise):
--
--   -- Find duplicate verification_token_hash rows:
--   SELECT id, verification_token_hash FROM certificates
--    WHERE verification_token_hash IN (
--      SELECT verification_token_hash FROM certificates
--       WHERE verification_token_hash IS NOT NULL
--       GROUP BY verification_token_hash HAVING COUNT(*) > 1
--    ) ORDER BY verification_token_hash, created_at;
--
--   -- Find certificates with self-reference:
--   SELECT id, reissued_from_id FROM certificates WHERE reissued_from_id = id;
--
--   -- Find invalid revocation_category values:
--   SELECT id, revocation_category FROM certificates
--    WHERE revocation_category IS NOT NULL
--      AND revocation_category NOT IN (
--        'DATA_ERROR','DUPLICATE','FRAUD','ADMINISTRATIVE_ERROR','STUDENT_REQUEST','OTHER'
--      );
-- -----------------------------------------------------------------------------

-- (a) Unique index on the SHA-256 verification token hash.
-- Raw tokens are never stored (see migration 007); the hash must still be
-- unique to enforce the 1:1 "token → certificate" invariant.
CREATE UNIQUE INDEX IF NOT EXISTS certificates_verification_token_hash_key
  ON certificates (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;

-- (b) A certificate cannot be its own reissue predecessor (self-loop).
ALTER TABLE certificates
  ADD CONSTRAINT IF NOT EXISTS certificates_reissued_from_id_not_self
  CHECK (reissued_from_id IS NULL OR reissued_from_id <> id);

-- (c) superseded_by_id FK → certificates(id) with SET NULL on delete so
-- deleting a replacement certificate does not take the original with it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_name = 'certificates_superseded_by_fkey'
       AND table_name = 'certificates'
  ) THEN
    ALTER TABLE certificates
      ADD CONSTRAINT certificates_superseded_by_fkey
      FOREIGN KEY (superseded_by_id)
      REFERENCES certificates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- (d) Revocation category must match the documented 6-category taxonomy.
ALTER TABLE certificates
  ADD CONSTRAINT IF NOT EXISTS certificates_revocation_category_check
  CHECK (
    revocation_category IS NULL
    OR revocation_category IN (
      'DATA_ERROR','DUPLICATE','FRAUD','ADMINISTRATIVE_ERROR','STUDENT_REQUEST','OTHER'
    )
  );
