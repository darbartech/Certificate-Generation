-- DarbarTech Certificate System Schema v2
-- Extended canonical course fields for catalog sync + template mapping + audit snapshotting

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS certificate_title TEXT;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS certificate_template_id TEXT;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS certificate_template_version TEXT;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS provider_name TEXT;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS completion_statement TEXT;
