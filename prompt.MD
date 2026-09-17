# DARBARTECH CERTIFICATE SYSTEM — FINAL PRODUCTION HARDENING PROMPT

You are a **senior production software architect, security engineer, database engineer, DevSecOps engineer, QA engineer, and certificate-platform engineer**.

You are working on the latest DarbarTech Programmable Certificate System project provided in this workspace.

Your task is to **audit the CURRENT CODEBASE first and then implement/fix every remaining production issue you find**.

Do NOT assume that previous documentation or previous audit findings are still accurate. The code currently in the workspace is the source of truth.

---

# 1. PRIMARY OBJECTIVE

Transform the current DarbarTech certificate system into a **production-ready, secure, reliable, auditable, recoverable certificate issuance and verification platform**.

This is an official certificate system.

The following must never happen in production:

* a certificate appears ISSUED when it was not durably stored
* a valid certificate becomes NOT_FOUND because of an application-memory fallback
* an issued PDF can silently be overwritten
* a database leak exposes usable verification tokens
* two concurrent operations corrupt the audit chain
* a retry creates duplicate certificates
* a reissue leaves the original and replacement in an inconsistent state
* a disabled administrator continues using an active session
* a client can manipulate official certificate information
* an audit event silently disappears
* an application crash leaves an unrecoverable ISSUING certificate
* internal database/storage errors are exposed to users
* a production deployment depends on local/ephemeral filesystem state

---

# 2. IMPORTANT WORKING RULE

Before modifying anything:

## STEP 1 — Inspect the entire current project

Inspect:

```text
package.json
src/
supabase/
scripts/
middleware/
configuration files
environment validation
database migrations
API routes
admin UI
public verification
certificate renderer
PDF generation
storage
authentication
authorization
audit system
reissue/revoke lifecycle
health endpoints
maintenance/recovery jobs
tests
```

Do not rely only on filenames.

Read the implementation.

---

# 3. CREATE A CURRENT-STATE AUDIT

Before making changes, create:

```text
PRODUCTION_AUDIT_CURRENT_STATE.md
```

Include:

```text
Area
Current implementation
Risk
Severity
Evidence/file
Required change
Status
```

Use:

```text
P0 = production blocker
P1 = high priority
P2 = hardening
P3 = improvement
```

Do not mark something fixed merely because a related file exists.

Verify actual runtime behavior.

---

# 4. DO NOT REWRITE WORKING FEATURES

Preserve existing working behavior wherever possible.

Especially preserve:

* certificate visual design
* PDF layout
* QR generation
* existing certificate numbering behavior
* existing verification UX
* existing admin workflow
* course/module management
* signatory management
* existing API contracts where practical

Make targeted production-hardening changes.

Do not perform an unnecessary framework migration.

Do not redesign the UI unless required for security or operational correctness.

---

# 5. DATABASE — AUTHORITATIVE SOURCE

The production database must be the authoritative source of truth.

Audit:

```text
src/lib/database/
supabase/migrations/
```

Find every fallback such as:

```text
inMemoryDb
local arrays
mock repositories
development database fallback
filesystem state
```

Production must NEVER silently fall back to memory.

Required behavior:

```text
Production DB available
        ↓
normal operation

Production DB unavailable
        ↓
controlled failure / read-only / 503
```

Never:

```text
DB unavailable
↓
in-memory database
↓
fake NOT_FOUND
```

In-memory storage may exist only for:

```text
development
test
explicit demo mode
```

Make the environment boundary impossible to accidentally bypass.

---

# 6. DATABASE FAILURE CLASSIFICATION

Do not classify every Supabase error as:

```text
schema missing
```

Distinguish:

```text
SCHEMA_MISSING
DATABASE_UNAVAILABLE
DATABASE_TIMEOUT
UNAUTHORIZED
NETWORK_ERROR
UNKNOWN_ERROR
```

Only development environments may optionally use compatibility fallback for an explicitly detected schema problem.

Production must fail safely.

---

# 7. CERTIFICATE STORAGE

Audit the entire storage implementation.

Production certificate PDFs must use durable storage.

Required:

```text
Supabase/private object storage
```

Production must NOT use:

```text
local filesystem fallback
/tmp fallback
ephemeral filesystem
```

If durable storage fails:

```text
issuance must not become ISSUED
```

Use:

```text
ISSUING → ISSUE_FAILED
```

with recovery information.

---

# 8. PDF IMMUTABILITY

Issued certificate PDFs are official artifacts.

Never overwrite them.

Use immutable object keys such as:

```text
issued/{certificateId}/{certificateNumber}-v1.pdf
```

Use:

```text
upsert: false
```

or equivalent collision-safe behavior.

If an artifact already exists unexpectedly:

```text
FAIL SAFELY
```

Do not overwrite it.

Reissue must create a new certificate artifact.

---

# 9. PRIVATE STORAGE

Audit whether certificate PDFs are publicly accessible.

Prefer:

```text
private bucket
+
short-lived signed URL
```

for authorized downloads.

Do not use:

```text
public, max-age=31536000
```

for sensitive official certificate artifacts unless there is a documented business reason.

Verification pages should not expose internal storage paths.

---

# 10. CERTIFICATE ARTIFACT INTEGRITY

Every issued certificate should have:

```text
pdf_sha256
pdf_size
artifact_path
```

Verify the SHA-256 after upload.

Provide an integrity check that can verify:

```text
database metadata
PDF existence
PDF SHA-256
PDF size
certificate number
verification information
snapshot
audit chain
status relationship
```

The integrity endpoint must require appropriate admin permission.

Do not expose internal diagnostics publicly.

---

# 11. VERIFICATION TOKEN SECURITY

Audit the complete verification-token lifecycle.

The database must not retain usable raw verification tokens.

Required:

```text
cryptographically secure random token
        ↓
raw token used temporarily
        ↓
QR/PDF generated
        ↓
SHA-256(token)
        ↓
only hash persisted
```

Do not persist:

```text
verification_token
```

if it allows direct verification.

Migration existing certificates safely.

Before removing the legacy column:

1. verify all existing hashes
2. backfill missing hashes
3. test verification
4. stop new writes
5. remove application dependency
6. remove the raw-token column

Do not break existing certificate verification during migration.

---

# 12. SERVER-AUTHORITATIVE CERTIFICATE DATA

Never trust client-submitted official certificate metadata.

Client may provide IDs and normal input:

```text
courseId
signatoryId
recipientName
studentId
grade
completionDate
```

Server must resolve:

```text
course
course modules
course version
signatory
template
template version
provider
completion statement
renderer version
company configuration
```

The server then constructs the final authoritative certificate input.

The PDF renderer must receive ONLY authoritative server-generated data.

Test deliberate client tampering.

---

# 13. SIGNATORY SECURITY

Remove hardcoded production signatory identity.

Do not rely on:

```text
DEFAULT_SECONDARY_SIGNATORY
```

or equivalent hardcoded business identity.

Resolve the active signatory from the database.

For default secondary signatory:

```text
active = true
is_default_secondary = true
```

must resolve exactly one valid signatory.

If none exists:

```text
BLOCK ISSUANCE
```

Never silently invent a signatory.

Snapshot signatory information at issuance.

---

# 14. CERTIFICATE SNAPSHOT

Every issued certificate must contain a complete historical snapshot.

Include at minimum:

```text
recipient
student ID
certificate number
course ID
course version
course title
duration
modules
grade
completion date
issue date
provider
completion statement
primary signatory
secondary signatory
template ID
template version
renderer version
certificate prefix
verification-token hash
PDF hash
template checksum
```

Historical certificates must remain reconstructable after future course/signatory/template changes.

---

# 15. COURSE VERSIONING

Audit whether editing a course can change the meaning of an already-issued certificate.

If yes, implement versioning.

Recommended:

```text
courses
course_versions
course_modules
```

Certificate references the exact version used during issuance.

Existing certificates must remain historically accurate.

---

# 16. TEMPLATE AND RENDERER INTEGRITY

Record:

```text
template_id
template_version
template_checksum
renderer_version
renderer_checksum
```

The certificate snapshot should preserve these values.

If the template or renderer changes later, old certificates remain traceable to their original generation environment.

---

# 17. CERTIFICATE LIFECYCLE

Use a clear state machine.

Recommended:

```text
DRAFT
  ↓
ISSUING
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
ISSUE_FAILED
  ↓
ISSUING
```

Existing issued certificate:

```text
ISSUED
 ├──→ REVOKED
 └──→ SUPERSEDED
```

Avoid using `REISSUED` as a confusing primary state if the relationship can be represented with:

```text
reissued_from_id
superseded_by_id
```

Preserve compatibility if the existing application already depends on the status.

Do not change statuses blindly.

---

# 18. ISSUANCE TRANSACTIONALITY

Audit the complete issuance flow.

Current conceptual flow should become:

```text
validate input
↓
resolve authoritative data
↓
allocate certificate number
↓
generate verification token
↓
create ISSUING record
↓
render PDF
↓
hash PDF
↓
durably store PDF
↓
verify artifact
↓
finalize certificate as ISSUED
↓
durably record audit event
```

Any failure must result in a known recoverable state.

Never return success merely because PDF generation succeeded.

---

# 19. ISSUANCE RECOVERY

Implement persistent recovery metadata:

```text
issuing_started_at
last_attempt_at
attempt_count
last_error
artifact_path
artifact_sha256
artifact_size
```

Implement a recovery worker/maintenance operation.

Find stale:

```text
ISSUING
```

records.

For each:

```text
artifact exists?
artifact hash matches?
database record complete?
audit state complete?
```

Then:

```text
valid artifact
    → finalize safely

missing/invalid artifact
    → retry

ambiguous repeated failure
    → ADMIN_REVIEW
```

Recovery must be idempotent.

Never allocate a new certificate number unnecessarily during recovery.

---

# 20. REISSUE TRANSACTIONALITY

Reissue must not leave partial state.

Required logical operation:

```text
create replacement
↓
link replacement to original
↓
supersede original
↓
write required audit records
```

Use a database transaction wherever possible.

If external storage prevents a single transaction, implement an explicit operation state machine.

Never allow:

```text
original superseded
but replacement missing
```

or:

```text
replacement exists
but relationship missing
```

without recoverable operation state.

---

# 21. REISSUE IDEMPOTENCY

Implement:

```http
Idempotency-Key
```

or a persistent operation record.

Recommended:

```text
reissue_operations
```

with:

```text
id
idempotency_key UNIQUE
original_certificate_id
replacement_certificate_id
requested_by
status
created_at
completed_at
last_error
```

Repeated requests with the same key must return the same operation/result.

Double-click and browser retry must not create duplicate replacements.

---

# 22. AUDIT CHAIN CONCURRENCY

Audit the current hash-chain implementation.

Do not assume:

```text
read previous event
↓
insert next event
```

is concurrency safe.

It is not sufficient.

Implement one of:

```text
SELECT ... FOR UPDATE
```

or:

```text
SERIALIZABLE transaction
```

or an equivalent atomic audit-head mechanism.

Recommended table:

```text
certificate_audit_heads
```

Fields:

```text
certificate_id
last_event_hash
version
updated_at
```

Event creation must atomically:

```text
lock head
↓
read previous hash
↓
insert event
↓
update head
↓
commit
```

Test with concurrent requests.

---

# 23. AUDIT DURABILITY

Critical events must never silently disappear.

At minimum:

```text
ISSUING
ISSUED
ISSUE_FAILED
REVOKED
SUPERSEDED
REISSUED
```

must be durable.

If direct transactionality is impossible, use a durable outbox.

Recommended:

```text
certificate_event_outbox
```

with:

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

Implement retry processing.

Do not swallow critical audit errors silently.

---

# 24. AUDIT TAMPER ASSURANCE

Hash chains detect modifications but do not prevent a privileged database administrator from rewriting all events and recalculating the chain.

Document this limitation.

For stronger assurance, optionally implement:

```text
daily audit digest
↓
digital signature
↓
external immutable retention
```

Do not claim a hash chain alone provides absolute tamper-proofing.

---

# 25. ADMIN AUTHENTICATION

Audit the current authentication system.

Remove production dependence on:

```text
hardcoded users
environment-password identities
default passwords
admin123
staff123
```

Use persistent admin users.

Recommended:

```text
admin_users
admin_sessions
admin_login_events
```

Passwords:

```text
Argon2id
```

or securely maintained bcrypt if migration requires it.

Never store plaintext passwords.

---

# 26. ADMIN BOOTSTRAP

Implement secure first-admin creation.

Possible flow:

```text
deployment
↓
one-time bootstrap secret
↓
create initial super admin
↓
bootstrap secret invalidated
```

Never expose default credentials in the repository.

Never log passwords or bootstrap secrets.

---

# 27. PERSISTENT ADMIN SESSIONS

If sessions are currently stateless, migrate to persistent sessions.

Cookie should contain a random session identifier.

Database should contain:

```text
session_id
admin_user_id
created_at
expires_at
revoked_at
last_seen_at
ip_address
user_agent
```

Required:

```text
logout
logout all sessions
session expiration
admin disable invalidates sessions
password change can invalidate sessions
```

Use secure cookie settings:

```text
HttpOnly
Secure in production
SameSite=Strict
```

---

# 28. MFA

Require MFA for:

```text
SUPER_ADMIN
```

Prefer:

```text
TOTP
```

or passkeys/WebAuthn where practical.

Protect:

```text
revoke
reissue
admin management
security settings
template management
signatory management
```

with appropriate privileged authentication.

Do not make MFA bypass possible through an unprotected API.

---

# 29. RBAC

Audit current permissions.

Implement granular permissions such as:

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

Enforce permissions at API/server level.

UI hiding is not security.

---

# 30. LOGIN RATE LIMITING

Do not rely only on:

```text
new Map()
```

for production login protection.

Use Redis or another distributed mechanism.

Rate limit by:

```text
IP
username/account
```

Apply progressive protection.

If Redis is unavailable, do not accidentally disable authentication protection.

---

# 31. CLIENT IP HANDLING

Audit:

```text
x-forwarded-for
x-real-ip
```

Do not blindly trust spoofable headers.

Document the trusted proxy architecture.

Only accept forwarded client IP information from configured trusted proxies.

Use the correct connection IP otherwise.

---

# 32. API ERROR SECURITY

Never expose:

```text
database error
SQL error
Supabase error
storage path
stack trace
internal filesystem path
environment variable
```

to users.

Return:

```json
{
  "error": "An internal error occurred.",
  "requestId": "..."
}
```

Log detailed diagnostics server-side.

---

# 33. REQUEST ID

Use one request ID system throughout:

```text
middleware
↓
API
↓
service
↓
database
↓
storage
↓
audit
↓
logs
```

Return:

```http
X-Request-ID
```

Do not create multiple unrelated IDs for the same request.

---

# 34. PUBLIC VERIFICATION

Audit:

```text
/api/verify
```

and all public verification paths.

Required:

```text
no-store caching for dynamic verification
rate limiting
generic not-found behavior
token validation
minimal public information
no internal errors
```

Revocation details should not expose sensitive internal administrative information.

Manual certificate number lookup should remain protected against enumeration.

QR/random-token verification should be the primary verification mechanism.

---

# 35. SECURITY HEADERS

Verify production responses include appropriate headers such as:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Do not blindly add a CSP that breaks the existing application.

Test it.

Document any required exceptions.

---

# 36. CSRF / ORIGIN PROTECTION

Audit all state-changing APIs:

```text
POST
PUT
PATCH
DELETE
```

Verify protection against cross-site requests.

Do not rely solely on frontend behavior.

Test:

```text
missing Origin
malicious Origin
valid Origin
same-site request
```

---

# 37. DATABASE SECURITY

Audit Supabase:

```text
RLS
policies
service-role usage
public keys
database functions
RPC permissions
storage policies
```

Important:

The service-role key must remain server-side only.

Never expose it to:

```text
browser
client bundle
public API response
logs
```

Database functions should use appropriate security settings and permissions.

---

# 38. DATABASE CONSTRAINTS

Add database-level protection for important rules.

Examples:

```text
valid certificate statuses
unique certificate number
unique verification hash
completion_date <= issue_date
valid relationships
single active default signatory
valid reissue relationships
```

Application validation is not sufficient by itself.

---

# 39. STATUS TRANSITION SECURITY

Create a centralized state-transition function.

Example:

```ts
canTransition(
  currentStatus,
  nextStatus
)
```

Allowed transitions must be explicit.

Do not allow arbitrary:

```text
PATCH status
```

from the client.

For example:

```text
ISSUED → DRAFT
```

must never be possible.

---

# 40. REVOCATION

Revocation should record:

```text
category
reason
actor
timestamp
requestId
IP
userAgent
```

Require appropriate permission.

Avoid allowing arbitrary client-side status modification.

Public verification should communicate the revoked status without exposing unnecessary internal details.

---

# 41. ADMIN DEGRADED MODE

Audit the admin UI.

If persistent storage is unavailable:

Do NOT tell administrators:

> certificates issued now will not be saved permanently

while still allowing them to issue.

Instead:

> System degraded — certificate issuance is temporarily disabled because persistent storage is unavailable.

Disable unsafe operations:

```text
issue
reissue
revoke
course mutation
signatory mutation
template mutation
```

Allow safe read-only functionality where appropriate.

---

# 42. ADMIN UI PERMISSION AWARENESS

Hide inaccessible navigation items based on permissions.

But continue enforcing authorization server-side.

Do not expose:

```text
Admin Users
Security
Settings
Audit
```

to users without permission.

---

# 43. HEALTH ENDPOINTS

Audit existing health routes.

Separate:

```text
/liveness
/readiness
```

Liveness:

```text
application process
```

Readiness:

```text
database
redis
storage
required configuration
```

Do not expose secrets.

Use health status for deployment/load balancer decisions.

---

# 44. MONITORING

Add structured monitoring for:

```text
certificate issuance failures
certificate recovery
storage failures
database failures
verification failures
reissue failures
revocations
login failures
rate limiting
audit outbox failures
integrity failures
```

Every important error should have:

```text
requestId
operation
timestamp
actor
certificateId if applicable
safe error code
```

---

# 45. BACKUP AND RESTORE

Define backup strategy for:

```text
PostgreSQL
certificate metadata
audit records
certificate artifacts
configuration
```

Document:

```text
RPO
RTO
```

Do not claim backups are reliable until restoration has actually been tested.

Create a restore test procedure.

---

# 46. PDF REGRESSION TESTING

Do not modify the certificate design unnecessarily.

Create automated tests for:

```text
normal name
long name
Nepali name
long course title
long module title
minimum modules
maximum modules
grades
dates
QR
signatures
```

Test:

```text
PDF generation
PDF readability
QR decoding
required text
layout boundaries
font loading
```

If reference PDFs exist, compare rendered output against them.

---

# 47. SECURITY TEST SUITE

Create automated tests for:

### Authentication

```text
invalid password
expired session
revoked session
disabled admin
privilege escalation
MFA bypass
```

### Authorization

```text
staff → admin API
staff → revoke
staff → reissue
unauthorized template update
unauthorized admin creation
```

### Verification

```text
invalid token
random token
enumeration
rate limit
revoked certificate
superseded certificate
```

### Storage

```text
upload failure
duplicate artifact
missing artifact
hash mismatch
```

### Database

```text
Supabase unavailable
timeout
permission error
transaction rollback
```

### Concurrency

```text
two issuance requests
two reissue requests
two audit events
two revoke requests
```

---

# 48. FAILURE-INJECTION TESTS

Simulate:

```text
DB fails after ISSUING
storage fails
PDF renderer fails
process crashes after PDF upload
final DB update fails
audit insert fails
Redis fails
network timeout
```

For every failure, define the expected state.

No operation should silently enter an unknown state.

---

# 49. REPOSITORY HYGIENE

Remove from production source distribution:

```text
.next/
supabase/.temp/
temporary build files
debug artifacts
obsolete scripts
generated archives
```

Add:

```gitignore
supabase/.temp/
```

Review scripts such as:

```text
_fix.js
_probe.js
_gt3.js
_wirePatch.js
_pdfGap.js
```

Move useful tooling into:

```text
tools/
```

and remove obsolete scripts.

Do not delete scripts blindly if they are still required.

---

# 50. DEPENDENCY SECURITY

Run:

```bash
npm audit
```

and the project's supported package manager security checks.

Review:

```text
outdated dependencies
critical vulnerabilities
deprecated packages
unnecessary packages
```

Do not blindly upgrade major versions.

Document compatibility decisions.

---

# 51. ENVIRONMENT SECURITY

Audit all environment variables.

Production must require:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VERIFY_BASE_URL
ADMIN_SESSION_SECRET
CERTIFICATE_STORAGE_BUCKET
REDIS_URL
```

Ensure:

```text
no production secret defaults
no weak secret defaults
no development credentials in production
no secret logging
```

Validate:

```text
ADMIN_SESSION_SECRET >= required entropy
```

---

# 52. DEPLOYMENT SECURITY

Production deployment should be:

```text
clean repository
↓
install dependencies
↓
run tests
↓
run lint/typecheck
↓
build
↓
apply migrations
↓
deploy
↓
run health checks
↓
run smoke tests
```

Do not deploy `.next` from a developer machine unless the deployment architecture explicitly requires it.

---

# 53. MIGRATION SAFETY

Every new migration must be:

```text
backward-aware
```

Recommended process:

```text
backup
↓
migration
↓
verification
↓
application deployment
↓
smoke test
```

Avoid destructive migration without validation.

For raw verification-token removal:

```text
backfill
→ verify
→ application migration
→ column removal
```

---

# 54. DOCUMENTATION

After implementation create/update:

```text
PRODUCTION_ARCHITECTURE.md
SECURITY_MODEL.md
CERTIFICATE_LIFECYCLE.md
DISASTER_RECOVERY.md
OPERATIONS_RUNBOOK.md
PRODUCTION_GO_LIVE_CHECKLIST.md
```

Keep documentation synchronized with the actual implementation.

Do not document functionality that does not exist.

---

# 55. FINAL TEST COMMANDS

Run the project's actual commands from `package.json`.

At minimum, where supported:

```bash
npm run lint
npm run build
npm test
```

Also run:

```bash
npx tsc --noEmit
```

if TypeScript configuration supports it.

Run relevant migration/database tests.

Fix actual failures rather than suppressing them.

---

# 56. PRODUCTION SMOKE TEST

After deployment:

### Authentication

```text
login
MFA
session
logout
permission
```

### Certificate

```text
create draft
preview
issue
download
verify QR
verify manually
```

### Lifecycle

```text
revoke
verify revoked
reissue
verify replacement
verify original superseded
```

### Integrity

```text
PDF hash
audit chain
certificate integrity
```

### Recovery

```text
simulate failure
run recovery
verify final state
```

---

# 57. REQUIRED FINAL OUTPUTS

After implementation, produce these files:

```text
PRODUCTION_AUDIT_CURRENT_STATE.md
PRODUCTION_HARDENING_IMPLEMENTED.md
PRODUCTION_SECURITY_MODEL.md
PRODUCTION_TEST_REPORT.md
PRODUCTION_GO_LIVE_CHECKLIST.md
```

For each file, use real findings from the current codebase.

---

# 58. FINAL REPORT FORMAT

At the end, provide a concise report:

```text
==================================================
DARBARTECH PRODUCTION READINESS REPORT
==================================================

P0 Remaining: X
P1 Remaining: X
P2 Remaining: X

Security: PASS / PARTIAL / FAIL
Database: PASS / PARTIAL / FAIL
Storage: PASS / PARTIAL / FAIL
Authentication: PASS / PARTIAL / FAIL
Authorization: PASS / PARTIAL / FAIL
Certificate Issuance: PASS / PARTIAL / FAIL
Reissue: PASS / PARTIAL / FAIL
Revocation: PASS / PARTIAL / FAIL
Audit: PASS / PARTIAL / FAIL
Verification: PASS / PARTIAL / FAIL
Recovery: PASS / PARTIAL / FAIL
Testing: PASS / PARTIAL / FAIL
Operations: PASS / PARTIAL / FAIL

Production Ready:
YES / NO

Blocking Issues:
1.
2.
3.

Implemented:
1.
2.
3.

Remaining:
1.
2.
3.
```

Do not say "production ready" if any P0 blocker remains.

---

# 59. CRITICAL RULES

1. **Inspect before modifying.**
2. **Code is the source of truth.**
3. **Do not assume a feature is implemented because a file exists.**
4. **Do not silently introduce development fallbacks into production.**
5. **Do not weaken security to make tests pass.**
6. **Do not expose internal errors.**
7. **Do not trust client-provided official certificate metadata.**
8. **Do not overwrite issued certificate artifacts.**
9. **Do not allow duplicate issuance/reissue through retries.**
10. **Do not silently swallow critical audit failures.**
11. **Do not claim recovery works without testing it.**
12. **Do not claim production readiness while P0 issues remain.**
13. **Preserve the existing certificate visual design unless a technical defect requires a change.**
14. **Use database transactions/constraints for business invariants wherever possible.**
15. **Every production failure must result in a known, recoverable state.**

---

# 60. SUCCESS CONDITION

The final system must behave as a trustworthy official certificate platform:

```text
ADMIN
  ↓
AUTHENTICATED
  ↓
AUTHORIZED
  ↓
SERVER-AUTHORITATIVE INPUT
  ↓
DATABASE
  ↓
ISSUING
  ↓
PDF GENERATION
  ↓
IMMUTABLE DURABLE STORAGE
  ↓
HASH VERIFICATION
  ↓
ISSUED
  ↓
AUDIT
  ↓
QR / TOKEN VERIFICATION
```

With failure recovery:

```text
ANY FAILURE
    ↓
KNOWN STATE
    ↓
PERSISTED ERROR
    ↓
RECOVERY
    ↓
RETRY / FINALIZE / ADMIN REVIEW
```

And for reissue:

```text
ORIGINAL ISSUED
      ↓
REISSUE OPERATION
      ↓
IDEMPOTENT
      ↓
NEW CERTIFICATE
      ↓
ORIGINAL SUPERSEDED
      ↓
AUDITABLE RELATIONSHIP
```

Do not stop after analysis.

**Implement the fixes directly in the current project, add/update migrations and tests where necessary, and produce the requested documentation based on what was actually implemented.**
