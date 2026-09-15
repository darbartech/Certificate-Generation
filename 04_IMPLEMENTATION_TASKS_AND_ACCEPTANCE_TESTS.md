# DarbarTech Certificate System — Implementation Plan & Acceptance Tests

# Phase 0 — Requirements Freeze

- [ ] Complete `01_REQUIRED_INFORMATION_AND_DECISIONS.md`
- [ ] Confirm official domain
- [ ] Confirm signatories
- [ ] Confirm fonts
- [ ] Confirm course/module rules
- [ ] Confirm public verification fields
- [ ] Confirm numbering rules
- [ ] Confirm printer requirements

**Gate:** No unresolved requirement that affects official certificate output.

---

# Phase 1 — PSD Audit

- [ ] Inspect all PSD layers
- [ ] Export layer manifest
- [ ] Identify all text layers
- [ ] Identify all fonts
- [ ] Identify all colors
- [ ] identify static artwork
- [ ] identify QR location
- [ ] identify signature location
- [ ] measure dynamic bounding boxes
- [ ] document layer IDs/names

**Deliverable:**

`PSD_LAYER_MANIFEST.json`

---

# Phase 2 — Template Preparation

- [ ] Rename dynamic layers consistently
- [ ] Define template ID
- [ ] Define template version
- [ ] Create field manifest
- [ ] Define text fitting rules
- [ ] Define module layout rules
- [ ] Define QR specification
- [ ] Define signature rules

**Deliverables:**

```text
template.json
field-manifest.json
typography.json
```

---

# Phase 3 — Data Model

Implement:

- [ ] certificates
- [ ] certificate_modules
- [ ] courses
- [ ] course_modules
- [ ] signatories
- [ ] certificate_templates
- [ ] certificate_events

---

# Phase 4 — Certificate Numbering

Implement:

- [ ] server-side generation
- [ ] uniqueness constraint
- [ ] concurrency-safe sequence
- [ ] immutable issued number
- [ ] no reuse policy
- [ ] audit event

Test concurrent creation.

---

# Phase 5 — QR / Verification

Implement:

- [ ] random verification token
- [ ] HTTPS URL
- [ ] QR generation
- [ ] verification endpoint
- [ ] verification page
- [ ] VALID
- [ ] REVOKED
- [ ] NOT FOUND
- [ ] rate limiting
- [ ] minimal public response

---

# Phase 6 — Renderer

Implement:

- [ ] preview renderer
- [ ] print renderer
- [ ] text fitting
- [ ] module renderer
- [ ] QR renderer
- [ ] date renderer
- [ ] grade renderer
- [ ] signatory renderer
- [ ] PDF output
- [ ] optional PNG output

---

# Phase 7 — Admin UI

Implement:

- [ ] certificate list
- [ ] create certificate
- [ ] edit draft
- [ ] module management
- [ ] preview
- [ ] issue
- [ ] download
- [ ] verification link
- [ ] revoke
- [ ] reissue
- [ ] audit history

---

# Phase 8 — Print QA

Generate samples:

### Test 1 — Normal

```text
Mohan Shahi
4 modules
A+
```

### Test 2 — Long recipient

Use a deliberately long but realistic name.

Expected:

- no clipping
- no overlap
- visual hierarchy preserved

### Test 3 — Long course

Expected:

- title fits
- line wrapping follows template rule
- no overlap

### Test 4 — Maximum modules

Expected:

- all modules visible
- no collision
- readable

### Test 5 — Minimum modules

Expected:

- balanced layout
- no excessive empty area unless intentionally designed

### Test 6 — QR

Expected:

- scans from screen
- scans from printed certificate
- opens correct verification record

### Test 7 — Revoked certificate

Expected:

- public page shows REVOKED
- original certificate remains historically identifiable
- no false VALID status

### Test 8 — Unicode/Nepali

If supported:

- correct glyphs
- no missing characters
- no font substitution
- PDF text remains correct

---

# Phase 9 — Visual Regression

For every release:

1. Generate fixed reference data.
2. Render certificate.
3. Compare against approved reference.
4. Check alignment.
5. Check text.
6. Check colors.
7. Check QR.
8. Check footer.
9. Check signatures.
10. Approve before production deployment.

---

# Phase 10 — Security Tests

- [ ] Unauthorized admin cannot issue
- [ ] Unauthorized admin cannot revoke
- [ ] Sequential certificate guessing does not expose records
- [ ] Random token guessing does not reveal records
- [ ] Public API does not return private fields
- [ ] QR URL is HTTPS
- [ ] Rate limiting works
- [ ] Invalid token gives safe response
- [ ] SQL/NoSQL injection protections verified
- [ ] File access controls verified
- [ ] audit logs cannot be modified by normal staff

---

# Phase 11 — Data Integrity Tests

- [ ] duplicate certificate number rejected
- [ ] issued certificate cannot silently change
- [ ] template version stored
- [ ] renderer version stored
- [ ] revocation stored
- [ ] reissue history preserved
- [ ] deletion policy tested
- [ ] backup restored successfully

---

# Definition of Done

A release is production-ready only if:

```text
DESIGN
✓ Approved visual match

DATA
✓ All required fields validated

RENDERING
✓ No clipping
✓ No overflow
✓ No unexpected font substitution
✓ Print-quality PDF

QR
✓ Unique
✓ Scannable
✓ Correct verification result

SECURITY
✓ Admin protected
✓ Public data minimized
✓ No sequential enumeration

DATABASE
✓ Immutable issuance snapshot
✓ Audit history
✓ Versioning

PRINT
✓ A4 correct
✓ Printer proof approved
✓ Colors approved
```

---

# Final Acceptance Test

Print one certificate using the same workflow a real administrator will use.

Then physically inspect:

- recipient name
- course title
- modules
- grade
- certificate number
- QR
- logo
- border
- signatures
- footer
- colors
- sharpness

Scan the QR from the physical print.

If the physical result is approved by the certificate owner/printer, the template can be marked:

`PRODUCTION APPROVED`
