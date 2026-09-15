# DarbarTech Certificate — PSD-to-Template Reproduction Specification

## 1. Executive Summary

This specification consolidates a complete technical teardown of the master design file, `CERTIFICATE_psd.psd` (3508×2480px, CMYK, 300 DPI, A4 landscape), and maps every one of its 68 layers — 34 text layers, ~24 decorative shape layers, 2 logo Smart Objects — to exact coordinates, fonts, sizes, colors and dynamic/static classification. It is written so a designer or developer can reproduce the certificate pixel/millimetre-accurate without reopening Photoshop.

> **Key finding — the current code does not yet match the PSD.**
> The repository already contains a working certificate-generation pipeline (Next.js + pdf-lib), but its active template — `src/lib/templates/darbartech-certificate-v1.ts` — is a generic placeholder built without reference to the actual PSD data. Its coordinates, fonts (Helvetica/Times/Courier only), and colors (e.g. navy `#0a2463`, gold `#c9a227`) do not correspond to any element in `CERTIFICATE_psd.psd`. The renderer (`certificateRenderer.ts`) can currently only embed pdf-lib's 14 Standard PDF fonts and draws a single rectangular border — it has no support for the corner ribbons, module-grid dividers, or grade badge shape that define this certificate's look. See `08_ENGINEERING_GAP_ANALYSIS.md` for exactly what must change.

The rest of this document set is the corrected, PSD-accurate specification: use it to replace the placeholder values in the template/renderer so generated certificates match the master artwork.

## What this document set contains

1. `00_EXECUTIVE_SUMMARY_AND_GAP_ANALYSIS.md` — this file
2. `01_DOCUMENT_AND_PRINT_SPEC.md` — canvas, DPI, bleed, safe area
3. `02_COLOR_PALETTE.md` — full CMYK source-of-truth + hex palette
4. `03_TYPOGRAPHY_SPEC.md` — fonts, weights, type scale, styling rules
5. `04_ZONE_BY_ZONE_ELEMENT_MAP.md` — exact x/y/w/h (mm) + font/size/color for every text element, by visual zone
6. `05_SHAPES_AND_GRAPHICS.md` — every decorative shape/line/divider with fill, stroke and role
7. `06_DYNAMIC_STATIC_FIELDS.md` — per-recipient vs. static field classification
8. `07_FONT_LICENSING_AND_ASSETS.md` — font licensing & asset requirements
9. `08_ENGINEERING_GAP_ANALYSIS.md` — current code vs. required, area by area
10. `09_IMPLEMENTATION_PLAN.md` — recommended step-by-step implementation plan
11. `10_QA_CHECKLIST.md` — visual regression / QA checklist
12. `APPENDIX_FULL_LAYOUT_GRID.md` — full flat layout grid (all elements, mm) for quick reference
