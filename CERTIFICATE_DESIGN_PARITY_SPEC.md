# Certificate Design Parity Spec — v2 → Aayara Reference

**Reference:** `Certificate_of_Aayara_final.pdf` (Photoshop export, DeviceCMYK, flattened raster)
**Current output:** `testing_final.pdf` (pdf-lib, DeviceRGB, vector)
**Date:** 2026-09-15

**Verdict:** the template coordinates are ~90% correct. The visual gap comes from
**six bugs in `src/lib/renderer/certificateRenderer.ts`** plus a colour-space
mismatch. Fix the renderer first — most of what looks like "design drift"
disappears on its own.

---

## Table of contents

- [0. What already matches](#0-what-already-matches-do-not-touch)
- [1. BUG-01 — polygon renders mirrored off the page](#1-bug-01--polygon-renders-mirrored-off-the-page-)
- [2. BUG-02 — triangle fills the wrong half](#2-bug-02--triangle-fills-the-wrong-half)
- [3. BUG-03 — letter-spacing is silently dropped](#3-bug-03--letter-spacing-is-silently-dropped)
- [4. BUG-04 — multi-line first baseline too low](#4-bug-04--multi-line-first-baseline-is-55-mm-too-low)
- [5. BUG-05 — line primitive draws diagonals](#5-bug-05--line-primitive-draws-diagonals)
- [6. Corner groups — exact geometry](#6-corner-groups--exact-geometry)
- [7. BUG-06 — diamond rotates about the wrong pivot](#7-bug-06--diamond-bullet-rotates-about-the-wrong-pivot)
- [8. Grade badge must be a pill](#8-grade-badge-must-be-a-pill-not-a-rounded-rect)
- [9. Colour — CMYK vs sRGB](#9-colour--cmyk-vs-srgb-your-palette-is-not-wrong-the-conversion-is)
- [10. Top-right metadata + QR block](#10-top-right-metadata--qr-block)
- [11. Name underline rules](#11-name-underline-rules--make-them-dynamic)
- [12. Cosmetic — font name tables](#12-cosmetic-font-name-tables)
- [13. Implementation order](#13-implementation-order)
- [14. Acceptance tests](#14-acceptance-tests)
- [Appendix — measurement method](#appendix--measurement-method)

---

## 0. What already matches (do not touch)

Verified identical between the two files at 150 dpi:

| Element | Reference | Generated |
|---|---|---|
| Page size | 297 × 210 mm | 297 × 210 mm |
| Outer frame | x 8.13 → 289.72 mm | x 7.90 → 289.72 mm |
| Module column centres | 53.7 / 118.3 / 182.1 / 249.8 | 53.5 / 118.3 / 181.9 / 249.8 |
| Module divider x | 87.1 / 150.1 / 216.6 | 87.1 / 150.1 / 216.6 |
| Grade badge box | 123.1–172.9 × 155.8–163.7 | 122.9–173.1 × 155.6–163.9 |
| Headline / name / program title / duration — Y | identical | identical |
| Footer bar top & bottom | y 191.68 → 203.87 | y 191.68 → 204.04 |
| Watermark bounding box | same | same |
| Font weights (OS/2 `usWeightClass`) | — | 400 / 500 / 600 / 700 / 800 ✔ |

**So: do not re-tune the field grid. The grid is fine.**

---

## 1. BUG-01 — polygon renders mirrored off the page ⚠️

This is why the entire bottom-right corner group is missing from your output.

### Evidence

Raw content stream of `testing_final.pdf`:

```
q
1 0 0 1 0 0 cm
1 0 0 1 0 0 cm
1 0 0 -1 0 0 cm        <-- pdf-lib's y-flip, applied about y = 0
0.023 0.101 0.313 rg
739.84 99.21 m
873.07 99.21 l
873.07 -5.67 l
691.65 -5.67 l
h f
Q
```

Calling `page.drawSvgPath(path, { x: 0, y: 0 })` makes pdf-lib emit
`1 0 0 -1 0 0 cm`. Every path Y is therefore **negated**.

Your polygon was computed for y = 175 → 212 mm from the top
(PDF y = +99.2 → −5.67 pt). After the flip it lands at PDF y = −99.2 → +5.67 pt —
**entirely below the page**, except a 2 mm sliver.

That sliver is exactly the thin navy wedge visible at the very bottom edge of
`testing_final.pdf`. Both bottom-right polygons are affected.

### Fix — `drawShapes()`, polygon branch

```ts
if (shape.kind === "polygon") {
  const rawPoints: Array<{ x: number; y: number }> = shape.points || [];
  if (rawPoints.length < 3) continue;

  const parts = rawPoints.map((pt, idx) =>
    // path space is y-DOWN from the anchor, so feed mm-from-top directly
    `${idx === 0 ? "M" : "L"} ${mmToPt(pt.x)} ${mmToPt(pt.y)}`
  );
  parts.push("Z");

  const svgOpts: any = { x: 0, y: pageHeight };   // <-- anchor at the TOP-LEFT
  if (fillColor) svgOpts.color = fillColor;
  if (strokeColor) {
    svgOpts.borderColor = strokeColor;
    svgOpts.borderWidth = Math.max(borderWidth, 0.5);
  }
  page.drawSvgPath(parts.join(" "), svgOpts);
  continue;
}
```

Add a regression assertion: render a polygon at `y: 10 mm` and confirm the ink
appears within 10 mm of the **top** edge.

---

## 2. BUG-02 — triangle fills the wrong half

**Current path:** `M 0 0 L ${w} ${h} L 0 ${h} Z` → vertical left edge, hypotenuse
running **top-left → bottom-right** (`\`).

**Reference:** hypotenuse runs **top-right → bottom-left** (`/`).

Measured navy wedge right edge, per row:

| y (mm) | 0 | 5 | 10 | 15 | 20 |
|---|---|---|---|---|---|
| **reference** | 17.44 | 12.02 | 6.43 | 1.02 | — |
| **generated** | — | 4.40 | 9.30 | 14.10 | 18.80 |

The slope is exactly inverted. The minimal fix is
`M 0 0 L ${w} 0 L 0 ${h} Z` plus the anchor fix from BUG-01.

**Recommendation:** delete `kind: "triangle"` entirely and express both corner
groups as explicit `polygon`s (see §6). Triangles cannot express the
parallel-band motif the reference actually uses, and one fewer primitive is one
fewer bug.

---

## 3. BUG-03 — letter-spacing is silently dropped

`pdf-lib@1.17.1`'s `drawText()` has **no `letterSpacing` option**. The value is
accepted and discarded. Confirmed: `testing_final.pdf` contains **0 `Tc`
operators and 0 `Tz` operators**.

Measured ink width of the two heavily-tracked strings:

| String | Reference | Generated | Missing |
|---|---|---|---|
| `THIS IS TO CERTIFY THAT` | **77.2 mm** | 50.1 mm | −35 % |
| `COURSE MODULES` | **47.1 mm** | 36.2 mm | −23 % |

This is the biggest *typographic* difference. The reference reads as a formal
certificate specifically because of the extreme tracking (170–180 in the PSD,
per `Design Document/03_TYPOGRAPHY_SPEC.md`).

**Worse:** `renderTextInField` **includes** the phantom tracking when measuring
width, so it shrinks and wraps text as if it were 20–30 % wider than what
actually gets drawn. That is why the completion statement wraps a word early —
reference line 1 = 167.8 mm, generated line 1 = 141.6 mm.

### Fix — draw tracked text glyph-by-glyph

```ts
const drawTrackedText = (
  page: any,
  text: string,
  opts: { x: number; y: number; size: number; font: any; color: any },
  letterSpacingPt: number
) => {
  if (letterSpacingPt === 0) return page.drawText(text, opts);
  let cursor = opts.x;
  for (const ch of text) {
    page.drawText(ch, { ...opts, x: cursor });
    cursor += opts.font.widthOfTextAtSize(ch, opts.size) + letterSpacingPt;
  }
};

export const measureTracked = (t: string, font: any, size: number, lsPt: number) =>
  font.widthOfTextAtSize(t, size) + lsPt * Math.max(t.length - 1, 0);
```

Route **every** `page.drawText` in `renderTextInField` (both the `runs` branch
and the plain branch) through `drawTrackedText`, and use `measureTracked` as the
single source of truth for width, so measurement and drawing can never diverge
again.

> **Alternative:** `page.pushOperators(setCharacterSpacing(lsPt))` before the
> text block. Cheaper, but PDF `Tc` applies to the space glyph too —
> glyph-by-glyph matches Photoshop tracking exactly.

### Calibration targets (post-fix)

Tune `letterSpacing` until measured ink width matches:

| Field | Target ink width | Approx. value |
|---|---|---|
| `salutation` | 77.0 mm | ~250–320 ‰ |
| `courseModulesHeading` | 47.0 mm | ~200–220 ‰ |
| `programTitle` (46-char sample) | 179.8 mm | ~18 ‰ (current value OK) |

The PSD's stored 170/180 are Photoshop tracking units, which do not map 1:1 to
per-mille of em in this renderer. **Measure, don't assume.**

---

## 4. BUG-04 — multi-line first baseline is ~5.5 mm too low

```ts
const baselineOffset = mmToPt(field.height) * fontSizeRatio;
```

`field.height` is the **cap height of one line** for single-line fields (the
comment in your own code says as much). But for `completionStatement` it is
`8.2 mm` — the height of the whole **two-line block**. So the first baseline is
pushed a full block-height down.

| | Reference | Generated | Delta |
|---|---|---|---|
| completion statement ink | y 142.5 – 150.6 | y 148.0 – 154.8 | **+5.5 mm** |
| clearance to grade badge | 5.1 mm | 0.8 mm | collision risk |

### Fix

Add an explicit `capHeightMm` per field (the single-line cap height) and use it:

```ts
const capHeightMm = field.capHeightMm ?? field.height / Math.max(field.maxLines, 1);
const baselineOffset = mmToPt(capHeightMm) * fontSizeRatio;
```

For `completionStatement`, set `capHeightMm: 2.6`.

**Acceptance:** statement ink must land in **y 142.5 – 150.7 mm**, leaving ≥ 5 mm
clear above the badge.

---

## 5. BUG-05 — line primitive draws diagonals

```ts
const startPt = { x: xPt,       y: pageHeight - mmToPt(shape.y) };
const endPt   = { x: xPt + wPt, y: pageHeight - mmToPt(shape.y + shape.height) };
```

Width **and** height are both consumed, so a "vertical divider" declared as
`w: 0.5, h: 6.2` renders as a line leaning 4.6°.

Confirmed in the output: the module divider at x = 216.65 mm shifts to
216.82 mm two millimetres lower. The reference dividers are **perfectly
vertical**, spanning y 128.1 → 133.9 mm at constant x.

### Fix — make orientation explicit

```ts
} else if (shape.kind === "line") {
  const horizontal = shape.orientation
    ? shape.orientation === "horizontal"
    : shape.width >= shape.height;      // back-compat inference

  const start = { x: xPt, y: pageHeight - mmToPt(shape.y) };
  const end = horizontal
    ? { x: xPt + wPt, y: start.y }
    : { x: xPt,       y: pageHeight - mmToPt(shape.y + shape.height) };

  const lineOpts: any = {
    start,
    end,
    thickness: borderWidth > 0 ? borderWidth : 0.5,
  };
  if (strokeColor) lineOpts.color = strokeColor;
  page.drawLine(lineOpts);
}
```

Then tag the template:

- `orientation: "vertical"` — the 3 module dividers, the QR divider.
- `orientation: "horizontal"` — the salutation flanks, the name flanks, the
  COURSE MODULES flanks, the 3 signature underlines.

**Exception — keep the footer ticks slanted.** `Line 7 / Line 7 copy`
(x 35.6 / 73.6, y 196.8, w 0.4, h 4.1) are genuinely slanted in the reference.
Give those an explicit `kind: "polygon"`, or leave them as legacy diagonal lines.

---

## 6. Corner groups — exact geometry

Every diagonal in this design runs **top-right → bottom-left**, at slope
`dx/dy ≈ −1.10` in the top-left group and `≈ −1.40` in the bottom-right group.
All coordinates below are **mm from the page top-left**, measured from the
reference at 150 dpi (±0.2 mm).

### 6.1 Top-left group

Replaces the two `triangle` shapes; keeps the existing white accent bar.

```ts
// Layer 2a — navy wedge. Bleeds off the top and left trim.
{ kind: "polygon", layer: 2, fill: "#061A50", points: [
    { x:  -5.0, y:  -5.0 },
    { x:  23.4, y:  -5.0 },   // hypotenuse: x = 17.9 − 1.10·y
    { x:  -5.0, y:  20.8 },
]},

// Layer 2b — blue parallel band, 2.0 mm clear of the wedge, 6.94 mm wide (horizontal).
{ kind: "polygon", layer: 2, fill: "#1669B2", points: [
    { x:  25.1, y:  -5.0 },
    { x:  32.1, y:  -5.0 },
    { x:  -5.0, y:  28.8 },
    { x:  -5.0, y:  22.5 },
]},

// Layer 2c — white accent bar. UNCHANGED — already correct.
// Its job is to cut a horizontal slit through the blue band at y 8.0–9.4.
{ kind: "rect", layer: 2, x: 9.1, y: 8.0, width: 14.2, height: 1.4, fill: "#FFFFFF" },
```

**Delete** the two `kind: "triangle"` entries. Note the white bar only *reads*
once the blue band exists behind it — today it draws onto white and is invisible.

Verification rows:

| y | navy right edge | blue band span |
|---|---|---|
| 0 | 17.4 | 19.6 – 26.6 |
| 5 | 12.0 | 14.1 – 21.0 |
| 8–9 | 8.6 | *(cut by the white bar)* |
| 10 | 6.4 | 8.5 – 15.4 |
| 15 | 1.0 | 2.9 – 9.8 |
| 20 | — | 0.0 – 4.2 |

### 6.2 Bottom-right group

Three shapes plus a **re-narrowed footer bar**. The design is: blue
parallelogram → ~2.7 mm white diagonal sliver → navy block.

```ts
// Layer 4 — footer bar. Its right edge is a DIAGONAL, not a flat cut.
// Revert the v2 widening (width 281.8) in favour of this polygon.
{ kind: "polygon", layer: 4, fill: "#1669B2", points: [
    { x:   7.6, y: 191.68 },
    { x: 231.9, y: 191.68 },
    { x: 214.9, y: 203.87 },   // x = 231.5 − 1.40·(y − 192)
    { x:   7.6, y: 203.87 },
]},

// Layer 5a — free-floating blue accent band above the footer.
{ kind: "polygon", layer: 5, fill: "#1669B2", points: [
    { x: 286.3, y: 177.0 },
    { x: 290.8, y: 177.0 },
    { x: 273.4, y: 189.5 },
    { x: 268.9, y: 189.5 },
]},

// Layer 5b — navy corner block.
// Bleeds off the RIGHT trim only; the bottom is a HARD edge at 203.87.
{ kind: "polygon", layer: 5, fill: "#061A50", points: [
    { x: 302.0, y: 180.9 },   // enters the right trim at y ≈ 180.9
    { x: 280.0, y: 193.1 },
    { x: 233.7, y: 193.1 },
    { x: 218.4, y: 203.87 },
    { x: 302.0, y: 203.87 },
]},
```

Verification — navy left edge per row:

| y | 182 | 186 | 190 | 194 | 198 | 202 | 204 |
|---|---|---|---|---|---|---|---|
| reference | 295.4 | 289.6 | 284.0 | 232.4 | 226.6 | 221.2 | *(none)* |

The white sliver between footer-blue and corner-navy is ~3.8 mm horizontally
(~2.7 mm perpendicular). **It is a deliberate design element — do not close it.**

---

## 7. BUG-06 — diamond bullet rotates about the wrong pivot

`Rectangle 6` uses `rotationDeg: 45` on a `rect`. pdf-lib rotates about the
**bottom-left corner**, not the centre, so the diamond is displaced up-left and
its bounding box grows to `side × √2`.

| | Reference | Generated |
|---|---|---|
| diamond bbox height | 2.71 mm | 4.57 mm |
| diamond top | y 76.88 | y 75.19 |
| name ink bottom | y 74.56 | y 74.90 |
| **clearance** | **2.32 mm** | **0.29 mm** ← visibly collides |

### Fix

Drop the rotated rect; draw an explicit polygon centred on the target point.

```ts
// Diamond: bbox 2.7 × 2.7 mm, centre (150.0, 78.2)
{ kind: "polygon", layer: 3, fill: "#34C5CA", points: [
    { x: 150.00, y: 76.85 },
    { x: 151.35, y: 78.20 },
    { x: 150.00, y: 79.55 },
    { x: 148.65, y: 78.20 },
]},
```

If you keep `rotationDeg` anywhere else, compensate the anchor by
`(w/2·(1 − cos θ) + h/2·sin θ, …)`. For a 45° square, a polygon is simpler.

---

## 8. Grade badge must be a pill, not a rounded rect

Measured badge left edge, row by row:

| y | 156.1 | 157.9 | 159.7 | 161.5 | 163.3 | 163.9 |
|---|---|---|---|---|---|---|
| **reference** | 125.47 | 123.61 | 123.10 | 123.61 | 125.30 | 127.00 |
| **generated** | 122.93 | 122.93 | 122.93 | 122.93 | 122.93 | 122.93 |

The reference curvature is a **full semicircular cap**: `r = height / 2`.

```ts
{ kind: "rect", layer: 6, x: 122.9, y: 155.3, width: 50.4, height: 8.6,
  fill: "#34C5CA", stroke: "#1669B2", strokeWidthMm: 0.02,
  cornerRadiusMm: 4.3 },           // was 1.5
```

Also check the grade runs: in the reference the `A+` glyph is ~1.8× the cap
height of the `FINAL GRADE |` label. Your `runs` already declare 10 pt / 18 pt,
so the ratio is right — it just reads wrong today because the label loses its
tracking (BUG-03) and the container is square instead of a pill.

---

## 9. Colour — CMYK vs sRGB (your palette is not wrong, the conversion is)

The reference PDF is **DeviceCMYK** (all 61 image XObjects). Your output is
**DeviceRGB**, using naive hex conversions of the PSD's CMYK values.

Dominant-colour extraction from identical 150 dpi renders:

| Role | PSD CMYK | Your hex (naive) | Reference renders as |
|---|---|---|---|
| Deep Navy | C96 M82 Y44 K44 | `#061A50` | **`#152B48`** |
| Corporate Blue | C91 M56 Y26 K6 | `#1669B2` | **`#0F668F`** |
| Teal / Cyan | C80 M23 Y21 K0 | `#34C5CA` | **`#0099B8`** |
| Body ink | C75 M68 Y67 K90 | `#060808` | `#010203` |

Your blue is a vivid royal blue; the reference is a muted petrol blue. On screen
this is the loudest "that isn't the same certificate" signal — arguably louder
than the corner shapes.

Nobody's palette is wrong. `Design Document/02_COLOR_PALETTE.md` correctly
records the PSD's stored CMYK. But Photoshop's export applies a real ICC
profile, while your renderer does a naive `255·(1−C)·(1−K)` conversion. The two
pipelines simply disagree.

### Option A — retune the sRGB hexes (~30 min, recommended for screen delivery)

Keep the CMYK strings as the print source of truth; add a `hexSrgb` used by the
renderer.

```ts
const colors = {
  deepNavy:      { cmyk: "96,82,44,44", hex: "#061A50", hexSrgb: "#152B48" },
  corporateBlue: { cmyk: "91,56,26,6",  hex: "#1669B2", hexSrgb: "#0F668F" },
  teal:          { cmyk: "80,23,21,0",  hex: "#34C5CA", hexSrgb: "#0099B8" },
  bodyInk:       { cmyk: "75,68,67,90", hex: "#060808", hexSrgb: "#010203" },
  white:         { cmyk: "0,0,0,0",     hex: "#FFFFFF", hexSrgb: "#FFFFFF" },
};
```

Then read `hexSrgb` at every `hexToRgb()` call site.

### Option B — emit real DeviceCMYK (~1 day, correct long-term)

pdf-lib supports `cmyk(c, m, y, k)` as a `Color`. Replace `hexToRgb()` with a
`cmykFromTemplate()` that parses the `cmyk` strings you already store. This makes
the PDF print-accurate **and** makes viewers apply the same conversion the
reference gets, so the two files converge on screen too.

Given you already store CMYK everywhere, **Option B is the right answer** and is
barely more work. Do A now if you need parity this week, then migrate.

---

## 10. Top-right metadata + QR block

| Item | Reference | Generated | Action |
|---|---|---|---|
| Pipe separator | `Certificate No.  \|` / `Issue Date  \|` | absent | Append `"  \|"` to `certNumberLabel` / `issueDateMetaLabel` content |
| Row pitch | 3.89 mm (rows at y 13.2, 17.1) | 3.21 mm (y 13.4, 16.4) | Set `issueDateMetaLabel.y` and `issueDateMetaValue.y` to **17.1** |
| Value column x | 218.0 | 218.5 | OK |
| QR top edge | y **12.06** | y 9.86 | `qrConfig.y: 9.5 → 12.0` |
| QR frame | thin blue border + white quiet zone | none, modules bleed to the edge | Add `borderMm: 0.3`, `borderColor: "#1669B2"`, `margin: 2` |
| Caption leading | ~2.9 mm | ~2.3 mm | `qrCaption2a/b/c.y` → 29.7 / **32.6** / **35.5** |
| Caption line 3 | Regular, mixed case | SemiBold, uppercase | `qrCaption2c.font: "Montserrat-Regular"`, `transformUppercase: false` |

The `LOCALHOST/VERIFY` text is an env-config issue
(`NEXT_PUBLIC_VERIFY_BASE_URL`), not a design issue — but it also reveals that
line 3 is *styled* as a heading when the reference styles it as body copy.
Fix both.

---

## 11. Name underline rules — make them dynamic

The reference rules are **static** (`Line 3` at x 75.7 w 71.6 and x 155.8
w 62.5) and were eyeballed against one 15-character name. Measured reference
rule span is 65.2 → 207.3 mm, centre **136.3 mm** — i.e. not actually centred
under the name (whose centre is 148.9 mm). That is a flaw in the source artwork,
not something to replicate.

Your v2 already fixed the *name* to `alignment: "center"` around x 148.5.
Finish the job by making the rules follow it:

```
ruleSpan  = clamp(nameInkWidth + 12mm, 132mm, 190mm)
leftRule  : x from 148.5 − ruleSpan/2  to  148.5 − 3.4   (stop short of the diamond)
rightRule : x from 148.5 + 3.4         to  148.5 + ruleSpan/2
both at y = 78.2 mm, strokeWidthMm 0.34, colour teal
```

This keeps the diamond centred for **any** name length, which is the entire
point of a programmable template.

---

## 12. Cosmetic — font name tables

Every Montserrat subset in `testing_final.pdf` is named `Montserrat-Thin-XXXX`,
and the Cormorant subset is `CormorantGaramond-Light-XXXX`.

**This is not a rendering bug.** The OS/2 tables are correct
(400 / 500 / 600 / 700 / 800; Cormorant 700). These are static instances
exported from the variable fonts with stale `name` records.

Still worth fixing so the PDF's font list doesn't look wrong to a print vendor:
re-export with `fonttools varLib.instancer --update-name-table`, or patch
`name` IDs 1 / 4 / 6 / 17 in `assets/fonts/*.ttf`.

---

## 13. Implementation order

| # | Task | File | Effort | Visual impact |
|---|---|---|---|---|
| 1 | BUG-01 polygon anchor | `certificateRenderer.ts` | 15 min | 🔴 huge |
| 2 | §6.2 bottom-right polygons + footer | `darbartech-certificate-v2.ts` | 45 min | 🔴 huge |
| 3 | BUG-02 + §6.1 top-left polygons | both | 45 min | 🔴 huge |
| 4 | BUG-03 tracking + calibration | `certificateRenderer.ts` | 2 h | 🔴 huge |
| 5 | §9 colour (Option A or B) | `darbartech-certificate-v2.ts` | 30 min / 1 d | 🔴 huge |
| 6 | BUG-04 multi-line baseline | `certificateRenderer.ts` | 30 min | 🟠 medium |
| 7 | BUG-05 line orientation | both | 30 min | 🟠 medium |
| 8 | BUG-06 diamond polygon | `darbartech-certificate-v2.ts` | 15 min | 🟠 medium |
| 9 | §8 badge pill radius | `darbartech-certificate-v2.ts` | 5 min | 🟠 medium |
| 10 | §10 QR + metadata | `darbartech-certificate-v2.ts` | 45 min | 🟡 small |
| 11 | §11 dynamic name rules | both | 1 h | 🟡 small (robustness) |
| 12 | §12 font name tables | `assets/fonts/` | 20 min | ⚪ none |

**Steps 1–5 close roughly 85 % of the perceived gap.**

Do step 1 before touching any coordinate. The reason the v2 tuning pass didn't
converge is that the polygon mirror bug meant every bottom-right adjustment was
moving a shape that was already off-page — the feedback loop was broken, so
"GAP-02 through GAP-11" were tuned against noise.

---

## 14. Acceptance tests

Extend `scripts/renderReferenceCert.ts` to render the **exact Aayara payload**
(name `AAYARA SHRESTHA`, cert `DT-CERT-2026-00125`, issue `2026-09-11`, grade
`A+`, the four reference modules, signatories Mohan Shahi / Nirmala Shrestha),
rasterise both PDFs at 150 dpi, and assert:

```
PASS if, for every check below, |reference − generated| ≤ 0.5 mm
```

| # | Check | Expected (mm) |
|---|---|---|
| T1 | navy wedge right edge @ y=0 / y=10 | 17.4 / 6.4 |
| T2 | blue band span @ y=5 | 14.1 – 21.0 |
| T3 | white slit vertical extent | 8.0 – 9.4 |
| T4 | footer-blue right edge @ y=198 | 223.1 |
| T5 | corner-navy left edge @ y=198 | 226.6 |
| T6 | white sliver width @ y=198 | ≥ 3.0 |
| T7 | corner-navy bottom edge | 203.9 (no bleed) |
| T8 | `THIS IS TO CERTIFY THAT` ink width | 77.0 |
| T9 | `COURSE MODULES` ink width | 47.0 |
| T10 | completion statement ink | y 142.5 – 150.7 |
| T11 | badge left edge @ y=156.1 vs y=159.7 | 125.5 vs 123.1 (Δ ≥ 2.0) |
| T12 | diamond bbox height | 2.7 |
| T13 | name-bottom → diamond-top clearance | ≥ 2.0 |
| T14 | module divider x drift over its height | ≤ 0.05 |
| T15 | QR top edge | 12.1 |
| T16 | dominant navy / blue / teal RGB | `#152B48` / `#0F668F` / `#0099B8` (ΔE ≤ 5) |

Run this in CI on every template change.

---

## Appendix — measurement method

- Both PDFs rasterised at 150 dpi via `pypdfium2` → 1754 × 1241 px
  (5.9057 px/mm).
- Shape edges located by per-row colour-mask span detection (tolerance: sum of
  per-channel absolute difference < 60).
- Text extents measured with a near-black ink mask (`max(R,G,B) < 110`) so teal
  rules and blue accents don't pollute the bounding boxes.
- Colour-space, transform-matrix and text-operator findings read directly from
  the decompressed content streams via `pikepdf`.
- Font weights read from the OS/2 `usWeightClass` field; family names from the
  `name` table.
- The reference is a flattened CMYK raster (61 DCTDecode XObjects), so all
  reference coordinates are **measured, not extracted** — treat them as ±0.2 mm.
  Where the PSD's own `Design Document/05_SHAPES_AND_GRAPHICS.md` agrees, the
  PSD value was kept (e.g. the white accent bar, the module divider x
  positions).
