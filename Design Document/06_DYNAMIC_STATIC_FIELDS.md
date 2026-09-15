# 7. Dynamic vs. Static Field Classification

These are the exact fields that change per recipient — the "template variables" — versus text/graphics that are identical on every certificate issued from this template.

## 7.1 Dynamic (per-certificate) fields

| Field | Sample value in master PSD | Where it appears | Notes |
| --- | --- | --- | --- |
| recipientName | MOHAN SHAHI | "MOHAN SHAHI" layer | Full recipient name, upper-cased by design |
| certificateNumber | DT-CERT-2026-00125 | appears 3×: top-right, footer bar, footer sub-line | Must be generated uniquely per certificate |
| issueDate (short) | 2026-09-08 | top-right meta line | ISO format, paired with certificate number |
| issueDate (long) | 08 September 2026 | bottom "Date of issue" block | Long format, all-caps styling applied |
| programTitle | PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM | own layer | Course / program name |
| duration | 3-month | first run of duration sentence | Programme length |
| trainingProvider | DarbarTech Group of Technology | embedded run in duration sentence | Issuing organization name |
| module 1–4 (index, title, subtitle) | 01–04 / titles / subtitles | course modules group | Fixed 4-column grid; each column needs number + title + subtitle |
| finalGrade | A+ | "Final Grade \| a+" layer | Grade / result value |
| signatory1Name | Mohan Shahi | bottom-authorized group | Authorized signatory name |
| signatory2Name / title | Nirmala Shrestha / Managing director | bottom-authorized group | Second signatory name + role |
| qrPayload | darbartech.com/verify | QR caption text + QR image | Should resolve to https://<domain>/verify/<token>, not embed personal data |

## 7.2 Static (identical on every certificate)

| Element | Notes |
| --- | --- |
| Certificate of completion | hero headline — never changes |
| This is to certify that | salutation line |
| has successfully completed the | connective sentence |
| "Successfully completed all required course modules and demonstrated practical competency in the skills covered by the program" | completion statement (could become dynamic if variants are needed later) |
| "Verified & Authentic" / "DIGITAL VERIFICATION" / "Scan QR code to verify authenticity" | footer verification labels |
| "AUTHORIZED SIGNATORY" / "Managing director" labels | role labels (title of signatory 2 is effectively dynamic if signatories change) |
| www.darbartech.com \| info@darbartech.com \| +977-9865365409 | organization contact block |
| Logo (final-logo) and watermark (final small logo) | brand assets — Smart Objects in PSD |
| All corner-ribbon, divider, and border shapes | pure decoration — identical on every certificate |

> **Data-integrity note carried over from the PSD:** in the master file, the recipient's name (Mohan Shahi) also appears as the "Authorized Signatory" name. This is almost certainly placeholder/sample data left over from building the template — confirm the real signatory before this design is used to issue an actual certificate.
