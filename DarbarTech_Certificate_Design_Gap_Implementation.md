# DarbarTech Programmable Certificate --- Design Gap & Exact-Match Implementation Specification

## 1. Objective

This document is the implementation authority for making the generated
certificate match the supplied original PDF:

-   **Reference / original:** `Certificate of Aayara final.pdf`
-   **Current generated output:** `kumar.pdf`
-   **Current project:**
    `DarbarTech_Programmable_Certificate_System_Documentation(3).zip`

The target is **not a redesign**. The generated PDF must reproduce the
original document's visual system as closely as the source PDF allows:

-   exact A4 landscape geometry
-   exact element positions and proportions
-   logo scale and placement
-   corner ribbons and bottom-right geometry
-   border/frame
-   typography and font family/weight
-   line lengths and stroke weights
-   colors
-   watermark position/opacity
-   QR position and caption
-   module grid
-   grade badge
-   signature/date area
-   footer bar
-   certificate metadata
-   spacing and hierarchy

The supplied original PDF is the visual source of truth. Existing
project design documents are useful implementation references, but they
must not override the supplied original PDF when a visual discrepancy
exists.

## 2. Source comparison

The original certificate contains:

-   `CERTIFICATE OF COMPLETION`
-   `THIS IS TO CERTIFY THAT`
-   recipient name
-   `has successfully completed the`
-   program title
-   duration + provider sentence
-   four course-module columns
-   completion statement
-   final-grade badge
-   date of issue
-   authorized signatory
-   managing director
-   certificate number / issue date
-   QR verification block
-   bottom verification/footer bar

The original Aayara PDF specifically shows:

-   Recipient: `AAYARA SHRESTHA`
-   Certificate No.: `DT-CERT-2026-00125`
-   Issue Date: `2026-09-11`
-   Program: `PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM`
-   Duration: `4-month`
-   Four modules:
    1.  `COMPUTER FUNDAMENTALS` --- `Basic Computer Operations`
    2.  `OFFICE APPLICATIONS` --- `Microsoft Word | Excel | PowerPoint`
    3.  `GRAPHIC DESIGN` --- `Adobe Photoshop | Illustrator | Canva`
    4.  `NEPALI TYPING` --- `Unicode · Traditional Nepali Typing`
-   Grade: `A+`
-   Authorized Signatory: `Mohan Shahi`
-   Managing Director: `Nirmala Shrestha`

The generated `kumar.pdf` is structurally similar, but it is **not
visually equivalent** to the original.

## 3. Major visual gaps found

### GAP-01 --- Logo is dramatically undersized

The generated certificate shows the DarbarTech logo much smaller than
the original.

The project currently loads `public/logo.png` into the configured logo
field. The supplied PNG has large transparent margins:

-   source image: `7283 × 3750`
-   visible content bounding box is much smaller than the full bitmap

Therefore, scaling the whole bitmap to the field causes the visible logo
to shrink.

### Required fix

Implement one of these deterministic solutions:

1.  crop transparent pixels from the logo before embedding, or
2.  create a production-safe cropped logo asset while preserving the
    exact original logo artwork, or
3.  calculate the visible-alpha bounding box and place/scale the visible
    artwork to the reference bounding box.

Do **not** redraw, simplify, recolor, distort, or replace the DarbarTech
logo.

The same issue must be checked for `logo-small.png` because it is used
as the watermark.

------------------------------------------------------------------------

### GAP-02 --- Top-left corner decoration does not match

The generated PDF has a large block-like blue corner area. The original
has a more controlled diagonal ribbon/triangle composition.

The current `drawShapes()` implementation renders a generic triangle
path and rectangular shape primitives. This is not sufficient to
guarantee the same visual geometry as the source PDF.

### Required fix

Rebuild the top-left decoration from measured geometry of the original
PDF.

Do not assume that a mathematically similar triangle is visually
equivalent.

Required characteristics:

-   diagonal navy wedge
-   corporate-blue supporting ribbon
-   white horizontal accent
-   correct off-canvas bleed
-   correct intersection with the outer frame
-   no large unintended solid rectangle
-   no visible hard edge where the original artwork bleeds outside the
    trim

Use the original PDF at 100% and 200% zoom as the visual comparison
target.

------------------------------------------------------------------------

### GAP-03 --- Bottom-right corner decoration is incomplete

The generated `kumar.pdf` has the footer blue rectangle ending around
the middle/right portion of the page and leaves a large white area at
the bottom-right.

The original Aayara certificate has a distinctive bottom-right geometric
composition:

-   blue footer bar
-   navy angular block
-   diagonal blue accent
-   geometry reaching the right trim edge
-   visually integrated corner treatment

### Required fix

Add the missing bottom-right shape group as explicit template shapes.

Do not use a generic rectangle.

The renderer must support:

-   polygons/triangles where required
-   rotated rectangles
-   clipped/off-canvas geometry
-   layered shape ordering

Recommended implementation: extend `ShapeConfig` with a polygon/path
primitive if the current rect/triangle model cannot reproduce the source
exactly.

------------------------------------------------------------------------

### GAP-04 --- Footer width and composition are wrong

The original footer is visually integrated with the bottom-right corner
and extends to the right edge.

The generated footer currently stops early because the template contains
only:

``` text
footer rectangle x ≈ 7.6mm
width ≈ 230.8mm
```

This does not reproduce the original full bottom composition.

### Required fix

Treat the footer and bottom-right geometry as one coordinated design
group.

Verify:

-   left start position
-   top/bottom position
-   height
-   right-side termination
-   navy overlap
-   blue diagonal
-   vertical separators
-   footer text baselines

------------------------------------------------------------------------

### GAP-05 --- Certificate metadata at top-right is compressed

The original displays:

``` text
Certificate No. | DT-CERT-2026-00125
Issue Date      | 2026-09-11
```

as a clearly readable two-line metadata block.

The generated PDF visually compresses the information into a small,
single-line-like area.

### Required fix

Do not render the complete metadata as one generic text string.

Use separate fields or precisely controlled text runs:

-   `Certificate No.` label
-   certificate number value
-   `Issue Date` label
-   issue date value

Match the original line spacing, weight, alignment and baseline.

The QR separator line must remain correctly positioned between metadata
and QR area.

------------------------------------------------------------------------

### GAP-06 --- QR block needs reference-level positioning

The generated QR is broadly in the correct region, but exact
reproduction requires comparison of:

-   QR size
-   x/y position
-   quiet zone
-   vertical separator
-   `DIGITAL VERIFICATION`
-   two-line caption
-   URL
-   spacing between QR and caption

The original shows:

``` text
DIGITAL VERIFICATION
Scan QR code to verify
authenticity
darbartech.com/verify
```

The implementation must not concatenate the caption into an uncontrolled
paragraph if that changes line breaks.

------------------------------------------------------------------------

### GAP-07 --- Watermark must be visually measured, not just opacity-matched

The original contains a large faint DarbarTech mark on the right side
behind the main content.

The project currently applies `opacity: 0.08` and uses `logo-small.png`,
which is conceptually correct, but the asset's transparent padding can
alter the visible size.

### Required fix

Measure the visible watermark artwork, not the bitmap bounds.

Match:

-   visible width/height
-   x/y placement
-   opacity
-   cropping
-   relation to program/module content

------------------------------------------------------------------------

### GAP-08 --- Module layout must be four-column by design

The original certificate is built around exactly four module columns.

The current renderer contains a fallback that dynamically spreads 3+
modules when the count is not exactly four.

That fallback is acceptable as defensive code but it must **not** be
used for the standard certificate template.

For the production template:

-   4 modules = exact reference layout
-   each module has number, title, subtitle
-   3 vertical dividers
-   exact column widths
-   exact baselines

If fewer than four modules are selected, the admin UI should either: -
prevent issuance for the exact-match template, or - explicitly support
an approved alternate template.

Do not silently distort the four-column design.

------------------------------------------------------------------------

### GAP-09 --- Course data is not the true source of truth

The current admin panel already has a quick-fill dropdown and calls
`/api/admin/courses`.

However, the bundled project database contains seeded example courses
that do not match the supplied Aayara certificate's four modules.

Current seed data includes examples such as:

-   `Professional Computer & Digital Skills Program`
-   `COMPUTER FUNDAMENTALS`
-   `OFFICE APPLICATIONS`
-   `INTERNET & DIGITAL SKILLS`
-   `DIGITAL MARKETING BASICS`

The original Aayara certificate instead uses:

-   `COMPUTER FUNDAMENTALS`
-   `OFFICE APPLICATIONS`
-   `GRAPHIC DESIGN`
-   `NEPALI TYPING`

Therefore, the admin quick-fill feature is technically present but its
data source is not yet guaranteed to match the public course catalog.

------------------------------------------------------------------------

### GAP-10 --- Signatory handling is incomplete

The admin form currently exposes one selected signatory:

-   name
-   position

But the certificate renderer separately hardcodes a second signatory:

``` text
Nirmala Shrestha
Managing director
```

This means the certificate is not fully data-driven.

### Required fix

Model both signatories explicitly.

Example:

``` ts
signatories: {
  primary: {
    id,
    name,
    position,
    signatureAsset
  },
  secondary: {
    id,
    name,
    position,
    signatureAsset
  }
}
```

If the organization intentionally wants a fixed Managing Director, that
should still be a configurable organization-level setting rather than
hidden renderer logic.

------------------------------------------------------------------------

### GAP-11 --- Grade badge needs exact visual reproduction

The original has a rounded teal badge with:

-   teal fill
-   blue outline
-   white label
-   larger white grade value
-   precise centering

The project has the shape and multi-run concept, which is good, but the
final result must be checked against the original for:

-   badge width
-   badge height
-   radius
-   stroke
-   label baseline
-   grade baseline
-   horizontal spacing
-   visual centering

Do not let grade length change the badge geometry unexpectedly.

------------------------------------------------------------------------

### GAP-12 --- Certificate text must be data-driven without destroying the reference layout

Dynamic fields:

-   recipient
-   program
-   duration
-   modules
-   grade
-   issue date
-   certificate number
-   QR/verification URL
-   signatories

Static fields:

-   certificate headline
-   salutation
-   section labels
-   completion statement
-   footer labels
-   company contact line
-   decorative shapes
-   brand logo

Dynamic text must use constrained fitting.

Do not allow dynamic text to change the overall composition.

------------------------------------------------------------------------

## 4. Typography requirements

The project already contains:

-   Montserrat Regular
-   Montserrat Medium
-   Montserrat SemiBold
-   Montserrat Bold
-   Montserrat ExtraBold
-   Cormorant Garamond Bold

The original visual hierarchy requires these families to be embedded in
the generated PDF.

Required:

-   never silently fall back to Helvetica for production template fields
-   fail loudly if a required font asset is missing
-   verify actual embedded font names in the generated PDF
-   preserve tracking/letter spacing
-   preserve all-caps treatment
-   preserve the serif display face for the recipient

The recipient name is the highest-risk dynamic text field.

Use shrink-to-fit only within the predefined reference box.

Never: - wrap the recipient name to a second line - overlap the
divider - move the rest of the certificate - reduce it below an approved
minimum size

------------------------------------------------------------------------

## 5. Coordinate system

Use A4 landscape:

-   width: `297 mm`
-   height: `210 mm`
-   300 DPI
-   print-oriented layout

The original document is visually designed in millimetre-scale
coordinates.

Keep the template coordinate system independent of screen CSS pixels.

Renderer rule:

``` text
template coordinates → millimetres → PDF points
```

Do not position production certificate elements using browser pixels.

------------------------------------------------------------------------

## 6. Layering order

Required rendering order:

1.  white page background
2.  watermark
3.  outer frame
4.  corner decorations
5.  footer/background geometric shapes
6.  logo
7.  QR block
8.  static labels
9.  dynamic text
10. module content
11. grade badge/text
12. signature/date text
13. footer text

Where a shape is intended to sit behind text, it must be drawn before
that text.

------------------------------------------------------------------------

## 7. Acceptance test

The implementation is not complete until a test certificate using the
Aayara source data can be rendered and visually compared against
`Certificate of Aayara final.pdf`.

Acceptance criteria:

-   no visible element is obviously displaced
-   no missing corner geometry
-   no incorrect logo scale
-   no incorrect footer width
-   no metadata compression
-   no font substitution
-   no missing module
-   no unexpected wrapping
-   no clipping
-   QR is readable
-   certificate remains print-quality
-   PDF page remains A4 landscape
-   dynamic data changes only the intended fields

Use 100% and 200% comparison.

------------------------------------------------------------------------

## 8. Implementation prompt

> **PASTE THE FOLLOWING PROMPT INTO YOUR CODING AGENT**
>
> You are modifying an existing Next.js + TypeScript + pdf-lib
> DarbarTech certificate system.
>
> Your task is to make the generated certificate visually match the
> supplied `Certificate of Aayara final.pdf`. Do not redesign it.
>
> First inspect:
>
> -   `Certificate of Aayara final.pdf`
> -   current generated `kumar.pdf`
> -   `src/lib/templates/darbartech-certificate-v1.ts`
> -   `src/lib/templates/darbartech-certificate-v2.ts`
> -   `src/lib/renderer/certificateRenderer.ts`
> -   `src/lib/renderer/textFitting.ts`
> -   `src/lib/types.ts`
> -   `src/app/admin/certificates/new/page.tsx`
> -   `src/app/api/admin/courses/route.ts`
> -   database course models/seed data
>
> Then implement the following:
>
> 1.  Treat `Certificate of Aayara final.pdf` as the visual source of
>     truth.
> 2.  Keep template versioning; do not mutate already-issued certificate
>     versions.
> 3.  Fix logo visible-content scaling by cropping/ignoring transparent
>     padding without modifying the logo artwork.
> 4.  Rebuild the top-left and bottom-right geometric decorations from
>     the reference PDF.
> 5.  Make the footer reach and integrate with the right-side corner
>     geometry exactly like the reference.
> 6.  Split top-right certificate metadata into controlled label/value
>     lines.
> 7.  Precisely position the QR, separator, verification heading and
>     caption.
> 8.  Precisely position and size the watermark using visible artwork
>     bounds.
> 9.  Keep the four-column module layout as the production layout.
> 10. Keep Montserrat and Cormorant Garamond embedded; no silent
>     Helvetica fallback for v2.
> 11. Make the grade badge geometrically fixed and data-driven.
> 12. Make both signatories data-driven instead of hardcoding the second
>     signatory inside the renderer.
> 13. Keep all dynamic text inside fixed reference boxes with controlled
>     shrink-to-fit.
> 14. Add visual regression tests or a reproducible render comparison
>     workflow.
> 15. Render an Aayara test certificate using the exact source data and
>     compare it against the supplied original PDF.
>
> Do not invent design elements.
>
> Do not use generic CSS to reproduce the certificate.
>
> Do not rasterize the entire certificate into one low-resolution image.
>
> The final output must remain a real vector/text PDF wherever the
> current architecture permits, with embedded fonts and a print-safe 300
> DPI document specification.
>
> Report every remaining pixel/mm-level mismatch instead of claiming
> success prematurely.
