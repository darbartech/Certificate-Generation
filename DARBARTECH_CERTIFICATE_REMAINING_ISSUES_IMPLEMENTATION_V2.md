# DarbarTech Certificate System — Remaining Issues Implementation & Production Hardening V2

**Document Type:** Master implementation specification  
**Project:** DarbarTech Programmable Certificate System  
**Purpose:** Fix the remaining production-readiness, security, data-integrity, reliability, and operational issues identified in the latest project audit.

---

## 1. Objective

The current certificate system has a strong foundation, including:

- certificate rendering and PDF generation
- QR verification
- certificate lifecycle states
- server-side validation
- atomic certificate numbering
- course/module transactional update RPC
- verification-token hashing support
- request metadata and audit fields
- Redis rate limiting
- production environment validation

The remaining work is mainly around **production data integrity, authentication, transactionality, artifact security, audit durability, recovery, and operational controls**.

### Production rule

> A production certificate must never appear to be successfully issued unless the authoritative database record, certificate artifact, verification data, and audit record are all in a recoverable and consistent state.

---

# 2. Priority Model

| Priority | Meaning | Requirement |
|---|---|---|
| P0 | Production blocker | Must be fixed before issuing official certificates |
| P1 | High priority | Required immediately after P0 |
| P2 | Hardening | Recommended for mature production operation |

### P0 blockers

1. Remove production in-memory database fallback.
2. Remove production filesystem PDF fallback.
3. Replace hardcoded admin authentication.
4. Fix audit-chain concurrency.
5. Make reissue transactional and idempotent.
6. Implement issuance recovery.
7. Stop storing raw verification tokens.
8. Make critical audit events durable.
9. Make issued PDF artifacts immutable/private.
10. Enforce server-authoritative certificate data.

---

# 3. P0 — Remove Production In-Memory Database Fallback

## Problem

`src/lib/database/index.ts` still falls back to `inMemoryDb` for production reads.

Examples include:

- certificate lookup
- certificate number lookup
- verification-token lookup
- course lookup
- signatory lookup
- certificate module lookup
- certificate event lookup

This can cause a valid certificate to appear as `NOT_FOUND` when Supabase is temporarily unavailable.

## Required behavior

### Development

```text
Supabase available
      ↓
Use Supabase

Supabase unavailable
      ↓
Optional in-memory fallback
```

### Production

```text
Supabase available
      ↓
Use Supabase

Supabase unavailable
      ↓
Return controlled SERVICE_UNAVAILABLE
```

Never:

```text
Production Supabase failure
        ↓
inMemoryDb
```

## Implementation

Refactor:

```text
src/lib/database/index.ts
src/lib/database/inMemoryDb.ts
```

Create explicit environment behavior:

```ts
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  // Never call inMemoryDb
}
```

Better architecture:

```ts
interface CertificateRepository {
  findById(id: string): Promise<Certificate | null>;
  findByNumber(number: string): Promise<Certificate | null>;
  findByTokenHash(hash: string): Promise<Certificate | null>;
  create(data: Certificate): Promise<Certificate>;
  update(id: string, data: Partial<Certificate>): Promise<Certificate>;
}
```

Implement:

```text
SupabaseCertificateRepository
InMemoryCertificateRepository
```

Select repository only by environment.

## Acceptance criteria

- [ ] Production has zero runtime calls to `inMemoryDb`.
- [ ] Supabase outage never returns false `NOT_FOUND`.
- [ ] Public verification returns HTTP 503/service-unavailable when persistence is unavailable.
- [ ] Admin UI displays degraded state.
- [ ] Development tests can still use in-memory storage.

---

# 4. P0 — Fix `courseCatalogInMemory()` Failure Handling

## Current problem

A database query failure is treated as a schema-missing condition.

This incorrectly converts:

```text
network failure
permission failure
timeout
Supabase outage
```

into:

```text
schema missing
→ use memory
```

## Required classification

Create:

```ts
type PersistenceState =
  | "AVAILABLE"
  | "SCHEMA_MISSING"
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";
```

Only `SCHEMA_MISSING` may be treated as a development migration/setup issue.

Production must not silently fall back.

## Acceptance criteria

- [ ] Network errors remain network errors.
- [ ] Permission errors remain permission errors.
- [ ] Timeout remains timeout.
- [ ] Only explicit development schema mismatch can activate compatibility behavior.

---

# 5. P0 — Remove Production Filesystem PDF Fallback

## Problem

`src/lib/services/storageService.ts` currently uploads to Supabase Storage and can fall back to local filesystem storage.

This is unsafe for:

- serverless deployments
- multiple application instances
- container restarts
- ephemeral filesystems

## Required production flow

```text
Render PDF
   ↓
SHA-256
   ↓
Supabase private bucket
   ↓
Upload success?
 ├─ YES → continue
 └─ NO  → ISSUE_FAILED
```

Never:

```text
Supabase failed
↓
write local filesystem
↓
pretend certificate is safely stored
```

## Implementation

Update:

```text
src/lib/services/storageService.ts
```

Production behavior:

```ts
if (isProduction && uploadFails) {
  throw new CertificateStorageError(
    "Certificate artifact storage unavailable"
  );
}
```

Filesystem storage may remain only for local development/test.

## Acceptance criteria

- [ ] Production cannot create `fs:` artifact references.
- [ ] Storage failure prevents successful issuance.
- [ ] Failed storage creates recoverable `ISSUE_FAILED` state.
- [ ] No certificate is reported as issued without durable artifact storage.

---

# 6. P0 — Make Certificate Storage Private and Immutable

## Problem

Current storage configuration uses:

```ts
cacheControl: "public, max-age=31536000"
```

and:

```ts
upsert: true
```

Official certificates should not be silently replaceable.

## Required design

Use a private Supabase Storage bucket:

```text
certificate-pdfs
```

Object path:

```text
issued/{certificateId}/{certificateNumber}-{artifactVersion}.pdf
```

Example:

```text
issued/
  8d3.../
    DT-CERT-2026-00001-v1.pdf
```

Never overwrite issued artifacts.

Use:

```ts
upsert: false
```

If an object already exists:

```text
artifact collision → fail safely
```

## Download strategy

Admin download:

```text
authenticated admin
      ↓
authorization check
      ↓
generate short-lived signed URL
      ↓
download
```

Public verification should not expose unrestricted PDF storage unless this is explicitly required by business policy.

## Acceptance criteria

- [ ] Bucket is private.
- [ ] No public long-lived PDF URL is stored/exposed.
- [ ] Issued artifacts cannot be overwritten.
- [ ] Reissue creates a new artifact.
- [ ] Signed URLs have short expiry.

---

# 7. P0 — Stop Storing Raw Verification Tokens

## Problem

Migration `005` introduced:

```text
verification_token_hash
```

but the original:

```text
verification_token
```

still exists and is populated.

This means a database leak can expose working verification URLs.

## Required architecture

Generate:

```text
rawToken
```

Use it temporarily for:

- QR URL
- PDF rendering

Persist only:

```text
SHA-256(rawToken)
```

Database:

```text
verification_token_hash
```

No raw token after issuance.

## Migration

Create:

```text
006_remove_raw_verification_token.sql
```

Recommended sequence:

1. Verify all existing certificates have valid hashes.
2. Backfill missing hashes.
3. Verify uniqueness.
4. Stop application writes to raw token.
5. Remove raw token from application models.
6. Remove database column.

Do not remove the column until all legacy records are verified.

## Acceptance criteria

- [ ] New certificates never persist raw tokens.
- [ ] Existing certificates have valid hashes.
- [ ] Public verification works using hash lookup.
- [ ] Database no longer contains usable raw verification tokens after migration.

---

# 8. P0 — Make Server Certificate Data Authoritative

## Problem

The client can submit values such as:

- provider name
- completion statement
- template version
- certificate template
- course information
- signatory information

The server must not trust these as authoritative certificate facts.

## Required flow

Client submits IDs and user-controlled certificate inputs:

```json
{
  "courseId": "...",
  "signatoryId": "...",
  "recipientName": "...",
  "studentId": "...",
  "grade": "A",
  "completionDate": "2026-09-15"
}
```

Server loads:

```text
course
modules
signatory
template
company configuration
```

Server constructs:

```ts
authoritativeCertificateInput
```

Only this object reaches:

```text
numbering
PDF renderer
snapshot
database
audit
```

## Never trust client values for:

- official company name
- provider name
- certificate template
- renderer version
- template version
- signatory position
- signatory active status
- course title
- course duration
- course modules
- verification base URL

## Acceptance criteria

- [ ] Tampering with client course title does not change issued certificate.
- [ ] Tampering with signatory name does not change issued certificate.
- [ ] Inactive signatory cannot be used.
- [ ] Template/version comes from server configuration.
- [ ] Snapshot exactly matches authoritative data.

---

# 9. P0 — Remove Hardcoded Secondary Signatory

## Problem

`certificateService.ts` contains a hardcoded default secondary signatory.

Example:

```ts
DEFAULT_SECONDARY_SIGNATORY
```

with a fixed person's identity.

This can diverge from the database.

## Required behavior

Resolve default signatory from:

```text
signatories
```

using:

```text
is_default_secondary = true
active = true
```

Enforce one default secondary signatory at the database level.

## Required fallback

Production:

```text
No valid default signatory
        ↓
ISSUANCE BLOCKED
```

Never silently invent a signatory.

## Acceptance criteria

- [ ] No production certificate service contains hardcoded signatory identity.
- [ ] Default signatory comes from DB.
- [ ] Signatory data is snapshotted at issuance.
- [ ] Missing/invalid signatory blocks issuance.

---

# 10. P0 — Fix Audit Chain Concurrency

## Current problem

Current logic:

```text
read previous event
↓
create next event
```

Two concurrent requests can both read the same previous event.

Example:

```text
X
├── A
└── B
```

This creates an audit-chain fork.

## Required architecture

Create:

```text
certificate_audit_heads
```

Schema:

```sql
CREATE TABLE certificate_audit_heads (
  certificate_id UUID PRIMARY KEY,
  last_event_hash TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Audit event insertion must occur inside a transaction.

Conceptual flow:

```text
BEGIN

SELECT audit_head
FOR UPDATE

calculate previous_event_hash

insert certificate_event

update audit_head

COMMIT
```

Alternative:

```text
SERIALIZABLE transaction
```

with retry on serialization failure.

## Acceptance criteria

- [ ] Concurrent event creation cannot fork the chain.
- [ ] Every event has exactly one previous hash.
- [ ] `verifyAuditChain()` passes after concurrent activity.
- [ ] Serialization failures are retried safely.

---

# 11. P0 — Make Critical Audit Events Durable

Critical events:

```text
ISSUING
ISSUED
ISSUE_FAILED
REVOKED
SUPERSEDED
REISSUED
```

must not silently disappear.

## Current problem

Some audit calls catch errors or explicitly avoid throwing.

This can produce:

```text
Certificate state changed
+
Audit missing
```

## Required strategy

Preferred:

```text
business transaction
+
audit event
```

inside one transaction.

If PDF storage prevents a single DB transaction, use a durable outbox.

Create:

```text
certificate_event_outbox
```

Example:

```text
business state
      ↓
outbox event
      ↓
background processor
      ↓
audit event
```

Outbox fields:

```text
id
certificate_id
event_type
payload
created_at
processed_at
attempt_count
last_error
```

## Acceptance criteria

- [ ] Critical lifecycle events are never silently discarded.
- [ ] Failed audit writes are retryable.
- [ ] Operators can identify pending audit events.
- [ ] Event ordering remains deterministic.

---

# 12. P0 — Make Issuance Recoverable

## Required certificate fields

Add:

```text
issuing_started_at
last_attempt_at
attempt_count
last_error
artifact_path
artifact_sha256
artifact_size
```

## Lifecycle

```text
DRAFT
  ↓
ISSUING
  ↓
render
  ↓
store
  ↓
ISSUED
```

Failure:

```text
ISSUING
  ↓
ISSUE_FAILED
```

Recovery:

```text
ISSUING timeout
      ↓
inspect artifact
      ↓
artifact valid?
 ├─ YES → finalize ISSUED
 └─ NO  → retry
```

After configurable retries:

```text
ADMIN_REVIEW
```

## Recovery job

Run periodically:

```text
every 5–15 minutes
```

Find:

```text
status = ISSUING
AND issuing_started_at < now() - timeout
```

Then recover.

## Important

Recovery must be idempotent.

Never generate a second certificate number merely because a render operation timed out.

---

# 13. P0 — Make Reissue Transactional

## Current risk

Reissue currently performs multiple separate operations.

Possible partial state:

```text
replacement created
↓
original not superseded
```

or:

```text
original superseded
↓
replacement relationship update failed
```

## Required database transaction

Conceptual:

```sql
BEGIN;

create replacement certificate;

mark original SUPERSEDED;

set replacement.reissued_from_id = original.id;

insert audit events;

COMMIT;
```

Storage should be completed before final commit or handled through a durable state machine.

## Recommended state machine

```text
REISSUE_REQUESTED
       ↓
REISSUING
       ↓
REPLACEMENT_CREATED
       ↓
ORIGINAL_SUPERSEDED
       ↓
COMPLETED
```

Failure:

```text
REISSUING
   ↓
REISSUE_FAILED
```

---

# 14. P0 — Add Reissue Idempotency

A browser retry or double-click must not create multiple replacement certificates.

## API

Accept:

```http
Idempotency-Key: <unique-key>
```

Store:

```text
reissue_operations
```

Schema:

```text
id
idempotency_key UNIQUE
original_certificate_id
replacement_certificate_id
requested_by
status
created_at
completed_at
```

## Behavior

Same key:

```text
request #1 → create operation
request #2 → return existing operation/result
```

Different key:

```text
new legitimate operation
```

## Acceptance criteria

- [ ] Double-click cannot create duplicate replacement certificates.
- [ ] Browser retry returns same result.
- [ ] Timeout retry is safe.
- [ ] Operation can be audited.

---

# 15. P0 — Replace Hardcoded Admin Authentication

## Current problem

`authService.ts` contains static users and environment-password identities.

This is not suitable for long-term production administration.

## Required model

Create:

```text
admin_users
admin_sessions
admin_login_events
```

### `admin_users`

```text
id
username
email
password_hash
role_id
is_active
mfa_enabled
created_at
updated_at
last_login_at
```

### `admin_sessions`

```text
id
admin_user_id
created_at
expires_at
revoked_at
last_seen_at
ip_address
user_agent
```

### `admin_login_events`

```text
id
admin_user_id
event_type
success
ip_address
user_agent
created_at
```

## Passwords

Use:

```text
Argon2id
```

or existing bcrypt with strong parameters if migration must be gradual.

Never store plaintext passwords.

## Production bootstrap

Create a secure one-time admin bootstrap process.

Do not ship:

```text
admin123
staff123
```

or any default password.

---

# 16. P0/P1 — Implement Persistent Sessions

Current HMAC session tokens are stateless.

Problem:

```text
Admin disabled
↓
existing token may remain valid
```

## Required

Cookie contains:

```text
random session ID
```

Database contains session record.

Every request:

```text
cookie
 ↓
session lookup
 ↓
active?
 ↓
admin active?
 ↓
permission
```

Logout:

```text
revoked_at = now()
```

"Logout all sessions":

```text
revoke all active sessions
```

## Acceptance criteria

- [ ] Admin can be disabled immediately.
- [ ] Session can be revoked.
- [ ] Logout invalidates session.
- [ ] Logout-all works.
- [ ] Expired sessions are rejected.

---

# 17. P1 — Add MFA

MFA is required for:

```text
SUPER_ADMIN
```

Recommended:

```text
TOTP
```

Optional later:

```text
WebAuthn/passkeys
```

Sensitive operations should require recent authentication or MFA confirmation:

- revoke
- reissue
- manage admins
- change certificate configuration
- change signatories
- change templates

---

# 18. P1 — Move Login Rate Limiting to Redis

Current login lockout uses an in-process `Map`.

This does not work consistently across multiple instances.

Use Redis keys such as:

```text
login:ip:{ip}
login:user:{username}
```

Store:

```text
attempt count
window
lockout timestamp
```

## Requirement

For authentication:

```text
Redis unavailable
↓
apply stricter fail-closed protection
```

Do not allow unlimited login attempts simply because Redis is down.

---

# 19. P1 — Fix Client IP Trust

Current code trusts:

```text
x-forwarded-for
x-real-ip
```

without clearly defining trusted proxies.

## Required

Document deployment architecture:

```text
Internet
 ↓
Trusted reverse proxy
 ↓
Next.js
```

Only trust forwarding headers when request comes from a configured trusted proxy.

Environment:

```text
TRUSTED_PROXY_MODE=true
```

or an equivalent explicit deployment setting.

If not behind a trusted proxy:

```text
use direct connection IP
```

---

# 20. P1 — Improve Error Handling

Current routes sometimes expose:

```ts
err.message
```

to clients.

This may leak:

- database details
- Supabase errors
- SQL errors
- storage paths
- implementation details

## Required response

Client:

```json
{
  "error": "An internal error occurred.",
  "requestId": "..."
}
```

Server log:

```text
requestId
error
stack
route
user
certificateId
operation
```

## Rule

Never expose:

```text
stack trace
SQL error
storage path
environment variable
database connection information
```

---

# 21. P1 — Use One Request ID System

Currently request ID generation exists in more than one place.

Standardize:

```text
middleware
 ↓
requestId
 ↓
service
 ↓
database
 ↓
audit
 ↓
logs
```

Return:

```http
X-Request-ID: <request-id>
```

Include the same ID in audit records and structured logs.

---

# 22. P1 — Granular RBAC

Current permissions are too broad.

Replace with explicit permissions:

```text
VIEW_CERTIFICATES
CREATE_CERTIFICATE
PREVIEW_CERTIFICATE
ISSUE_CERTIFICATE
REISSUE_CERTIFICATE
REVOKE_CERTIFICATE
DOWNLOAD_CERTIFICATE
VIEW_AUDIT
EXPORT_REPORTS
MANAGE_COURSES
MANAGE_SIGNATORIES
MANAGE_TEMPLATES
MANAGE_ADMINS
MANAGE_SETTINGS
VIEW_HEALTH
```

Example:

```text
STAFF
 ├─ view
 ├─ create
 ├─ preview
 └─ download

CERTIFICATE_MANAGER
 ├─ issue
 ├─ reissue
 └─ revoke

SUPER_ADMIN
 └─ all
```

Do not rely on UI hiding for authorization.

Every API must enforce permission server-side.

---

# 23. P1 — Permission-Aware Admin Navigation

The UI should hide navigation items the current user cannot access.

Example:

```text
Staff
 ├─ Dashboard
 ├─ Certificates
 └─ Verification

Super Admin
 ├─ Dashboard
 ├─ Certificates
 ├─ Courses
 ├─ Signatories
 ├─ Templates
 ├─ Audit
 ├─ Admin Users
 └─ Settings
```

API authorization remains mandatory even if navigation is hidden.

---

# 24. P1 — Fix Degraded Admin UX

Current message:

> Running in degraded/offline mode — certificates issued now will not be saved permanently.

This is dangerous because it suggests the user may continue issuing.

Replace with:

> **System degraded — certificate issuance is temporarily disabled because persistent storage is unavailable.**

Disable:

```text
Issue
Reissue
Revoke
Course save
Signatory save
Template save
```

Allow safe read-only operations if data source is available.

---

# 25. P1 — Certificate Snapshot Completeness

At issuance, store a complete immutable snapshot.

Recommended:

```json
{
  "certificateNumber": "...",
  "recipientName": "...",
  "studentId": "...",
  "courseId": "...",
  "courseVersion": "...",
  "courseTitle": "...",
  "duration": "...",
  "modules": [],
  "grade": "...",
  "completionDate": "...",
  "issueDate": "...",
  "providerName": "...",
  "completionStatement": "...",
  "primarySignatory": {},
  "secondarySignatory": {},
  "templateId": "...",
  "templateVersion": "...",
  "rendererVersion": "...",
  "certificatePrefix": "...",
  "verificationTokenHash": "...",
  "signatureAssetHashes": [],
  "templateChecksum": "...",
  "createdAt": "..."
}
```

The snapshot must allow future reconstruction even if:

- course changes
- signatory changes
- template changes
- company configuration changes

---

# 26. P1 — Add Course Versioning

Course edits should not alter the historical meaning of already-issued certificates.

Recommended:

```text
courses
course_versions
course_modules
```

Example:

```text
Web Development
  v1
  v2
  v3
```

Certificate:

```text
course_id
course_version_id
```

The certificate uses the version snapshot active at issuance.

---

# 27. P1 — Add Template Integrity

Store:

```text
template_id
template_version
template_checksum
renderer_version
renderer_checksum
```

When issuing:

```text
template checksum
+
renderer checksum
+
certificate snapshot
```

are recorded.

This supports future verification of how a certificate was produced.

---

# 28. P1 — Simplify Certificate Status Model

Recommended fundamental states:

```text
DRAFT
ISSUING
ISSUE_FAILED
ISSUED
SUPERSEDED
REVOKED
```

Do not make `REISSUED` a primary lifecycle state if it represents a relationship rather than a condition.

Use:

```text
reissued_from_id
superseded_by_id
```

instead.

Recommended lifecycle:

```text
DRAFT
  ↓
ISSUING
  ↓
ISSUED
  ├──→ SUPERSEDED
  └──→ REVOKED

ISSUING
  ↓
ISSUE_FAILED
  ↓
ISSUING
```

---

# 29. P1 — Database Constraints

Add database-level constraints for important business rules.

Examples:

### Status

```sql
CHECK (
  status IN (
    'DRAFT',
    'ISSUING',
    'ISSUE_FAILED',
    'ISSUED',
    'SUPERSEDED',
    'REVOKED'
  )
)
```

### Dates

```sql
CHECK (completion_date <= issue_date)
```

### Certificate number

Use a database constraint or unique index.

### Verification hash

```sql
UNIQUE (verification_token_hash)
```

### Default secondary signatory

Maintain only one active default.

Database constraints should supplement, not replace, application validation.

---

# 30. P1 — Revocation Hardening

Revocation should require:

```text
reason category
reason detail
actor
timestamp
requestId
IP
user agent
```

Suggested categories:

```text
DATA_ERROR
DUPLICATE
FRAUD
ADMINISTRATIVE_ERROR
STUDENT_REQUEST
OTHER
```

Do not expose internal/private revocation details publicly unless business policy requires it.

Public verification should communicate only the certificate's validity status and appropriate minimal metadata.

---

# 31. P1 — Public Verification Abuse Protection

Manual certificate numbers are predictable.

Example:

```text
DT-CERT-2026-00001
DT-CERT-2026-00002
...
```

Keep manual lookup for usability, but make QR/random-token verification the primary verification path.

Use:

```text
random verification token
```

with sufficient entropy.

Add:

- rate limiting
- request logging
- abuse detection
- generic not-found response
- no sensitive database details

Consider requiring two fields for manual verification if enumeration becomes a practical concern.

---

# 32. P1 — Search Security and Performance

The current sanitization is an improvement.

Long-term, use:

```text
parameterized PostgreSQL function
```

or a proper indexed search approach.

For large datasets consider:

```text
pg_trgm
```

indexes.

Do not construct raw PostgREST filters from arbitrary user input.

---

# 33. P1 — PDF Regression Testing

Create an automated PDF visual test suite.

Test cases:

```text
normal English name
long English name
Nepali name
long course title
maximum module count
minimum module count
long module title
A+
A
B+
B
C
long dates
QR code
missing optional data
```

Pipeline:

```text
certificate input
 ↓
render PDF
 ↓
rasterize
 ↓
compare reference
 ↓
threshold
 ↓
PASS / FAIL
```

Also verify programmatically:

```text
PDF opens
QR exists
certificate number exists
recipient exists
issue date exists
signatures exist
```

---

# 34. P1 — Grade Business Rule

Current validation appears broader than a likely official grading policy.

Do not rely on a generic regex if the business policy is:

```text
A+
A
B+
B
C
```

Prefer:

```ts
const GRADES = ["A+", "A", "B+", "B", "C"] as const;
```

If PASS/FAIL or D grades are officially required, document them explicitly.

The validation rule must match the actual certificate policy.

---

# 35. P1 — Archive and Repository Hygiene

Do not distribute:

```text
.next/
supabase/.temp/
```

Add:

```gitignore
supabase/.temp/
```

Keep build output generated by CI/CD.

Move experimental scripts such as:

```text
_fix.js
_probe.js
_gt3.js
_wirePatch.js
_pdfGap.js
```

into:

```text
tools/
```

or remove obsolete scripts.

Production repository should contain only maintained operational tooling.

---

# 36. P1 — Backup and Restore

Production certificate data must have verified backups.

Back up:

```text
Supabase PostgreSQL
certificate metadata
audit events
certificate artifacts
configuration
```

Define:

```text
RPO
RTO
```

Example policy:

```text
RPO: 24 hours maximum
RTO: 4 hours maximum
```

Choose actual values according to business requirements.

## Mandatory restore test

A backup is not considered valid until restoration has been tested.

---

# 37. P1 — Certificate Integrity Checker

Create an admin operation:

```text
Verify Certificate Integrity
```

Checks:

```text
certificate record
PDF exists
PDF SHA-256 matches
artifact size matches
verification hash valid
audit chain valid
status relationship valid
snapshot present
```

Output:

```text
PASS
WARNING
FAIL
```

Do not expose internal diagnostics publicly.

---

# 38. P1 — Health Checks

Create:

```text
/api/health
/api/health/ready
/api/health/live
```

### Live

Checks application process.

### Ready

Checks:

```text
Supabase
Redis
Storage
required configuration
```

Example:

```json
{
  "status": "ready",
  "database": "ok",
  "redis": "ok",
  "storage": "ok"
}
```

Do not expose secrets or sensitive connection information.

---

# 39. P1 — Structured Logging and Monitoring

Use structured logs:

```json
{
  "timestamp": "...",
  "level": "error",
  "requestId": "...",
  "operation": "certificate.issue",
  "certificateId": "...",
  "actorId": "...",
  "errorCode": "STORAGE_UNAVAILABLE"
}
```

Monitor:

```text
issuance failures
storage failures
database failures
verification failures
reissue failures
revocations
login failures
rate-limit events
audit failures
```

Set alerts for abnormal spikes.

---

# 40. P2 — Stronger Audit Assurance

Hash chains detect unauthorized changes when the chain is anchored.

They do not stop a database superuser from rewriting the entire chain and recalculating hashes.

For stronger assurance:

```text
daily audit digest
 ↓
cryptographic signature
 ↓
external immutable storage
```

Possible implementation:

```text
SHA-256 audit snapshot
+
digital signature
+
external retention
```

This is optional but valuable for official long-term certificate records.

---

# 41. Recommended Database Migrations

Create migrations in sequence.

```text
006_remove_raw_verification_token.sql
007_audit_heads.sql
008_reissue_operations.sql
009_admin_users_sessions.sql
010_certificate_recovery_fields.sql
011_certificate_constraints.sql
012_course_versions.sql
013_template_integrity.sql
014_health_and_security_events.sql
```

Do not combine unrelated destructive migrations into one production deployment.

For every migration:

```text
backup
↓
apply
↓
verify
↓
application deployment
↓
post-deployment check
```

---

# 42. Recommended Code Refactoring

## Database

Refactor:

```text
src/lib/database/index.ts
```

into clear repositories:

```text
src/lib/database/
  certificates.ts
  courses.ts
  signatories.ts
  audit.ts
  sessions.ts
  reissue.ts
  health.ts
```

## Services

Maintain:

```text
certificateService.ts
storageService.ts
auditService.ts
authService.ts
verificationService.ts
```

but keep responsibilities separated.

Recommended:

```text
certificateService
    ↓
certificateRepository
    ↓
Supabase
```

rather than mixing persistence fallback logic throughout the service.

---

# 43. Recommended API Error Codes

Use stable internal/public error codes:

```text
AUTH_REQUIRED
FORBIDDEN
VALIDATION_ERROR
CERTIFICATE_NOT_FOUND
CERTIFICATE_ALREADY_ISSUED
CERTIFICATE_REVOKED
CERTIFICATE_SUPERSEDED
PERSISTENCE_UNAVAILABLE
STORAGE_UNAVAILABLE
ISSUANCE_FAILED
REISSUE_IN_PROGRESS
IDEMPOTENCY_CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Client messages should remain safe and human-readable.

---

# 44. Testing Requirements

## Unit tests

Test:

- validation
- numbering
- token hashing
- status transitions
- permission checks
- revocation rules
- reissue idempotency
- snapshot generation

## Integration tests

Test:

- Supabase failure
- Redis failure
- storage failure
- transaction rollback
- concurrent issuance
- concurrent audit events
- reissue retry
- session revocation

## Security tests

Test:

- invalid session
- expired session
- revoked session
- disabled admin
- privilege escalation
- CSRF/origin failures
- rate limiting
- header spoofing
- verification enumeration
- raw token exposure

## Recovery tests

Simulate:

```text
PDF generated
DB finalization fails
```

and:

```text
PDF uploaded
process crashes
```

Recovery must correctly determine whether to finalize or retry.

---

# 45. Production Acceptance Test

Before real certificates are issued, run this sequence.

### A. Infrastructure

- [ ] Production Supabase configured.
- [ ] Production Redis configured.
- [ ] Private certificate bucket configured.
- [ ] Backup configured.
- [ ] Monitoring configured.
- [ ] Health checks working.

### B. Authentication

- [ ] No hardcoded default password.
- [ ] Admin users persisted.
- [ ] Sessions persisted.
- [ ] MFA enabled for super admin.
- [ ] Login rate limiting distributed.

### C. Database

- [ ] No production in-memory fallback.
- [ ] Required migrations applied.
- [ ] Constraints verified.
- [ ] Audit head mechanism verified.
- [ ] Reissue operation table verified.

### D. Certificate

- [ ] Server-authoritative data.
- [ ] Correct course snapshot.
- [ ] Correct signatory snapshot.
- [ ] Correct template/version.
- [ ] Correct renderer version.
- [ ] Correct QR token.
- [ ] PDF SHA-256 stored.
- [ ] PDF immutable.

### E. Verification

- [ ] QR verification works.
- [ ] Manual verification works.
- [ ] Invalid token rejected.
- [ ] Revoked certificate displays correct status.
- [ ] Superseded certificate displays correct status.
- [ ] No sensitive internal data exposed.

### F. Recovery

- [ ] Failed issuance recoverable.
- [ ] Storage failure recoverable.
- [ ] DB failure recoverable.
- [ ] Reissue retry idempotent.
- [ ] Audit retry works.

### G. Audit

- [ ] ISSUING logged.
- [ ] ISSUED logged.
- [ ] ISSUE_FAILED logged.
- [ ] REVOKED logged.
- [ ] SUPERSEDED logged.
- [ ] Audit chain verification passes.

---

# 46. Recommended Implementation Order

Do not implement everything simultaneously.

## Phase 1 — Production blockers

```text
1. Remove production in-memory fallback
2. Remove production filesystem fallback
3. Private immutable artifact storage
4. Raw token removal
5. Server-authoritative input
6. Database signatory resolution
7. Audit concurrency fix
8. Durable critical events
9. Issuance recovery
10. Transactional reissue
11. Reissue idempotency
12. Persistent admin authentication
```

## Phase 2 — Security and operations

```text
13. Persistent sessions
14. MFA
15. Redis login protection
16. Trusted proxy/IP handling
17. Granular RBAC
18. Safe error handling
19. Request ID standardization
20. Course versioning
21. Template/renderer integrity
22. Health checks
23. Structured logging
24. Backup/restore
```

## Phase 3 — Quality and advanced assurance

```text
25. PDF regression testing
26. Certificate integrity checker
27. Advanced audit anchoring
28. Advanced security monitoring
29. Operational dashboards
```

---

# 47. Definition of Done

The system is ready for official certificate issuance only when all P0 items are complete and verified.

The following statement must be true:

> A production certificate cannot be falsely reported as successfully issued because of an application-memory fallback, ephemeral filesystem storage, partial reissue operation, missing audit event, stale authentication state, or client-controlled certificate metadata.

Additionally:

```text
Database
    authoritative

Storage
    durable + private + immutable

Authentication
    persistent + revocable

Authorization
    server enforced

Verification
    token-hash based

Audit
    concurrency safe + durable

Issuance
    recoverable

Reissue
    transactional + idempotent

PDF
    integrity verified

Operations
    monitored + backed up
```

---

# 48. Final Production Gate

Before enabling the "Issue Certificate" button in production:

```text
Run migration verification
        ↓
Run automated tests
        ↓
Run concurrency tests
        ↓
Run failure/recovery tests
        ↓
Run security tests
        ↓
Run PDF regression tests
        ↓
Verify backups
        ↓
Verify monitoring
        ↓
Issue one controlled test certificate
        ↓
Verify through QR
        ↓
Verify database + PDF hash + audit chain
        ↓
Test revoke
        ↓
Test reissue
        ↓
Verify original SUPERSEDED
        ↓
Verify replacement ISSUED
        ↓
Final production approval
```

**Only after every P0 acceptance criterion passes should official certificate issuance be enabled.**
