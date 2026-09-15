# 4. Typography Specification

## 4.1 Typefaces

- **Montserrat** (Google Fonts) — used for virtually all UI/body text: headers, labels, numerals, footer. Weights required: Regular, Medium, SemiBold, Bold, ExtraBold.
- **Cormorant Garamond Bold** (Google Fonts) — used exclusively for the recipient's name. A serif display face that gives the certificate its formal focal point.
- Both are free, openly-licensed Google Fonts — no licensing cost or restriction to embed them server-side or in a print-ready PDF (see `07_FONT_LICENSING_AND_ASSETS.md`).

## 4.2 Type scale (largest → smallest)

| Size (pt) | Role | Font | Example |
| --- | --- | --- | --- |
| 191.7 | Recipient name (hero) | Cormorant Garamond Bold | MOHAN SHAHI |
| 133.3 | Main headline | Montserrat ExtraBold | Certificate of completion |
| 100.0 | Grade value accent run | Montserrat ExtraBold | Final Grade \| a+ (large run) |
| 75.0 | Module numerals / grade suffix | Montserrat ExtraBold | 01 02 03 04 |
| 70.8 | Program title | Montserrat SemiBold | PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM |
| 50.0 | Body emphasis line | Montserrat Regular | has successfully completed the |
| 45.8 | Section labels | Montserrat SemiBold | COURSE MODULES, THIS IS TO CERTIFY THAT, duration sentence |
| 41.7 | Column headers / labels | Montserrat SemiBold | COMPUTER FUNDAMENTALS, Final Grade label |
| 37.5 | Body text / labels | Montserrat SemiBold / Medium | AUTHORIZED SIGNATORY, cert-no / issue-date pair |
| 33.3 | Body text / labels | Montserrat Regular / Bold | Signatory names, dates, DIGITAL VERIFICATION |
| 32.8 | Small print | Montserrat Regular | CERTIFICATE NO., Verified & Authentic |
| 29.2 | Fine print | Montserrat Regular / Medium | QR caption, footer contact line |

## 4.3 Styling conventions

- All-caps is applied via the "All Caps" character style (not literal typed caps) to: Verified & Authentic, Certificate of completion, This is to certify that, the recipient name, Final Grade | a+, Date of issue, the long issue date, Authorized Signatory, Managing director, and all module titles/heading labels.
- Letter tracking is used heavily for a premium/formal feel: from 0 (default body copy) up to 180 on "COURSE MODULES" and 170 on "THIS IS TO CERTIFY THAT" — both extreme values, intentional.
- Multi-colour runs within a single text layer are used for emphasis — e.g. "Certificate of completion" splits Navy + Blue; the duration sentence alternates body-ink and Blue to highlight the duration and provider name (see `04_ZONE_BY_ZONE_ELEMENT_MAP.md`, Zone 5).
- Paragraph alignment: the completion statement is centered; most labels are left-aligned; the signature block and footer labels are centered within their own text boxes.
