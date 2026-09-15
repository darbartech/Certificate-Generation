/**
 * shapes-v3.patch.ts
 *
 * Copy-paste replacements for the two files that need changing.
 * See CERTIFICATE_DESIGN_PARITY_SPEC.md for the measurements behind every value.
 *
 * PART 1 — src/lib/renderer/certificateRenderer.ts  (drawShapes)
 * PART 2 — src/lib/templates/darbartech-certificate-v2.ts  (shapes array)
 * PART 3 — field-level deltas
 */

/* ────────────────────────────────────────────────────────────────────────────
 * PART 1 — drawShapes(), replaces lines ~537-617 of certificateRenderer.ts
 * Fixes BUG-01 (polygon y-flip), BUG-02 (triangle half), BUG-05 (line slant).
 * ──────────────────────────────────────────────────────────────────────────── */

const drawShapes = (page: any, shapes: any[] | undefined): void => {
  if (!shapes || shapes.length === 0) return;
  const pageHeight = page.getHeight();

  for (const shape of shapes) {
    const strokeColor = shape.stroke ? hexToRgb(shape.stroke) : undefined;
    const fillColor = shape.fill ? hexToRgb(shape.fill) : undefined;
    const borderWidth = shape.strokeWidthMm ? mmToPt(shape.strokeWidthMm) : 0;
    const hasRotation = typeof shape.rotationDeg === "number" && shape.rotationDeg !== 0;

    // ── polygon ───────────────────────────────────────────────────────────
    // FIX BUG-01: pdf-lib emits `1 0 0 -1 0 0 cm` for drawSvgPath, so the path
    // is drawn y-DOWN from the anchor. Anchor at the page TOP-LEFT and feed
    // mm-from-top straight through. The old code anchored at {x:0,y:0} and
    // pre-flipped the Y itself, which double-flipped every polygon off-page.
    if (shape.kind === "polygon") {
      const rawPoints: Array<{ x: number; y: number }> = shape.points || [];
      if (rawPoints.length < 3) continue;

      const parts = rawPoints.map(
        (pt, idx) => `${idx === 0 ? "M" : "L"} ${mmToPt(pt.x)} ${mmToPt(pt.y)}`
      );
      parts.push("Z");

      const svgOpts: any = { x: 0, y: pageHeight };
      if (fillColor) svgOpts.color = fillColor;
      if (strokeColor) {
        svgOpts.borderColor = strokeColor;
        svgOpts.borderWidth = Math.max(borderWidth, 0.5);
      }
      if (hasRotation) svgOpts.rotate = degrees(shape.rotationDeg);
      page.drawSvgPath(parts.join(" "), svgOpts);
      continue;
    }

    const xPt = mmToPt(shape.x);
    const yPtBottom = pageHeight - mmToPt(shape.y) - mmToPt(shape.height);
    const wPt = mmToPt(shape.width);
    const hPt = mmToPt(shape.height);

    // ── rect ──────────────────────────────────────────────────────────────
    if (shape.kind === "rect") {
      const opts: any = { x: xPt, y: yPtBottom, width: wPt, height: hPt, borderWidth };
      if (hasRotation) opts.rotate = degrees(shape.rotationDeg);
      if (strokeColor) opts.borderColor = strokeColor;
      if (fillColor) opts.color = fillColor;
      if (shape.cornerRadiusMm && shape.cornerRadiusMm > 0) {
        const rPt = mmToPt(shape.cornerRadiusMm);
        opts.borderTopLeftRadius = rPt;
        opts.borderTopRightRadius = rPt;
        opts.borderBottomLeftRadius = rPt;
        opts.borderBottomRightRadius = rPt;
      }
      page.drawRectangle(opts);

    // ── triangle ──────────────────────────────────────────────────────────
    // FIX BUG-02: was `M 0 0 L w h L 0 h Z` (hypotenuse top-left → bottom-right).
    // The reference runs top-right → bottom-left. Kept only for back-compat;
    // prefer expressing corner art as explicit polygons.
    } else if (shape.kind === "triangle") {
      const svgPath = `M 0 0 L ${wPt} 0 L 0 ${hPt} Z`;
      const svgOpts: any = { x: xPt, y: pageHeight - mmToPt(shape.y) };
      if (strokeColor) {
        svgOpts.borderColor = strokeColor;
        svgOpts.borderWidth = Math.max(borderWidth, 0.5);
      }
      if (fillColor) svgOpts.color = fillColor;
      if (hasRotation) svgOpts.rotate = degrees(shape.rotationDeg);
      page.drawSvgPath(svgPath, svgOpts);

    // ── line ──────────────────────────────────────────────────────────────
    // FIX BUG-05: the old code consumed BOTH width and height, so every
    // "vertical" divider (w 0.5 / h 6.2) leaned 4.6°. Orientation is now
    // explicit, with a size-based fallback for untagged legacy shapes.
    } else if (shape.kind === "line") {
      const horizontal = shape.orientation
        ? shape.orientation === "horizontal"
        : shape.width >= shape.height;

      const start = { x: xPt, y: pageHeight - mmToPt(shape.y) };
      const end = horizontal
        ? { x: xPt + wPt, y: start.y }
        : { x: xPt, y: pageHeight - mmToPt(shape.y + shape.height) };

      const lineOpts: any = {
        start,
        end,
        thickness: borderWidth > 0 ? borderWidth : 0.5,
      };
      if (strokeColor) lineOpts.color = strokeColor;
      page.drawLine(lineOpts);
    }
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * PART 2 — replaces the `shapes` array in darbartech-certificate-v2.ts
 * ──────────────────────────────────────────────────────────────────────────── */

const shapes: ShapeConfig[] = [
  // ── Layer 1 · outer frame ────────────────────────────────────────────────
  { kind: "rect", x: 8.0, y: 6.5, width: 281.8, height: 196.4,
    stroke: "#1669B2", strokeWidthMm: 0.17, layer: 1 },

  // ── Layer 2 · top-left corner group (§6.1) ───────────────────────────────
  // Navy wedge. Hypotenuse x = 17.9 − 1.10·y. Bleeds off top + left trim.
  { kind: "polygon", layer: 2, fill: "#061A50", points: [
      { x: -5.0, y: -5.0 },
      { x: 23.4, y: -5.0 },
      { x: -5.0, y: 20.8 },
  ]},
  // Blue parallel band, 2.0 mm clear of the wedge, 6.94 mm horizontal width.
  { kind: "polygon", layer: 2, fill: "#1669B2", points: [
      { x: 25.1, y: -5.0 },
      { x: 32.1, y: -5.0 },
      { x: -5.0, y: 28.8 },
      { x: -5.0, y: 22.5 },
  ]},
  // White accent bar — cuts a horizontal slit through the blue band.
  // Unchanged from v2; it only READS once the band above exists.
  { kind: "rect", layer: 2, x: 9.1, y: 8.0, width: 14.2, height: 1.4, fill: "#FFFFFF" },

  // ── Layer 3 · rules, dividers, diamond ───────────────────────────────────
  { kind: "line", orientation: "horizontal", x: 85.9, y: 55.1, width: 23.0, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.17, layer: 3 },
  { kind: "line", orientation: "horizontal", x: 191.9, y: 55.1, width: 23.0, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.17, layer: 3 },

  // Name flanks. See §11 — compute these dynamically from the name ink width.
  { kind: "line", orientation: "horizontal", x: 75.7, y: 78.2, width: 71.6, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.34, layer: 3 },
  { kind: "line", orientation: "horizontal", x: 155.8, y: 78.2, width: 62.5, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.34, layer: 3 },

  // FIX BUG-06: diamond as an explicit polygon centred on (150.0, 78.2),
  // bbox 2.7 × 2.7 mm. The old rotated rect pivoted on its bottom-left corner,
  // which pushed it 1.7 mm up and inflated it to 4.57 mm — it collided with
  // the recipient name.
  { kind: "polygon", layer: 3, fill: "#34C5CA", points: [
      { x: 150.00, y: 76.85 },
      { x: 151.35, y: 78.20 },
      { x: 150.00, y: 79.55 },
      { x: 148.65, y: 78.20 },
  ]},

  { kind: "line", orientation: "horizontal", x: 88.2, y: 114.0, width: 36.6, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.17, layer: 3 },
  { kind: "line", orientation: "horizontal", x: 179.0, y: 114.0, width: 36.6, height: 0,
    stroke: "#34C5CA", strokeWidthMm: 0.17, layer: 3 },

  // Module column dividers — MUST be vertical (reference: constant x, y 128.1–133.9).
  { kind: "line", orientation: "vertical", x: 87.1, y: 128.1, width: 0, height: 5.8,
    stroke: "#1669B2", strokeWidthMm: 0.17, layer: 3 },
  { kind: "line", orientation: "vertical", x: 150.1, y: 128.1, width: 0, height: 5.8,
    stroke: "#1669B2", strokeWidthMm: 0.17, layer: 3 },
  { kind: "line", orientation: "vertical", x: 216.6, y: 128.1, width: 0, height: 5.8,
    stroke: "#1669B2", strokeWidthMm: 0.17, layer: 3 },

  // QR separator.
  { kind: "line", orientation: "vertical", x: 250.7, y: 12.0, width: 0, height: 13.8,
    stroke: "#1669B2", strokeWidthMm: 0.30, layer: 3 },

  // Signature underlines.
  { kind: "line", orientation: "horizontal", x: 43.3, y: 176.0, width: 26.4, height: 0,
    stroke: "#1669B2", strokeWidthMm: 0.10, layer: 3 },
  { kind: "line", orientation: "horizontal", x: 139.4, y: 176.0, width: 28.1, height: 0,
    stroke: "#1669B2", strokeWidthMm: 0.10, layer: 3 },
  { kind: "line", orientation: "horizontal", x: 216.0, y: 176.2, width: 38.2, height: 0,
    stroke: "#1669B2", strokeWidthMm: 0.10, layer: 3 },

  // ── Layer 4 · footer bar (§6.2) ──────────────────────────────────────────
  // Right edge is a DIAGONAL: x = 231.5 − 1.40·(y − 192).
  // Reverts the v2 widening to 281.8, which flattened the corner composition.
  { kind: "polygon", layer: 4, fill: "#1669B2", points: [
      { x: 7.6, y: 191.68 },
      { x: 231.9, y: 191.68 },
      { x: 214.9, y: 203.87 },
      { x: 7.6, y: 203.87 },
  ]},
  // Footer ticks — these ARE slanted in the reference. Left as legacy diagonals.
  { kind: "line", x: 35.6, y: 196.8, width: 0.4, height: 4.1,
    stroke: "#FFFFFF", strokeWidthMm: 0.03, layer: 4 },
  { kind: "line", x: 73.6, y: 196.8, width: 0.4, height: 4.1,
    stroke: "#FFFFFF", strokeWidthMm: 0.03, layer: 4 },

  // ── Layer 5 · bottom-right corner group (§6.2) ───────────────────────────
  // Free-floating blue accent band above the footer.
  { kind: "polygon", layer: 5, fill: "#1669B2", points: [
      { x: 286.3, y: 177.0 },
      { x: 290.8, y: 177.0 },
      { x: 273.4, y: 189.5 },
      { x: 268.9, y: 189.5 },
  ]},
  // Navy corner block. Bleeds off the RIGHT trim only; bottom is a hard edge.
  // The ~3.8 mm white sliver between this and the footer-blue is intentional.
  { kind: "polygon", layer: 5, fill: "#061A50", points: [
      { x: 302.0, y: 180.9 },
      { x: 280.0, y: 193.1 },
      { x: 233.7, y: 193.1 },
      { x: 218.4, y: 203.87 },
      { x: 302.0, y: 203.87 },
  ]},

  // ── Layer 6 · grade badge ────────────────────────────────────────────────
  // FIX §8: full pill, r = height / 2. Was 1.5 mm, which rendered as a
  // near-square box against the reference's semicircular caps.
  { kind: "rect", layer: 6, x: 122.9, y: 155.3, width: 50.4, height: 8.6,
    fill: "#34C5CA", stroke: "#1669B2", strokeWidthMm: 0.02, cornerRadiusMm: 4.3 },
];

/* ────────────────────────────────────────────────────────────────────────────
 * PART 3 — field-level deltas in darbartech-certificate-v2.ts
 * ────────────────────────────────────────────────────────────────────────────
 *
 * completionStatement   add  capHeightMm: 2.6          // FIX BUG-04
 * issueDateMetaLabel    y:   16.3  ->  17.1            // §10 row pitch 3.89mm
 * issueDateMetaValue    y:   16.3  ->  17.1
 * qrCaption2b           y:   32.0  ->  32.6            // §10 leading 2.9mm
 * qrCaption2c           y:   34.3  ->  35.5
 * qrCaption2c           font: Montserrat-SemiBold -> Montserrat-Regular
 * qrCaption2c           transformUppercase: true -> false
 *
 * qrConfig              y:   9.5   ->  12.0            // §10 QR top edge
 * qrConfig              margin: 1  ->  2
 * qrConfig              + borderMm: 0.3, borderColor: "#1669B2"
 *
 * certNumberLabel       content "Certificate No." -> "Certificate No.  |"
 * issueDateMetaLabel    content "Issue Date"      -> "Issue Date  |"
 *
 * colors                + hexSrgb per §9 Option A, or migrate to cmyk() per Option B
 *
 * letterSpacing         recalibrate AFTER BUG-03 is fixed, to these ink widths:
 *                         salutation            -> 77.0 mm
 *                         courseModulesHeading  -> 47.0 mm
 *                         programTitle (46ch)   -> 179.8 mm
 */
