# Certificate Design Parity — Round 3 Comparison

**Reference:** `Certificate_of_Aayara_final.pdf`
**Current output:** `testing_now.pdf` (post Round 1 + Round 2 patches)

**Headline:** Rounds 1 and 2 held. Corner geometry, footer diagonal, QR sizing,
badge tracking, and the fill-color palette (navy / teal / body ink) all measure
within noise of the reference now. There is **one remaining systemic bug**:
several *stroke-only* elements — the outer frame, the three signature
underlines, the QR divider, and two of the three module dividers — are still
rendering the **old, pre-correction "corporate blue"** instead of the
corrected value, and a few of them are also thinner than the reference. Every
element below is measured, not eyeballed.

---

## 0. Confirmed holding from Rounds 1–2 (no action needed)

| Element | Reference | Now | Delta |
|---|---|---|---|
| Bottom-right navy corner bbox | x 217.3–296.9, y 178.8–203.5 | x 218.0–296.9, y 179.0–203.9 | ≤ 0.7 mm ✅ |
| Bottom-right blue accent bbox | x 210.0–289.8, y 170.0–194.9 | x 210.0–290.4, y 170.0–194.9 | ≤ 0.6 mm ✅ |
| Top-left navy/blue wedge | matches | matches | ✅ |
| Footer diagonal right edge (y 192/196/200) | 231.3 / 225.5 / 220.0 | 231.5 / 225.7 / 220.1 | ≤ 0.2 mm ✅ |
| QR border box size | 12.19 mm | 12.19 mm | ✅ |
| Badge label "FINAL GRADE \|" tracking | full width | full width | ✅ |
| Grade badge pill shape | semicircular caps | semicircular caps | ✅ |
| **Navy fill** (`#152B48`) | (21,43,72) | (21,43,72) | ✅ exact |
| **Teal fill/stroke** (`#0099B8`) | (0,153,184) | (0,153,184) | ✅ exact |
| **Body ink** (`#010203`) | (1,2,3) | (1,2,3) | ✅ exact |
| **Corporate-blue FILL** (footer bar, corner block) | (15,102,143) | (15,102,143) | ✅ exact |
| All text field bounding boxes (headline, name, program title, duration, completion, signatures, metadata) | — | within 0.4–1.0 mm | ✅ (differences are just content-length, not position) |

The Round 1 colour fix (§9, Option A — swapping in `hexSrgb` values) **worked**
for every element that reads its color from `colors.teal` / `colors.deepNavy` /
`colors.bodyInk`, and for the two corporate-blue **fills** in the corner/footer
polygons. Don't touch any of the above.

---

## 1. BUG-11 — corporate-blue *strokes* are still on the old hex

This is the one real regression. Compare the corrected fill color against six
stroke elements that should be the identical corporate blue:

| Element | Reference (actual ink) | Generated (actual ink) | Match? |
|---|---|---|---|
| Footer bar **fill** (control) | `(15,102,143)` | `(15,102,143)` | ✅ correct |
| Outer page frame **stroke** | `(22,106,145)`* | `(75,140,171)` | ❌ wrong hex + thin |
| QR divider **stroke** | `(96,154,181)`* | `(15,102,143)` | ⚠️ see note below |
| Module divider #1 (x=87.1) | `(15,102,143)` | `(22,105,178)` | ❌ wrong hex |
| Module divider #2 (x=150.1) | `(15,102,143)` | `(22,105,178)` | ❌ wrong hex |
| Module divider #3 (x=216.6) | `(15,102,143)` | `(61,130,190)` | ❌ wrong hex + thin |
| Date underline | `(15,102,143)` | `(116,166,190)` | ❌ wrong hex + thin |
| Signatory-1 underline | `(77,141,171)`* | `(116,166,190)` | ❌ wrong hex + thin |
| Signatory-2 underline | `(15,102,143)` | `(72,138,169)` | ❌ wrong hex + thin |

\* Reference values marked with `*` are themselves partially anti-aliased
(the reference frame/QR-divider/sig1-underline are also very thin lines in the
source PSD) — treat those rows as "should be a *blend toward* `#0F668F`", not
an exact-pixel target. The important signal is: **every one of the six failing
rows lands near `(22,105,178)` / `#1669B2`** — the pre-correction hex — while
the passing rows land on `(15,102,143)` / `#0F668F`, the corrected one.

### Root cause

Round 1's colour fix (§9) added a corrected value to the `colors` palette
object and updated it everywhere the renderer reads `colors.corporateBlue.*`.
But several shapes in the template — the outer frame, the QR divider, the
module dividers, and the three signature underlines — have their `stroke`
property set to a **literal hardcoded string** `"#1669B2"` rather than a
reference to `colors.corporateBlue.hex` (or `.hexSrgb`). The palette swap
never touches a literal string, so these nine shapes are frozen on the old
color no matter how many times the palette gets corrected.

This is the same category of bug as BUG-09 from Round 2 (module dividers) —
except Round 2's fix widened the stroke, which incidentally made *some* of
these render closer to solid, but never touched the underlying wrong hex. That
is why divider #1/#2 are now solid *but the wrong colour*, while #3 and the
underlines are still both wrong *and* faint.

### Fix

**Step 1 — find every hardcoded literal.** In `darbartech-certificate-v2.ts`
(and check `darbartech-certificate-v1.ts` if v1 is still reachable), search for
the literal string:

```
grep -n '"#1669B2"' src/lib/templates/darbartech-certificate-v2.ts
grep -n "1669B2" src/lib/templates/darbartech-certificate-v2.ts
```

Every hit inside a `stroke:` field is a candidate. Based on this diff, that's
at minimum:

- Outer frame (`Layer 1`)
- QR separator line
- Module divider #1, #2, #3 (`Layer 3`)
- 3× signature underlines (`Layer 3`)

**Step 2 — replace the literal with a token, not another literal.** Don't
just find-and-replace `"#1669B2"` → `"#0F668F"` (that repeats the exact
mistake with a new hardcoded string and will drift again next time the
palette changes). Reference the palette object instead:

```ts
// Before
{ kind: "line", orientation: "vertical", x: 87.1, y: 128.1, width: 0, height: 5.8,
  stroke: "#1669B2", strokeWidthMm: 0.22, layer: 3 },

// After
{ kind: "line", orientation: "vertical", x: 87.1, y: 128.1, width: 0, height: 5.8,
  stroke: colors.corporateBlue.hexSrgb, strokeWidthMm: 0.22, layer: 3 },
```

Since `shapes` is defined as a plain array literal above `colors` in the file
today, this requires either (a) moving the `colors` declaration above `shapes`,
or (b) converting `shapes` into a function `buildShapes(colors)` called after
`colors` is defined, or (c) post-processing the array once at module load:

```ts
// Simplest fix if reordering the file is inconvenient:
const OLD_BLUE = "#1669B2";
const shapesFixed = shapes.map(s => ({
  ...s,
  stroke: s.stroke === OLD_BLUE ? colors.corporateBlue.hexSrgb : s.stroke,
}));
```

Use `shapesFixed` (not `shapes`) in the exported `TemplateConfig`. Whichever
approach you pick, add an assertion in the render pipeline or a lint rule that
fails the build on any literal `#1669B2` / `#34C5CA` / `#061A50` string outside
the `colors` object — that's what let this regression through invisibly.

**Step 3 — the same audit applies to `fields[...].color`.** This diff only
checked `stroke`, but check every field's `color:` property too
(`certNumberLabel`, `footerVerified`, etc.) for the same literal-vs-token issue,
since text color has the identical failure mode.

---

## 2. BUG-12 — a subset of those same strokes are also sub-pixel thin

Independent of the color bug, three elements are anti-aliased to a visibly
lighter tint even where the hex is being sampled close to correct, because the
stroke is thinner than ~1 device pixel at typical render/print resolution
(same root cause as Round 2's BUG-09, just not yet applied to these three):

| Element | Current | Target |
|---|---|---|
| Outer page frame | 0.17 mm | **0.20 mm** |
| Module divider #3 (x=216.6) | inherited from Round 2 (0.22 mm) but still faint — check for a duplicate/legacy declaration at the old 0.17 mm shadowing it | **confirm only one declaration exists, at 0.22 mm** |
| Signature underlines (×3) | 0.10 mm | **0.15 mm** |

For module divider #3 specifically: dividers #1/#2 already render as fully
solid at the (wrong) color, which tells us the 0.22 mm width from Round 2 does
work — so #3's continued faintness means either an old shape entry for that
divider wasn't removed (two overlapping declarations, one thin one thick, is a
plausible read of `(61,130,190)` sitting between the solid-old-hex value and
white), or its `y`/`height` don't match the other two. Check for a duplicate
entry before touching the width.

---

## 3. Implementation order

| # | Task | File | Effort | Impact |
|---|---|---|---|---|
| 1 | Audit + replace all literal `#1669B2` strokes with `colors.corporateBlue.hexSrgb` | `darbartech-certificate-v2.ts` | 30 min | 🔴 fixes 6 mismatched elements at once |
| 2 | Same audit for literal `color:` on text fields | `darbartech-certificate-v2.ts` | 15 min | 🟠 preventative |
| 3 | Bump outer frame + signature underlines to 0.20 / 0.15 mm | `darbartech-certificate-v2.ts` | 5 min | 🟡 small, polish |
| 4 | Check module divider #3 for a duplicate/legacy declaration | `darbartech-certificate-v2.ts` | 10 min | 🟡 small |
| 5 | Add a build-time check rejecting hardcoded brand hex literals outside `colors` | `certificateRenderer.ts` or a lint script | 20 min | ⚪ prevents recurrence |

Item 1 alone fixes 6 of the 9 flagged elements, since it's one root cause
wearing nine hats.

---

## 4. Updated acceptance checklist

| # | Check | Expected |
|---|---|---|
| T21 | Outer frame stroke color | `#0F668F` family, ΔE ≤ 8 |
| T22 | QR divider stroke color | `#0F668F` family, ΔE ≤ 8 |
| T23 | Module dividers #1/#2/#3 — all three | `(15,102,143)` solid, no outliers between them |
| T24 | Signature underlines ×3 | `#0F668F` family, ΔE ≤ 8, solid (not a >50% white blend) |
| T25 | No literal `#1669B2` / `#34C5CA` / `#061A50` strings remain outside the `colors` object | 0 matches on grep |

---

## Appendix — measurement method

Both PDFs rasterised at 150 dpi via `pypdfium2` (5.9057 px/mm). For each
element, sampled the minimum-luminance pixel within a small mm-window
straddling the expected stroke position, to get the actual peak ink color
independent of exact sub-pixel line placement. All reference values ±1 unit
per channel.
