# DarbarTech Certificate System — Required Information & Decisions

**Purpose:** Collect every project decision required to implement the programmable certificate correctly.

> Please answer every item. If something does not apply, write `N/A`. If you want the developer to choose, write `DEVELOPER RECOMMENDATION`.

---

# A. Website / Technology

### A1. Existing website stack

- [ ] Next.js
- [ ] React
- [ ] Node.js
- [ ] PHP/Laravel
- [ ] WordPress
- [ ] Other: __________________

**Answer:**

### A2. Existing backend

**Answer:**

### A3. Existing database

- [ ] PostgreSQL
- [ ] MySQL
- [ ] MongoDB
- [ ] Supabase
- [ ] Firebase
- [ ] Other: __________________

**Answer:**

### A4. Existing file storage

- [ ] Local server
- [ ] AWS S3
- [ ] Cloudflare R2
- [ ] Supabase Storage
- [ ] Cloudinary
- [ ] Other: __________________

**Answer:**

### A5. Existing admin authentication

**Answer:**

### A6. Where should certificate management appear in the admin panel?

**Answer:**

---

# B. PSD / Design

The supplied PSD has been technically inspected as:

- 3508 × 2480 px
- 300 PPI
- CMYK
- 8-bit
- A4 landscape proportions

### B1. Is this PSD the final approved master design?

- [ ] YES
- [ ] NO — another version will be supplied

**Answer:**

### B2. Are there any design changes still required?

**Answer:**

### B3. Must the generated certificate be pixel-level identical to the PSD?

- [ ] YES
- [ ] Very close visual match is sufficient
- [ ] Developer may optimize the layout while preserving design

**Answer:**

### B4. Should the final renderer use the PSD directly?

- [ ] Adobe Photoshop API v2
- [ ] Recreate design as SVG/PDF/vector
- [ ] Hybrid
- [ ] Developer recommendation

**Answer:**

---

# C. Fonts

### C1. List every font used in the PSD.

| Purpose | Font | Weight/Style |
|---|---|---|
| Main title | | |
| Recipient name | | |
| Program title | | |
| Body | | |
| Module title | | |
| Module subtitle | | |
| Signature | | |
| Footer | | |

### C2. Do you own/hold the required licenses for server-side use?

- [ ] YES
- [ ] NO
- [ ] UNKNOWN

**Answer:**

### C3. If a font cannot legally be deployed server-side, approve a replacement?

- [ ] YES
- [ ] NO

**Answer:**

---

# D. Certificate Content

### D1. Exact main title

Example:

`CERTIFICATE OF COMPLETION`

**Answer:**

### D2. Exact pre-recipient text

**Answer:**

### D3. Exact recipient wording

**Answer:**

### D4. Exact completion wording

**Answer:**

### D5. Exact achievement statement

**Answer:**

### D6. Exact footer wording

**Answer:**

---

# E. Student / Recipient Data

### E1. Required recipient fields

- [ ] Full name
- [ ] Student ID
- [ ] Photo
- [ ] Other: __________

**Answer:**

### E2. Should student photo appear on the certificate?

- [ ] YES
- [ ] NO

If yes:

- required size: __________
- required format: __________
- fallback if no photo: __________

---

# F. Course / Program

### F1. Should courses be managed from the admin panel?

- [ ] YES
- [ ] NO

### F2. Should modules be managed from the admin panel?

- [ ] YES
- [ ] NO

### F3. Minimum number of modules

**Answer:**

### F4. Maximum number of modules

**Answer:**

### F5. Maximum module title length

**Answer:**

### F6. Maximum module subtitle length

**Answer:**

### F7. Can different courses have different module counts?

- [ ] YES
- [ ] NO

### F8. Can administrators create new courses without developer involvement?

- [ ] YES
- [ ] NO

---

# G. Duration / Dates

### G1. What dates are stored?

- [ ] Training start date
- [ ] Training end/completion date
- [ ] Issue date
- [ ] Other: __________

### G2. Exact display format

Examples:

`08 SEPTEMBER 2026`

`08 Sep 2026`

`2026-09-08`

**Answer:**

### G3. Should completion date and issue date be allowed to differ?

- [ ] YES
- [ ] NO

---

# H. Grade / Result

### H1. Is grade required?

- [ ] YES
- [ ] NO

### H2. Allowed grades

Example:

`A+ / A / B+ / B / C+ / C / D / PASS`

**Answer:**

### H3. Should score/percentage be displayed?

- [ ] YES
- [ ] NO

### H4. Should distinction text be displayed?

- [ ] YES
- [ ] NO

---

# I. Certificate Number

### I1. Confirm format

Example:

`DT-CERT-2026-00125`

**Answer:**

### I2. Global sequence or course-specific sequence?

**Answer:**

### I3. Reset sequence each year?

- [ ] YES
- [ ] NO

### I4. Can admins manually edit certificate numbers?

- [ ] YES
- [ ] NO

Recommended: NO after issuance.

### I5. Should cancelled/revoked numbers ever be reused?

- [ ] YES
- [ ] NO

Recommended: NO.

---

# J. Authorized Signatory

### J1. Who can be a signatory?

**Answer:**

### J2. Should signatories be managed from admin?

- [ ] YES
- [ ] NO

### J3. Signature image?

- [ ] YES
- [ ] NO

### J4. Signatory fields

- Name
- Position
- Signature image
- Active/inactive

Confirm:

**Answer:**

---

# K. QR / Digital Verification

### K1. Official verification domain

Example:

`https://example.com/verify`

**Answer:**

### K2. QR URL strategy

- [ ] Certificate number
- [ ] Random opaque token
- [ ] Other

Recommended: random opaque token.

### K3. Should manual verification also be available?

- [ ] YES
- [ ] NO

Recommended: YES.

### K4. Public verification fields

Select exactly what should be public:

- [ ] Certificate number
- [ ] Recipient name
- [ ] Course/program
- [ ] Duration
- [ ] Completion date
- [ ] Issue date
- [ ] Grade
- [ ] Issuer
- [ ] Status
- [ ] Module list
- [ ] Student ID
- [ ] Photo
- [ ] Other: __________

### K5. Verification status

- [ ] VALID
- [ ] REVOKED
- [ ] NOT FOUND
- [ ] EXPIRED
- [ ] Other: __________

---

# L. Privacy

### L1. Do you already have a Privacy Policy?

- [ ] YES
- [ ] NO

### L2. Is student consent collected?

- [ ] YES
- [ ] NO
- [ ] UNKNOWN

### L3. Should public verification display the student's full name?

- [ ] YES
- [ ] NO
- [ ] Masked name

### L4. Should certificates belonging to minors be supported?

- [ ] YES
- [ ] NO
- [ ] FUTURE

If YES, specify the consent/guardian workflow approved by your organization.

---

# M. Output

### M1. Required output

- [ ] PDF
- [ ] PNG
- [ ] JPG
- [ ] PSD
- [ ] Other: __________

### M2. Primary print format

Recommended:

`A4 Landscape`

**Answer:**

### M3. Bleed

- [ ] 0 mm
- [ ] 3 mm
- [ ] Other: __________

### M4. Printer PDF standard

- [ ] PDF/X-4
- [ ] PDF/X-1a
- [ ] Printer-specific
- [ ] Unknown

### M5. Should the system provide a downloadable print PDF?

- [ ] YES
- [ ] NO

---

# N. Storage

### N1. Keep generated PDF permanently?

- [ ] YES
- [ ] NO

### N2. Keep preview image?

- [ ] YES
- [ ] NO

### N3. Store source data snapshot?

- [ ] YES
- [ ] NO

Recommended: YES.

### N4. Retention period

**Answer:**

---

# O. Revocation / Reissue

### O1. Can certificates be revoked?

- [ ] YES
- [ ] NO

### O2. Who can revoke?

**Answer:**

### O3. Is revocation reason required?

- [ ] YES
- [ ] NO

Recommended: YES.

### O4. Can a certificate be reissued?

- [ ] YES
- [ ] NO

### O5. Does reissue create a new certificate number?

- [ ] YES
- [ ] NO

Recommended: YES, if the certificate itself changes materially.

---

# P. Admin Roles

List roles:

| Role | Create | Preview | Issue | Revoke | Download | Manage Templates |
|---|---:|---:|---:|---:|---:|---:|
| Super Admin | | | | | | |
| Admin | | | | | | |
| Staff | | | | | | |

---

# Q. Branding / Contact

### Q1. Official company name

**Answer:**

### Q2. Official website

**Answer:**

### Q3. Official email

**Answer:**

### Q4. Official phone

**Answer:**

### Q5. Should contact information appear in certificate footer?

- [ ] YES
- [ ] NO

### Q6. Exact contact line

**Answer:**

---

# R. Technical Decisions

### R1. Preferred rendering method

- [ ] Adobe Photoshop API v2
- [ ] SVG/PDF renderer
- [ ] Hybrid
- [ ] Developer recommendation

### R2. Expected certificate volume

Per day: ______

Per month: ______

Per year: ______

### R3. Expected peak simultaneous generation

**Answer:**

### R4. Hosting environment

**Answer:**

### R5. Budget for third-party rendering APIs

**Answer:**

---

# S. Final Approval

Before development begins, confirm:

- [ ] PSD is final
- [ ] fonts are confirmed
- [ ] dynamic fields are confirmed
- [ ] module limits are confirmed
- [ ] certificate numbering is confirmed
- [ ] QR URL/domain is confirmed
- [ ] public verification fields are confirmed
- [ ] privacy requirements are confirmed
- [ ] signatories are confirmed
- [ ] output format is confirmed
- [ ] bleed/printer requirements are confirmed
- [ ] rendering strategy is confirmed

**Approved by:** __________________

**Date:** __________________

**Notes:** __________________
