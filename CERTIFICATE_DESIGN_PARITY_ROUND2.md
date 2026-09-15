# Certificate Design Parity — Round 2 Fixes

**Reference:** `Certificate_of_Aayara_final.pdf`
**Current output:** `testing_final_one.pdf` (post v3 patch)
**Verdict:** Round 1 worked — corners, footer diagonal, tracking on the large
headline/salutation strings, and the badge pill are now correctly matching the
reference (measured deltas below are all ≤ 0.8 mm). Three issues remain, all
isolated and small.

---

## 0. What Round 1 fixed (confirmed, no further action)

| Check | Reference | Now | Delta |
|---|---|---|---|
| Bottom-right navy corner bbox | x 217.3–296.9, y 178.8–203.5 | x 218.0–296.9, y 179.0–203.9 | ≤ 0.7 mm ✅ |
| Bottom-right blue accent bbox | x 210.0–289.8, y 170.0–194.9 | x 210.0–290.4, y 170.0–194.9 | ≤ 0.6 mm ✅ |
| `THIS IS TO CERTIFY THAT` tracking | reads full-width, matches | matches | ✅ |
| Grade badge shape | pill (semicircular caps) | pill | ✅ |
| QR border frame | present | present | ✅ |
| QR vertical divider | present | present | ✅ |

Do not re-touch the corner polygons or the badge `cornerRadiusMm` — they're done.

---

## 1. BUG-07 — QR code is oversized and collides with its own caption

The QR square (including its border) is **26% larger** than the reference and
its bottom edge now overlaps the "DIGITAL VERIFICATION" line.

| | Reference | Generated | Delta |
|---|---|---|---|
| QR border box (incl. frame) | 12.19 × 12.19 mm | 15.41 × 15.41 mm | **+3.2 mm** |
| QR bottom edge | y 23.38 | y 27.10 | **+3.7 mm** |
| "DIGITAL VERIFICATION" top edge | y 25.86 | y 24.00 | starts **1.9 mm above** where the QR ends |

The caption literally starts before the (oversized) QR box has finished — that's
the visible overlap in your screenshot.

### Fix — `qrConfig` in `darbartech-certificate-v2.ts`

```ts
const qrConfig = {
  x: 254.4,
  y: 11.2,          // was ~9.5–12.0 depending on which round
  size: 12.2,        // was ~15.4 (effective) — this is the single fix that matters
  errorCorrection: "M" as const,
  margin: 1,
  borderMm: 0.3,
  borderColor: "#1669B2",
};
```

If your renderer adds the border **outside** the `size` box (i.e. `size` is the
QR modules only and the border is drawn additionally), reduce `size` further so
`size + 2×borderMm` still equals 12.2 mm total. Check whichever of these your
`qrGenerator.ts` does today:

```ts
// qrGenerator.ts — confirm which of these you have, then set size accordingly
const totalBoxMm = qrConfig.size + 2 * qrConfig.borderMm; // border ADDS to size
// vs.
const totalBoxMm = qrConfig.size;                          // border is INSET
```

**Acceptance:** QR border box must measure 12.0–12.4 mm square, bottom edge at
y ≤ 23.6 mm.

---

## 2. BUG-08 — QR caption block needs to move down to match its new box

Once the QR shrinks (§1), re-anchor the caption stack so it sits with the same
clearance the reference has (0.5 mm gap between QR bottom and caption top).

| Field | Current `y` | New `y` |
|---|---|---|
| `qrCaption1` ("DIGITAL VERIFICATION") | 24.0 | **25.9** |
| `qrCaption2a` ("Scan QR code to verify") | 29.7 | **29.7** (unchanged, re-check after) |
| `qrCaption2b` ("authenticity online at") | 32.6 | **32.6** (unchanged) |
| `qrCaption2c` (URL) | 35.5 | **35.5** (unchanged) |

Only `qrCaption1.y` needs to move; the rest were already correctly spaced in
Round 1 and just need the QR box out of their way.

**Acceptance:** "DIGITAL VERIFICATION" top edge ≥ QR bottom edge + 0.3 mm, no
pixel overlap at 150 dpi.

---

## 3. BUG-09 — module column dividers render as a faint, anti-aliased hairline

Reference divider is a crisp, fully-opaque `#0F668F` line. Yours renders as a
lighter, partially transparent blend (`#29769B` sampled at the same point) —
classic symptom of a stroke thinner than one device pixel at render resolution.

| | Reference (peak pixel) | Generated (peak pixel) |
|---|---|---|
| Module divider color | `(15, 102, 143)` — solid | `(41, 118, 155)` — ~35% lighter |

### Fix

Bump the three module-divider lines' `strokeWidthMm` from `0.17` to `0.22`, and
confirm `drawLine`'s `thickness` isn't being computed in **pt** when the rest of
the shape uses **mm** — a common off-by-unit cause of "correct color, half
opacity" artifacts (the renderer draws a 0.17 mm line but anti-aliases it across
a device pixel because 0.17 mm ≈ 0.36 pt ≈ 0.75 px at 150 dpi, so it's never
fully opaque at typical screen/print resolutions).

```ts
{ kind: "line", orientation: "vertical", x: 87.1, y: 128.1, width: 0, height: 5.8,
  stroke: "#1669B2", strokeWidthMm: 0.22, layer: 3 },   // was 0.17
{ kind: "line", orientation: "vertical", x: 150.1, y: 128.1, width: 0, height: 5.8,
  stroke: "#1669B2", strokeWidthMm: 0.22, layer: 3 },
{ kind: "line", orientation: "vertical", x: 216.6, y: 128.1, width: 0, height: 5.8,
  stroke: "#1669B2", strokeWidthMm: 0.22, layer: 3 },
```

**Acceptance:** sampled peak pixel color of each divider must be within ΔE ≤ 8
of `#0F668F` (i.e. materially solid, not a 35% tint).

---

## 4. BUG-10 — "FINAL GRADE |" label still under-tracked

The label run inside the badge lost ~9 mm of width versus the reference, same
root cause as the headline (glyph-by-glyph tracking wasn't applied to *every*
`runs` field, only some).

| | Reference | Generated |
|---|---|---|
| "FINAL GRADE \|" ink start (badge label run) | x 123.0 | x 132.0 |

### Fix

Confirm `gradeBadgeText`'s `runs[0]` (the `"FINAL GRADE | "` label run) is being
drawn through the same `drawTrackedText` / `measureTracked` path documented in
Round 1 §3 (BUG-03), not through a separate code path for badge runs. If
`renderTextInField`'s `runs` branch has more than one call site, this is likely
just one of them that wasn't updated.

**Acceptance:** "FINAL GRADE |" ink width ≥ 24 mm (currently ~17.8 mm).

---

## 5. Implementation order

| # | Task | File | Effort | Impact |
|---|---|---|---|---|
| 1 | BUG-07 shrink QR to 12.2mm | `darbartech-certificate-v2.ts` | 5 min | 🔴 fixes visible overlap |
| 2 | BUG-08 nudge `qrCaption1.y` | `darbartech-certificate-v2.ts` | 2 min | 🔴 fixes visible overlap |
| 3 | BUG-10 verify tracking path on badge runs | `certificateRenderer.ts` | 15 min | 🟠 medium |
| 4 | BUG-09 module divider stroke width | `darbartech-certificate-v2.ts` | 5 min | 🟡 small, polish |

Do 1 and 2 together — one visual bug, two related fields — and re-render before
touching anything else, since a mis-sized QR could itself have been masking or
distorting your earlier caption-position checks.

---

## 6. Updated acceptance checklist (append to Round 1's table)

| # | Check | Expected |
|---|---|---|
| T17 | QR border box size | 12.0 – 12.4 mm square |
| T18 | QR bottom edge → caption top clearance | ≥ 0.3 mm, no overlap |
| T19 | Module divider peak-pixel color | ΔE ≤ 8 from `#0F668F` |
| T20 | Badge label "FINAL GRADE \|" ink width | ≥ 24 mm |

---

## Appendix — measurement method

Same as Round 1: both PDFs rasterised at 150 dpi via `pypdfium2`
(5.9057 px/mm), edges located by colour-mask span detection, text extents by
near-black/white ink masking. All reference values ±0.2 mm.
