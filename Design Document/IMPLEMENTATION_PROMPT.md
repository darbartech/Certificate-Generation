# Prompt — paste this into your coding assistant (e.g. Claude Code) inside the project repo

Place the 12 spec files (00_EXECUTIVE_SUMMARY_AND_GAP_ANALYSIS.md ... APPENDIX_FULL_LAYOUT_GRID.md)
somewhere in the repo, e.g. `docs/certificate-spec/`, then use the prompt below.

---

I've added a design specification set at `docs/certificate-spec/` (12 files, starting with
`00_EXECUTIVE_SUMMARY_AND_GAP_ANALYSIS.md`). It's a full teardown of our master certificate
design (`CERTIFICATE_psd.psd`) mapped to exact coordinates, fonts, colors and shapes, plus a
gap analysis against our current code.

Read all 12 files in `docs/certificate-spec/` in order before doing anything else, then read
the current implementation:
- `src/lib/templates/darbartech-certificate-v1.ts`
- `src/lib/renderer/certificateRenderer.ts`
- `src/lib/renderer/textFitting.ts`
- `src/lib/types.ts`

Then implement the following, in this order, committing after each step:

1. **Font pipeline.** Add `@pdf-lib/fontkit`, register it with `PDFDocument.registerFontkit()`,
   and embed Montserrat (Regular, Medium, SemiBold, Bold, ExtraBold) and Cormorant Garamond
   (Bold) as TTF assets. Source them from Google Fonts (OFL-licensed, per
   `07_FONT_LICENSING_AND_ASSETS.md`) and store them under an appropriate `assets/fonts/`
   directory. Update `getFontForTemplate()` so template font names resolve to these embedded
   fonts instead of falling back to Helvetica.

2. **Type system changes** in `src/lib/types.ts`:
   - Add an optional `runs?: { text: string; font: string; fontSize: number; color: string }[]`
     property to `TemplateField`, for fields that need multiple colors/sizes/fonts within one
     text box (see `04_ZONE_BY_ZONE_ELEMENT_MAP.md` — the hero headline, the duration sentence,
     and the grade badge all need this).
   - Add a `ShapeConfig` type (`kind: "rect" | "triangle" | "line"`, `x, y, width, height` in mm,
     `fill?: string`, `stroke?: string`, `strokeWidthMm?: number`, `rotationDeg?: number`) and a
     `shapes: ShapeConfig[]` array on `TemplateConfig`.

3. **Renderer changes** in `certificateRenderer.ts`:
   - Add a `drawShapes()` step that renders the new `shapes` array (rectangles, triangles,
     lines) before/behind the text layer, matching `05_SHAPES_AND_GRAPHICS.md`.
   - Update `renderTextInField()` to render per-run styling when `field.runs` is present,
     instead of always using a single font/size/color for the whole field.
   - Replace `drawPageBorder()`'s flat rectangle with the exact outer-frame rule plus the
     top-left and bottom-right corner-ribbon shapes (including their negative/off-canvas
     coordinates — that's intentional bleed, not a bug).

4. **New template version.** Create `src/lib/templates/darbartech-certificate-v2.ts` — do not
   edit v1 in place, since issued certificates must keep referencing their original template
   version. Populate every field with the exact values from
   `04_ZONE_BY_ZONE_ELEMENT_MAP.md` (position/font/size/color/tracking/alignment) and every
   shape from `05_SHAPES_AND_GRAPHICS.md`. Use the color palette from `02_COLOR_PALETTE.md`
   exactly (`#061A50`, `#1669B2`, `#34C5CA`, `#060808`, `#FFFFFF` — no gold, it isn't in the
   design). Register it in `getTemplateById()`.

5. **Course-modules grid.** Implement the fixed 4-column layout (numeral + title + subtitle per
   column, 3 vertical divider lines) from Zone 6 as its own layout function — don't reuse the
   generic variable-count stacked-list logic from v1's `moduleConstraints`.

6. **Grade badge.** Render the teal rounded-rectangle badge shape behind the two-run
   "Final Grade | " + grade-value text (Zone 7), matching both font-size runs.

7. **Assets.** Wire in the existing logo files (`public/logo.png`, `public/logo-small.png`) at
   the Zone 1 coordinates, and reproduce the watermark logo at 8% opacity behind the body copy.

8. **Verify against the sample data already baked into the spec** (recipient "Mohan Shahi",
   certificate number "DT-CERT-2026-00125", issue date "2026-09-08" / "08 September 2026",
   program "PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM", grade "A+", signatories
   "Mohan Shahi / Authorized Signatory" and "Nirmala Shrestha / Managing director"). Generate a
   preview PDF and compare it against `CERTIFICATE_psd.psd` (or its flattened export) at 100%
   and 200% zoom.

9. **Run through `10_QA_CHECKLIST.md`** item by item before calling this done, and fix anything
   that doesn't match.

Constraints:
- Don't touch `darbartech-certificate-v1.ts` or any already-issued certificate records.
- Don't invent values that aren't in the spec — if something is genuinely ambiguous, flag it
  instead of guessing (see the "REQUIRED CONFIRMATION" style callouts in the docs).
- Keep the CMYK values in `02_COLOR_PALETTE.md` as the noted print source-of-truth even though
  the renderer itself works in RGB/hex.

When you're done, summarize: which files you changed/added, which parts of the QA checklist
pass, and anything from the gap analysis you couldn't fully resolve (e.g. font-embedding
issues, ambiguous shape rotation, etc.) so I can review before merging.
