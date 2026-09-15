# DarbarTech Certificate System Architecture

## 1. Architecture Goal

Build a certificate system that is:

- scalable
- secure
- maintainable
- print-quality
- template-versioned
- privacy-aware
- easy for administrators
- independent of manual Photoshop work

---

# 2. High-Level Architecture

```text
                 ┌──────────────────────┐
                 │      Admin Panel     │
                 └──────────┬───────────┘
                            │
                            ↓
                 ┌──────────────────────┐
                 │ Certificate Service  │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
       Validation       Database       Template
             │              │              │
             └──────────────┼──────────────┘
                            ↓
                  Certificate Renderer
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
            PDF            PNG             QR
             │              │              │
             └──────────────┼──────────────┘
                            ↓
                       File Storage
                            │
                            ↓
                    Verification API
                            │
                            ↓
                   Public Verification
```

---

# 3. Recommended Components

## Frontend

Existing DarbarTech admin application.

Certificate UI:

- certificate list
- create form
- edit draft
- preview
- issue
- revoke
- reissue
- download
- verification link

## Backend

Certificate service responsible for:

- validation
- numbering
- template selection
- QR/token generation
- rendering
- artifact storage
- database persistence
- audit logging

## Database

Recommended relational model.

---

# 4. Database Model

## certificates

```text
id
certificate_number
verification_token_hash
template_id
template_version
renderer_version

recipient_name
student_id (nullable/private)

program_id
program_title
duration

completion_date
issue_date

grade

status

signatory_id
signatory_name_snapshot
signatory_position_snapshot

public_visibility

pdf_storage_key
preview_storage_key

issued_at
created_at
updated_at
revoked_at
revocation_reason
```

## certificate_modules

```text
id
certificate_id
sort_order
title
subtitle
```

## courses

```text
id
code
title
duration
active
```

## course_modules

```text
id
course_id
sort_order
title
subtitle
active
```

## signatories

```text
id
name
position
signature_storage_key
active
```

## certificate_templates

```text
id
name
version
status
config_storage_key
created_at
published_at
```

## certificate_events

```text
id
certificate_id
event_type
actor_id
metadata
created_at
```

Possible events:

```text
CREATED
PREVIEW_GENERATED
ISSUED
DOWNLOADED
VERIFIED
REVOKED
REISSUED
```

Do not store excessive verification information.

---

# 5. Verification Token

Generate a cryptographically strong random token.

Do not derive it from:

```text
certificate_number
student_name
date_of_birth
phone
email
```

Store a secure representation if the architecture permits.

Public URL:

```text
/verify/<opaque-token>
```

The public API should return a minimal DTO, not the full certificate database record.

---

# 6. Public Verification API

Example conceptual endpoint:

```text
GET /api/public/certificates/verify/:token
```

Response:

```json
{
  "valid": true,
  "status": "VALID",
  "certificate": {
    "certificateNumber": "DT-CERT-2026-00125",
    "recipientName": "Mohan Shahi",
    "programTitle": "Professional Computer & Digital Skills Program",
    "duration": "3 Months",
    "completionDate": "2026-09-08",
    "issueDate": "2026-09-08",
    "grade": "A+",
    "issuer": "DarbarTech Group of Technology"
  }
}
```

Only return fields approved in the privacy/public-verification decision.

---

# 7. Verification Security

Implement:

- HTTPS
- rate limiting
- opaque tokens
- safe errors
- no sequential enumeration
- no private fields
- no admin endpoint exposure
- audit logging
- secure database queries
- input validation

Verification should be safe even if a user scans an invalid token.

---

# 8. Certificate Issuance Transaction

Recommended flow:

```text
POST /admin/certificates
        ↓
Validate input
        ↓
Create DRAFT
        ↓
Generate preview
        ↓
Admin approves
        ↓
Reserve certificate number
        ↓
Generate verification token
        ↓
Render final certificate
        ↓
Validate PDF
        ↓
Store PDF
        ↓
Commit ISSUED state
```

If rendering fails:

```text
DO NOT issue
DO NOT expose verification as VALID
DO NOT mark certificate complete
```

---

# 9. Renderer Interface

The application should abstract the renderer.

Example:

```ts
interface CertificateRenderer {
  renderPreview(input: CertificateRenderInput): Promise<RenderResult>;
  renderPrintPdf(input: CertificateRenderInput): Promise<RenderResult>;
}
```

This allows the system to switch between:

- Photoshop API
- SVG renderer
- PDF renderer
- future renderer

without rewriting the entire certificate service.

---

# 10. Render Input

Example:

```ts
type CertificateRenderInput = {
  templateId: string;
  templateVersion: string;

  certificateNumber: string;

  recipient: {
    name: string;
  };

  program: {
    title: string;
    duration: string;
  };

  modules: Array<{
    order: number;
    title: string;
    subtitle?: string;
  }>;

  grade?: string;

  completionDate?: string;
  issueDate: string;

  signatory: {
    name: string;
    position: string;
    signatureAsset?: string;
  };

  verificationUrl: string;
};
```

---

# 11. Rendering Approaches

## Option 1 — Adobe Photoshop API v2

Use the actual PSD and modify text layers.

Advantages:

- highest potential PSD fidelity
- preserves Photoshop artwork
- existing text styles can be reused
- supports conditional/data-driven layer operations

Disadvantages:

- external service dependency
- API credentials
- cost considerations
- processing latency
- PSD/API-specific failure modes
- font licensing and availability
- more difficult server-side control

Adobe documents Photoshop API v2 as the current production API and supports UXP/ActionJSON workflows for text-layer and layer operations.

## Option 2 — SVG/PDF renderer

Advantages:

- predictable
- scalable
- easy to self-host
- excellent vector text
- efficient for high volume
- easier automated testing

Disadvantages:

- PSD effects may need to be recreated
- initial template reconstruction takes time

## Recommended

Start with a proof-of-concept comparison:

```text
PSD → Photoshop API v2
versus
PSD design → vector/PDF reconstruction
```

Generate the same sample certificate through both.

Choose the method that meets the approved visual fidelity and operational requirements.

---

# 12. Admin UI

## Certificate list

Columns:

```text
Certificate No.
Recipient
Program
Issue Date
Status
Template Version
Actions
```

Actions:

- View
- Preview
- Download
- Verify
- Revoke
- Reissue

## Create form

Sections:

### Recipient
- Name

### Program
- Course
- Duration
- Modules

### Result
- Grade

### Dates
- Completion
- Issue

### Signatory
- Name
- Position

### Verification
- auto-generated token
- generated URL
- QR preview

---

# 13. Preview

Preview must show the exact data that will be issued.

Actions:

```text
EDIT
REGENERATE
APPROVE & ISSUE
CANCEL
```

Do not use a visually different preview engine if avoidable.

---

# 14. Storage

Recommended:

```text
certificates/
    2026/
        DT-CERT-2026-00125/
            certificate.pdf
            preview.png
            metadata.json
```

Use private storage for internal artifacts if appropriate.

Public verification does not need public direct access to the raw PDF unless explicitly approved.

---

# 15. Reissue

A reissue should preserve history.

Example:

```text
Original:
DT-CERT-2026-00125
Status: REVOKED

Replacement:
DT-CERT-2026-00142
Status: VALID
```

Maintain an internal relationship:

```text
reissued_from = DT-CERT-2026-00125
```

---

# 16. Template Versioning

Example:

```text
certificate template v1.0.0
certificate template v1.1.0
certificate template v2.0.0
```

Issued certificates keep their original template version.

New certificates use the currently published version.

---

# 17. Performance

The system should not block the admin browser while a complex rendering job runs.

Recommended for production:

```text
Admin
 ↓
Create render job
 ↓
Queue
 ↓
Worker
 ↓
Render
 ↓
Store
 ↓
Update job status
 ↓
Admin receives result
```

For low volume, synchronous generation may be acceptable initially.

Expected volume must be confirmed before final architecture.

---

# 18. Observability

Log:

- render duration
- renderer type
- template version
- success/failure
- error category
- certificate ID

Do not log:

- unnecessary personal data
- full private records
- sensitive information

---

# 19. Backup

Back up:

- database
- certificate metadata
- issued PDF artifacts
- template versions
- configuration
- audit history

A certificate system without reliable backups is not production-ready.

---

# 20. Disaster Recovery

Document:

- backup frequency
- restore process
- storage redundancy
- retention
- recovery owner

---

# 21. Security Checklist

- [ ] HTTPS
- [ ] admin authentication
- [ ] role-based access
- [ ] server-side validation
- [ ] CSRF protection where applicable
- [ ] rate limiting
- [ ] secure token generation
- [ ] secure storage
- [ ] no private public API fields
- [ ] audit logs
- [ ] secure error handling
- [ ] dependency updates
- [ ] backup
- [ ] restore test
