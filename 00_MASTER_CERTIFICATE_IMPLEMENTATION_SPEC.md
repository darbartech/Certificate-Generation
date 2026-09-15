# DarbarTech Programmable Certificate — Master Implementation Specification

**Document status:** Master specification  
**Version:** 1.0  
**Date:** 2026-09-09  
**Master design:** `CERTIFICATE psd.psd`

---

# 1. Executive Objective

Build a production-grade certificate generation system inside the DarbarTech website/admin panel.

The system must allow an authorized administrator to enter:

- student/recipient information
- course/program
- duration
- training/completion dates
- course modules
- grade/result
- certificate number
- issue date
- authorized signatory
- verification information

and automatically generate a certificate using the approved DarbarTech visual design.

The output must preserve the design language, proportions, typography, spacing, colors, QR placement, branding and print quality of the supplied PSD.

The system must support both:

1. **Digital preview/download**
2. **Professional print output**

---

# 2. Non-Negotiable Requirements

## 2.1 Design fidelity

The automated certificate must remain visually consistent with the approved PSD.

Do not:

- redesign the certificate without approval
- change the brand logo
- change the approved color hierarchy
- substitute fonts without approval
- move static artwork unnecessarily
- replace the certificate with a generic HTML-looking template
- render the entire certificate as a low-resolution screenshot

## 2.2 Print quality

Target:

- A4 landscape
- 297 × 210 mm trim size
- 300 PPI equivalent for raster assets
- vector text whenever practical
- vector logo/artwork whenever practical
- high-resolution/vector QR
- embedded/licensed fonts
- correct CMYK print workflow
- optional 3 mm bleed when required by printer
- PDF/X-4 or printer-specified PDF/X output

The supplied PSD is 3508 × 2480 px at 300 PPI in CMYK 8-bit.

Do not downsample the master artwork during normal generation.

## 2.3 Data-driven generation

All approved dynamic fields must come from structured data.

Never edit generated certificates manually as the normal workflow.

## 2.4 Verification

Every issued certificate must have a unique verification token.

Recommended public URL pattern:

`https://<official-domain>/verify/<opaque-token>`

The token should not expose personal information.

Human-readable certificate number may remain:

`DT-CERT-2026-00125`

The certificate number should not be the only security mechanism.

## 2.5 Privacy

Public verification must reveal only the minimum information necessary to establish authenticity.

Do not publicly expose:

- phone number
- email
- address
- citizenship/National ID
- date of birth unless explicitly approved
- guardian information
- payment information
- internal student ID
- attendance records
- internal remarks
- private assessment information
- admin notes

Any public display of student data must be intentionally approved.

---

# 3. Recommended Product Workflow

```text
ADMIN LOGIN
   ↓
Certificate Manager
   ↓
Create Certificate
   ↓
Select Student / Enter Recipient
   ↓
Select Course
   ↓
Select Modules
   ↓
Enter Completion + Issue Data
   ↓
Select Grade
   ↓
Select Authorized Signatory
   ↓
Generate Preview
   ↓
Run Validation
   ↓
Admin Approval
   ↓
Issue Certificate
   ↓
Generate immutable certificate snapshot
   ↓
Generate PDF / preview
   ↓
Generate QR
   ↓
Store certificate
   ↓
Public verification becomes available
```

---

# 4. Admin Data Model

## 4.1 Recipient

Required:

- full name

Optional, only if operationally needed:

- student reference ID

Do not make sensitive personal data part of certificate generation unless there is a real business requirement.

## 4.2 Program

Required:

- program/course title
- duration

Optional:

- program code
- category
- description

## 4.3 Modules

Each module should support:

- order
- title
- subtitle/description
- optional short label

Example:

```json
[
  {
    "order": 1,
    "title": "COMPUTER FUNDAMENTALS",
    "subtitle": "Basic Computer Operations"
  },
  {
    "order": 2,
    "title": "OFFICE APPLICATIONS",
    "subtitle": "Microsoft Word | Excel | PowerPoint"
  }
]
```

The rendering engine must not assume that every certificate has exactly four modules.

However, the template must define a supported range.

**REQUIRED CONFIRMATION:** maximum module count for the approved design.

Recommended initial range: 3–6 modules.

## 4.4 Result

Fields:

- grade/result
- optional score
- optional distinction/achievement text

**REQUIRED CONFIRMATION:** whether grade is always displayed.

## 4.5 Dates

Separate fields:

- enrollment/start date
- completion date
- issue date

Only display dates approved by the certificate design.

**REQUIRED CONFIRMATION:** exact date wording and format.

Recommended display:

`08 SEPTEMBER 2026`

## 4.6 Signatory

Do not default the recipient as the authorized signatory.

Required:

- signatory name
- signatory position
- optional signature image
- active/inactive state

The system must validate that the recipient and authorized signatory are not accidentally the same unless explicitly allowed.

---

# 5. Certificate Numbering

Recommended:

`DT-CERT-YYYY-NNNNN`

Example:

`DT-CERT-2026-00125`

Rules:

- generated server-side
- unique
- never reused
- never changed after issuance
- sequentiality must not be treated as the security token
- support future numbering rules

**REQUIRED CONFIRMATION:**

1. Is numbering global across all courses?
2. Does numbering reset every year?
3. Can an administrator manually override a number?
4. Should cancelled numbers remain reserved?
5. What prefix should be permanent?

Recommended policy:

> Certificate numbers are generated by the server, never reused, and remain immutable after issuance.

---

# 6. QR and Verification

QR content should be a unique HTTPS verification URL.

Recommended:

```text
https://<official-domain>/verify/<opaque-token>
```

Avoid putting the recipient's name, email, phone or other personal information directly into the QR.

Verification states:

- VALID
- REVOKED
- NOT FOUND

A public verification page should show only approved fields.

Recommended public result:

```text
Certificate Verified

Certificate No.: DT-CERT-2026-00125
Recipient: Mohan Shahi
Program: Professional Computer & Digital Skills Program
Duration: 3 Months
Completion Date: 08 September 2026
Issue Date: 08 September 2026
Grade: A+
Issued By: DarbarTech Group of Technology
Status: VALID
```

**REQUIRED CONFIRMATION:** exact public fields.

---

# 7. Immutable Issued Certificate

Once a certificate is issued:

- certificate number cannot change
- verification token cannot change
- issued data must be snapshotted
- template version must be stored
- generation timestamp must be stored
- issuer/admin identity should be recorded internally
- later course/student edits must not silently rewrite an already issued certificate

If a correction is needed, use a controlled replacement/reissue process.

Recommended statuses:

```text
DRAFT
PREVIEW
ISSUED
REVOKED
REISSUED
CANCELLED
```

Publicly expose only appropriate statuses.

---

# 8. Template Versioning

Every generated certificate must store:

- template ID
- template version
- renderer version
- generation timestamp

Example:

```text
Template: darbartech-certificate
Version: 1.0.0
Renderer: certificate-engine 1.0.0
```

This is critical because the visual design may change in the future.

Old certificates must remain tied to the version used when they were issued.

---

# 9. Dynamic Text Engine

Dynamic text must be rendered inside predefined bounding boxes.

For each field define:

```text
field
x
y
width
height
font
fontSize
weight
color
alignment
lineHeight
letterSpacing
maxLines
minFontSize
overflowPolicy
```

Example:

```json
{
  "field": "student_name",
  "x": 900,
  "y": 920,
  "width": 1700,
  "height": 180,
  "alignment": "center",
  "maxLines": 1,
  "minFontSize": 24,
  "overflowPolicy": "shrink_then_reject"
}
```

## Text fitting algorithm

Use this order:

1. Render at approved font size.
2. Measure actual rendered width.
3. If it fits, keep it.
4. If it does not fit, reduce size within approved limits.
5. If minimum size is reached and it still does not fit, reject generation with a clear admin error.
6. Never silently clip text.
7. Never stretch text horizontally to force a fit.
8. Never change the certificate layout automatically unless that behavior is explicitly designed.

---

# 10. Course Module Layout

The module area must be treated as a controlled component.

Support:

- variable module count
- variable title length
- variable subtitle length
- ordering
- optional subtitles

The system must validate:

```text
minimum modules
maximum modules
maximum title length
maximum subtitle length
```

**REQUIRED CONFIRMATION:** exact values based on the final approved design.

Recommended initial constraints:

- 3–6 modules
- module title: max 45 characters
- subtitle: max 80 characters

These are engineering defaults, not final design decisions.

---

# 11. Output Formats

Required:

### A. Preview

Fast preview for admin.

Suggested:

- PNG or browser preview
- lower processing cost
- not treated as the print master

### B. Print PDF

Primary final artifact.

Requirements:

- A4 landscape
- print-ready
- embedded fonts where licensing permits
- high-resolution images
- vector text/graphics where practical
- proper color management
- PDF/X-4 or printer-approved equivalent

### C. Optional high-resolution PNG

Useful for digital sharing and archive previews.

Do not use the PNG as the primary print artifact unless there is a specific requirement.

---

# 12. Rendering Strategy

There are three valid implementation paths.

## Path A — Adobe Photoshop API v2

Use when exact PSD fidelity is the highest priority and Adobe cloud processing/cost is acceptable.

Adobe's current v2 API supports:

- editing PSD text layers
- font/style changes
- text positioning
- UXP scripts
- ActionJSON
- batch layer operations
- custom fonts
- more advanced Photoshop automation

Use v2, not legacy v1.

## Path B — Recreated vector/PDF renderer

Recommended long-term architecture when:

- high volume is expected
- predictable server-side rendering is required
- recurring API costs should be minimized
- exact control over PDF generation is important

Recreate the approved static design as vector/SVG/PDF assets and dynamically render text and QR.

## Path C — Hybrid

Recommended for this project if the PSD contains complex artwork:

- preserve complex static artwork
- rebuild dynamic text areas as programmable layers
- use vector text
- dynamically generate QR
- generate print PDF
- retain PSD as design master

The final architecture must be selected after PSD layer inspection and a proof-of-output comparison.

---

# 13. Quality Gate

Before production, generate at least:

1. Short student name
2. Long student name
3. Short course
4. Long course
5. Minimum module count
6. Maximum module count
7. Long module titles
8. Nepali/Unicode content if supported
9. A+
10. Other supported grades
11. Long certificate number
12. QR scan test
13. PDF print test

Compare the output against the approved PSD.

Acceptance target:

> No visible unintended difference in layout, typography, spacing, branding, color hierarchy or sharpness.

Small rendering differences caused by a different rendering engine must be reviewed and approved before production.

---

# 14. Security Requirements

Admin:

- authentication required
- role-based authorization
- only authorized staff can issue/revoke
- audit logs
- server-side validation
- rate limiting
- secure file storage
- signed/private storage URLs where applicable
- HTTPS only

Public verification:

- no admin functionality
- no private API fields
- rate limiting
- opaque verification token
- safe error messages
- no database enumeration

Never allow:

```text
/verify/1
/verify/2
/verify/3
```

to expose the entire certificate database.

Prefer random tokens.

---

# 15. Privacy Requirements

The system should follow a data-minimization model:

```text
PRIVATE DATABASE
      ↓
minimal public verification record
```

Do not expose private student data merely because it exists in the database.

The project owner should obtain appropriate consent and have the final privacy/verification wording reviewed for the applicable Nepal legal requirements.

This specification is an engineering document, not legal advice.

---

# 16. Failure Handling

Generation must fail safely.

Examples:

```text
Student name is required.
Course is required.
Certificate number already exists.
Module count exceeds template limit.
Student name cannot fit the approved area.
Required font is unavailable.
QR generation failed.
Template version is unavailable.
PDF generation failed.
```

Never create a certificate record marked `ISSUED` if the final artifact was not successfully generated and stored.

Use a transaction-like issuance flow:

```text
Validate
 ↓
Render
 ↓
Validate output
 ↓
Store artifact
 ↓
Commit ISSUE
```

---

# 17. Admin Preview

Before issuance, show:

- full certificate preview
- certificate number
- QR
- student name
- program
- modules
- grade
- dates
- signatory

Actions:

- Edit
- Regenerate Preview
- Approve & Issue
- Cancel

The preview must use the same renderer/configuration as the final certificate wherever possible so that the preview is trustworthy.

---

# 18. Audit Log

Record internally:

- who created it
- who previewed it
- who issued it
- who revoked it
- who reissued it
- timestamps
- certificate ID
- template version
- renderer version
- reason for revocation/reissue

Do not expose internal audit logs publicly.

---

# 19. Required Project Decisions

Do not mark this specification complete until the project owner answers the questions in:

`01_REQUIRED_INFORMATION_AND_DECISIONS.md`

Unknown decisions must be explicitly marked:

`TBD — OWNER CONFIRMATION REQUIRED`

Never silently invent a value that affects the official certificate.

---

# 20. Definition of Done

The system is complete only when all are true:

- [ ] PSD analyzed
- [ ] all dynamic fields mapped
- [ ] all static assets identified
- [ ] exact fonts identified and licensing confirmed
- [ ] final template geometry approved
- [ ] course module constraints approved
- [ ] certificate numbering approved
- [ ] QR/verification URL approved
- [ ] public verification fields approved
- [ ] privacy approach approved
- [ ] admin workflow implemented
- [ ] preview implemented
- [ ] PDF generation implemented
- [ ] PNG preview implemented
- [ ] output tested at A4
- [ ] QR scanned from printed test
- [ ] long-name test passed
- [ ] long-course test passed
- [ ] maximum-module test passed
- [ ] Unicode/Nepali test passed if supported
- [ ] revoked-certificate test passed
- [ ] security test passed
- [ ] audit log test passed
- [ ] printer proof approved
- [ ] production backup/recovery plan approved
