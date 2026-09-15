# 5. Zone-by-Zone Element Map

All positions are given in millimetres from the top-left of the 297×210mm canvas (matching the existing `TemplateConfig` "mm" unit convention). Font sizes are in points (pt) exactly as stored in the PSD — these are true typographic points, independent of the 300 DPI raster resolution, and can be used directly as a PDF fontSize value.

## Zone 1 — Page, Border & Logo

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Canvas / Background | 0.0 | 0.0 | 297.0 | 210.0 | — | — | #FFFFFF | STATIC |
| Outer border rule (Rectangle 1) | 8.0 | 6.5 | 281.8 | 196.4 | — | stroke 0.17mm | #1669B2 / fill #34C5CA (inactive) | STATIC |
| Primary logo (final-logo, Smart Object) | 43.6 | 12.8 | 84.2 | 16.3 | — | — | — | STATIC |
| Watermark logo (final small logo, 8% opacity) | 228.9 | 53.5 | 70.7 | 55.2 | — | — | — | STATIC (decorative) |

## Zone 2 — Top-Left Corner Ribbon (group: TOP LEFT)

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rectangle 3 (pixel fill block) | -17.3 | 2.5 | 41.8 | 38.3 | — | — | — | STATIC (bleeds off-canvas) |
| Triangle 1 | -7.3 | -7.3 | 26.8 | 27.2 | — | — | fill #061A50 / stroke 0.10mm #166AB3 | STATIC |
| Rectangle 2 | -9.0 | -5.8 | 38.2 | 34.8 | — | — | fill #166AB3 | STATIC |
| Rectangle 4 (small accent bar) | 9.1 | 8.0 | 14.2 | 1.4 | — | — | fill #FFFFFF | STATIC |

## Zone 3 — Top-Right: Certificate Meta + QR (group: top right)

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| "Certificate No. \| / Issue Date \|" (labels) | 189.0 | 13.0 | 25.8 | 6.9 | Montserrat SemiBold | 37.5 | #060808 | STATIC label |
| "DT-CERT-2026-00125 / 2026-09-08" | 216.0 | 13.3 | 33.2 | 6.0 | Montserrat Medium | 37.5 | #060808 | DYNAMIC (cert no. + issue date) |
| Divider Line 1 | 250.4 | 11.1 | 0.4 | 15.3 | — | — | stroke 0.07mm #1669B2 | STATIC |
| QR code placeholder box (Rectangle 1, pixel) | 254.1 | 9.5 | 14.7 | 14.6 | — | — | — | DYNAMIC (QR image) |
| "DIGITAL VERIFICATION" | 254.2 | 25.8 | 33.4 | 1.9 | Montserrat Bold | 33.3 | #060808 | STATIC |
| "Scan QR code to verify authenticity / darbartech.com/verify" | 254.1 | 29.7 | 27.7 | 8.3 | Montserrat Regular | 29.2 | #060808 | STATIC (verify URL) |

## Zone 4 — Hero Title & Salutation

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| "Certificate of" run | 57.3 | 39.4 | 181.5 | 8.1 | Montserrat ExtraBold | 133.3 | #061A50 | STATIC (tracking 3.0, all-caps) |
| "completion" run | (same layer, follows above) | — | — | — | Montserrat ExtraBold | 133.3 | #1669B2 | STATIC (accent color) |
| Divider Line 2 (left) | 85.9 | 55.1 | 23.0 | 0.5 | — | — | stroke 0.17mm #34C5CA | STATIC |
| Divider Line 2 copy (right) | 191.9 | 55.1 | 23.0 | 0.5 | — | — | stroke 0.17mm #34C5CA | STATIC |
| "This is to certify that" | 109.3 | 53.9 | 77.6 | 2.7 | Montserrat SemiBold | 45.8 | #060808 | STATIC (tracking 170, all-caps) |

## Zone 5 — Recipient Name & Program

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Recipient name ("MOHAN SHAHI") | 87.5 | 64.0 | 121.0 | 10.8 | Cormorant Garamond Bold | 191.7 | #061A50 | DYNAMIC — recipient full name (tracking 25, all-caps) |
| Divider Line 3 (left) | 75.7 | 77.9 | 71.6 | 0.6 | — | — | stroke 0.34mm #34C5CA | STATIC |
| Diamond bullet (Rectangle 6, 45°) | 149.8 | 76.5 | 3.4 | 3.4 | — | — | fill #34C5CA | STATIC |
| Divider Line 3 copy (right) | 155.8 | 77.9 | 62.5 | 0.6 | — | — | stroke 0.34mm #34C5CA | STATIC |
| "has successfully completed the" | 114.6 | 81.5 | 66.9 | 4.1 | Montserrat Regular | 50.0 | #060808 | STATIC (tracking 10) |
| Program title ("PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM") | 69.8 | 92.0 | 180.2 | 4.3 | Montserrat SemiBold | 70.8 | #061A50 | DYNAMIC — program / course name (tracking 18) |
| Duration / provider sentence (multi-run) | 26.9 | 101.3 | 252.1 | 3.8 | Montserrat SemiBold | 45.8 | mixed (see below) | DYNAMIC — duration + provider name (see run breakdown) |

## Zone 6 — Course Modules Grid (group: course modules, 4 fixed columns)

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| "COURSE MODULES" heading | 127.8 | 112.8 | 47.5 | 2.7 | Montserrat SemiBold | 45.8 | #061A50 | STATIC (tracking 180, extreme spacing) |
| Heading rule left (Line 4) | 88.2 | 114.0 | 36.6 | 0.4 | — | — | stroke 0.17mm #34C5CA/#1669B2 | STATIC |
| Heading rule right (Line 4 copy) | 179.0 | 114.0 | 36.6 | 0.4 | — | — | stroke 0.17mm #34C5CA/#1669B2 | STATIC |
| Column 1 numeral "01" | 50.6 | 121.4 | 6.3 | 4.6 | Montserrat ExtraBold | 75.0 | #166AB4 | DYNAMIC — module index |
| Column 2 numeral "02" | 114.4 | 121.7 | 8.0 | 4.6 | Montserrat ExtraBold | 75.0 | #166AB4 | DYNAMIC — module index |
| Column 3 numeral "03" | 178.2 | 121.7 | 7.8 | 4.6 | Montserrat ExtraBold | 75.0 | #166AB4 | DYNAMIC — module index |
| Column 4 numeral "04" | 245.6 | 121.4 | 8.6 | 4.6 | Montserrat ExtraBold | 75.0 | #166AB4 | DYNAMIC — module index |
| Column 1 title "COMPUTER FUNDAMENTALS" | 26.9 | 128.9 | 53.7 | 2.5 | Montserrat SemiBold | 41.7 | #061A52 | DYNAMIC — module title 1 (tracking 10, all-caps) |
| Column 2 title "OFFICE APPLICATIONS" | 97.2 | 129.0 | 42.2 | 2.5 | Montserrat SemiBold | 41.7 | #061A52 | DYNAMIC — module title 2 |
| Column 3 title "GRAPHIC DESIGN" | 166.0 | 129.2 | 32.3 | 2.5 | Montserrat SemiBold | 41.7 | #061A52 | DYNAMIC — module title 3 |
| Column 4 title "NEPALI TYPING" | 235.9 | 129.0 | 28.1 | 2.5 | Montserrat SemiBold | 41.7 | #061A52 | DYNAMIC — module title 4 |
| Column 1 subtitle "Basic Computer Operations" | 33.4 | 133.3 | 40.6 | 2.7 | Montserrat SemiBold | 33.3 | #1669B2 | DYNAMIC — module subtitle 1 |
| Column 2 subtitle "Microsoft Word \| Excel \| PowerPoint" | 92.0 | 133.4 | 52.6 | 2.7 | Montserrat SemiBold | 33.3 | #1669B2 | DYNAMIC — module subtitle 2 |
| Column 3 subtitle "Adobe Photoshop \| Illustrator \| Canva" | 154.6 | 133.7 | 55.1 | 2.6 | Montserrat SemiBold | 33.3 | #1669B2 | DYNAMIC — module subtitle 3 |
| Column 4 subtitle "Unicode · Traditional Nepali Typing" | 224.2 | 133.7 | 51.5 | 2.7 | Montserrat SemiBold | 33.3 | #1669B2 | DYNAMIC — module subtitle 4 |
| Vertical divider 1 (Line 6) | 86.9 | 127.8 | 0.5 | 6.2 | — | — | stroke 0.17mm #1669B2 (col 1\|2) | STATIC |
| Vertical divider 2 (Line 6 copy 3) | 149.9 | 127.8 | 0.5 | 6.2 | — | — | stroke 0.17mm #1669B2 (col 2\|3) | STATIC |
| Vertical divider 3 (Line 6 copy 4) | 216.5 | 127.8 | 0.5 | 6.2 | — | — | stroke 0.17mm #1669B2 (col 3\|4) | STATIC |

## Zone 7 — Completion Statement & Grade Badge

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Completion statement (2 lines, centered) | 64.3 | 142.3 | 168.1 | 8.2 | Montserrat Regular | 41.7 | #060808 | STATIC or DYNAMIC template sentence (tracking 10) |
| Grade badge shape (Rectangle 7, rounded) | 122.9 | 155.3 | 50.4 | 8.6 | — | — | fill #34C5CA / stroke 0.02mm #1669B2 | STATIC container |
| "Final Grade \| " label run | 127.4 | 157.1 | 41.4 | 5.1 | Montserrat SemiBold | 41.7 | #FFFFFF | STATIC label (all-caps) |
| Grade value "a+" run | (same layer) | — | — | — | Montserrat ExtraBold | 75.0–100.0 | #FFFFFF | DYNAMIC — final grade (all-caps, 2 size runs) |

## Zone 8 — Signature / Footer Block (group: bottom-authorized)

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| "Date of issue" label | 44.5 | 177.9 | 25.1 | 2.2 | Montserrat SemiBold | 37.5 | #060808 | STATIC label (all-caps, tracking 10) |
| Issue date value "08 September 2026" | 42.0 | 182.5 | 29.5 | 2.0 | Montserrat Regular | 33.3 | #060808 | DYNAMIC — issue date (all-caps) |
| Signature line 1 (Line 5) | 43.3 | 176.0 | 26.4 | 0.4 | — | — | stroke 0.10mm #1669B2 | STATIC |
| "AUTHORIZED SIGNATORY" label | 131.4 | 177.9 | 43.0 | 2.2 | Montserrat SemiBold | 37.5 | #060808 | STATIC label (all-caps) |
| Signatory 1 name "Mohan Shahi" | 142.8 | 183.4 | 18.2 | 2.1 | Montserrat Regular | 33.3 | #060808 | DYNAMIC — signatory 1 name |
| Signature line 2 (Line 5 copy) | 139.4 | 176.0 | 28.1 | 0.4 | — | — | stroke 0.10mm #1669B2 | STATIC |
| "Managing director" label | 216.6 | 178.6 | 37.1 | 2.2 | Montserrat SemiBold | 37.5 | #060808 | DYNAMIC — signatory 2 title (all-caps) |
| Signatory 2 name "Nirmala Shrestha" | 221.5 | 183.6 | 24.0 | 2.1 | Montserrat Regular | 33.3 | #060808 | DYNAMIC — signatory 2 name |
| Signature line 3 (Line 5 copy 2) | 216.0 | 176.2 | 38.2 | 0.4 | — | — | stroke 0.10mm #1669B2 | STATIC |

## Zone 9 — Bottom Navy Bar (group: RIGHT BOTTOM + footer contact)

| Element | x (mm) | y (mm) | w (mm) | h (mm) | Font | Size (pt) | Color / Fill-Stroke | Static/Dynamic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Footer bar fill (Rectangle 5) | 7.6 | 191.5 | 230.8 | 12.3 | — | — | fill #1669B2 | STATIC |
| "Verified & Authentic" | 37.2 | 198.3 | 33.8 | 1.5 | Montserrat SemiBold | 32.8 | #FFFFFF | STATIC (all-caps) |
| Divider Line 7 | 35.6 | 196.8 | 0.4 | 4.1 | — | — | stroke 0.03mm #FFFFFF (fill #34C5CA inactive) | STATIC |
| "CERTIFICATE NO. DT-CERT-2026-00125" | 75.5 | 198.0 | 53.5 | 1.4 | Montserrat Regular | 32.8 | #FFFFFF | DYNAMIC — certificate number (all-caps) |
| Contact line "www.darbartech.com \| info@ \| +977-..." | 136.1 | 197.6 | 83.1 | 2.4 | Montserrat Medium | 29.2 | #FFFFFF | STATIC — org contact details |
| Divider Line 7 copy | 73.6 | 196.8 | 0.4 | 4.1 | — | — | stroke 0.03mm #FFFFFF | STATIC |
| Corner accent Shape 1 (bottom-right ribbon) | 212.9 | 177.0 | 89.3 | 28.5 | — | — | fill #061A52 / stroke 2.0mm #FFFFFF | STATIC |
| Corner accent Shape 2 | 270.7 | 175.7 | 18.8 | 14.1 | — | — | fill #1669B2 | STATIC |

## Duration sentence — run-by-run color breakdown

The single layer "3-month practical training program conducted by DarbarTech Group of Technology, covering the following course modules:" (x=26.9mm, y=101.3mm, w=252.1mm, Montserrat SemiBold 45.8pt) is built from 4 colour runs:

| Run | Colour | Classification |
| --- | --- | --- |
| "3-month" | #1669B2 (Corporate Blue) | DYNAMIC — programme duration |
| "practical training program conducted by" | #060808 (body ink) | STATIC connective text |
| "DarbarTech Group of Technology" | #1669B2 (Corporate Blue) | DYNAMIC — training-provider name |
| ", covering the following course modules:" | #060808 (body ink) | STATIC connective text |
