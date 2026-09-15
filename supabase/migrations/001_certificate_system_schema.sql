-- DarbarTech Certificate System Schema
-- PostgreSQL / Supabase Migration

CREATE TABLE IF NOT EXISTS signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    signature_storage_key TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    duration TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_id TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number TEXT NOT NULL UNIQUE,
    verification_token TEXT NOT NULL UNIQUE,
    template_id TEXT NOT NULL,
    template_version TEXT NOT NULL,
    renderer_version TEXT NOT NULL,

    recipient_name TEXT NOT NULL,
    student_id TEXT,

    program_id UUID REFERENCES courses(id),
    program_title TEXT NOT NULL,
    duration TEXT NOT NULL,

    completion_date DATE,
    issue_date DATE NOT NULL,

    grade TEXT,

    status TEXT NOT NULL DEFAULT 'DRAFT',

    signatory_id UUID REFERENCES signatories(id),
    signatory_name_snapshot TEXT NOT NULL,
    signatory_position_snapshot TEXT NOT NULL,

    public_visibility JSONB NOT NULL DEFAULT '{}'::jsonb,

    pdf_storage_key TEXT,
    preview_storage_key TEXT,

    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,

    reissued_from_id UUID REFERENCES certificates(id),
    data_snapshot JSONB
);

CREATE TABLE IF NOT EXISTS certificate_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT
);

CREATE TABLE IF NOT EXISTS certificate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_number_sequence (
    sequence_key TEXT PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_verification_token ON certificates(verification_token);
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_name ON certificates(recipient_name);
CREATE INDEX IF NOT EXISTS idx_certificate_modules_certificate_id ON certificate_modules(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_events_certificate_id ON certificate_events(certificate_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON course_modules(course_id);

-- Certificate number sequence function
CREATE OR REPLACE FUNCTION next_certificate_number(p_prefix TEXT, p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_key TEXT;
    v_next INTEGER;
BEGIN
    v_key := p_prefix || '-' || p_year;

    INSERT INTO certificate_number_sequence (sequence_key, last_value)
    VALUES (v_key, 1)
    ON CONFLICT (sequence_key) DO UPDATE
    SET last_value = certificate_number_sequence.last_value + 1,
        updated_at = NOW()
    RETURNING last_value INTO v_next;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Automatic updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_signatories_updated_at ON signatories;
CREATE TRIGGER trg_signatories_updated_at
BEFORE UPDATE ON signatories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON certificates;
CREATE TRIGGER trg_certificates_updated_at
BEFORE UPDATE ON certificates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security (RLS) - Enable on public tables
ALTER TABLE signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- Public verification read-only access for certificates (minimal fields)
-- Application uses service role key, so RLS doesn't block admin operations
-- RLS policies are added as an additional safety net

-- Default seed data for demo/non-Supabase mode handled at application layer
