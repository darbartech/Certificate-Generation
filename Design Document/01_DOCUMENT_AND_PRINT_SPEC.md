# 2. Document & Print Specification

| Property | Value |
| --- | --- |
| Pixel dimensions | 3508 × 2480 px |
| Color mode | CMYK, 8-bit per channel (4 channels) |
| Resolution | 300 DPI |
| Physical size @ 300 DPI | 297.05 × 210.03 mm ≈ A4 landscape (297×210mm) |
| Physical size (inches) | 11.69 in × 8.27 in |
| ICC profile | Adobe CMYK profile embedded (U.S. Web Coated–style) |
| Background | Solid white (#FFFFFF), full-bleed, no transparency |
| Total PSD layers | 68 (34 text, ~24 shape/line, 2 Smart Object logos, 2 pixel layers, 6 groups) |

## Print readiness & bleed

- Built natively in CMYK at 300 DPI — production-ready for offset/digital print at A4, no colour-mode conversion needed.
- All type layers store fill colour as CMYK directly (not converted from RGB after the fact) — for print output, use the CMYK values in `02_COLOR_PALETTE.md`, not the hex approximations.
- The corner decoration groups (TOP LEFT, RIGHT BOTTOM) already extend to negative / beyond-canvas coordinates (e.g. Triangle 1 at x:-7.3mm, y:-7.3mm) — this is intentional bleed so the corner ribbons reach the trim edge after cutting.
- If re-exporting a flattened master for a print vendor, add a standard 3mm bleed beyond the 297×210mm trim (~303×216mm working canvas).
- Keep the recipient name, certificate number, and QR code at least 5–8mm inside the trim edge; never let them touch the trim line.
- The two logo elements are Smart Objects in the PSD (final-logo, final small logo) — swap/scale them non-destructively rather than flattening them into the background.
