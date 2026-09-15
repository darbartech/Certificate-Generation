# 10. Recommended Implementation Plan

| Step | Detail |
| --- | --- |
| 1. Font pipeline | Register `@pdf-lib/fontkit`; embed Montserrat (5 weights) and Cormorant Garamond Bold as TTF assets bundled with the app; extend `getFontForTemplate()` to resolve these families instead of falling back to Helvetica. |
| 2. Type system | Extend `TemplateField` to support an optional `runs` array (per-segment font/size/color) for multi-colour lines; add a `ShapeConfig` type and a `shapes: ShapeConfig[]` array on `TemplateConfig` for lines/rectangles/triangles/diamonds. |
| 3. Renderer | Add `drawShapes()` (handles rect/triangle/line primitives with fill+stroke) and update `renderTextInField()` to iterate `runs` when present; keep the existing shrink/overflow logic for dynamic text. |
| 4. New template version | Create `darbartech-certificate-v2.ts` populated with every value from Section 5 (zones), Section 6 (shapes) and Section 3 (colours) — do not edit v1 in place; issued certificates must keep referencing their original template version per the existing template-versioning rule in the architecture doc. |
| 5. Module grid | Implement the fixed 4-column layout from Zone 6 (numeral + title + subtitle stacks with 3 vertical dividers) as its own layout function rather than the generic stacked-list logic. |
| 6. Assets | Wire in the existing logo PNGs (`public/logo.png`, `public/logo-small.png`) at the exact Zone 1 coordinates; confirm the watermark logo's 8% opacity is reproduced behind the body copy, not on top of it. |
| 7. Visual regression | Render a test certificate with the sample data already present in the PSD (Mohan Shahi / DT-CERT-2026-00125) and compare side-by-side against the PSD export at 100% and 200% zoom — see Section 11 checklist. |
| 8. Sign-off | Once matched, update `DEFAULT_PUBLIC_FIELDS` / verification pages if any newly-added dynamic fields (e.g. duration, trainingProvider) need to be exposed on the public verify page. |
