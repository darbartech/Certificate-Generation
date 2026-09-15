# DarbarTech PSD Template Mapping & Print Specification

## 1. Master File Inspection

File:

`CERTIFICATE psd.psd`

Verified:

```text
Width:       3508 px
Height:      2480 px
Resolution:  300 PPI
Color:       CMYK
Bit depth:   8-bit
Channels:    4
Physical:    11.6933 × 8.2667 in
Orientation: Landscape
```

This corresponds to A4 landscape proportions.

## 2. Print Geometry

A4 trim:

```text
297 × 210 mm
```

At 300 PPI:

```text
3508 × 2480 px
```

If a printer requires 3 mm bleed on every side, the working canvas should be approximately:

```text
303 × 216 mm
```

At 300 PPI this is approximately:

```text
3579 × 2551 px
```

The exact production canvas must be confirmed with the printer.

Do not change the current master canvas merely to add bleed without preserving the intended trim area.

## 3. Safe Area

Important dynamic text should remain inside a safe area.

Recommended starting rule:

- keep important text at least 5–8 mm inside trim
- keep QR fully inside trim
- decorative artwork may extend into bleed if required
- never allow recipient name or certificate number to touch trim

Final safe-area values must be measured from the PSD.

---

# 4. PSD Layer Audit

Before implementation, inspect the PSD and create a layer manifest.

Required columns:

| Layer ID | Layer Name | Type | Static/Dynamic | Field | Bounds | Font | Size | Color | Notes |
|---|---|---|---|---|---|---|---|---|---|

Every layer must be classified as one of:

- STATIC
- DYNAMIC
- CONDITIONAL
- BACKGROUND
- DECORATIVE
- QR
- SIGNATURE
- UNUSED

Do not start dynamic implementation until this manifest exists.

---

# 5. Recommended Dynamic Layer Naming

Rename layers in the master PSD to predictable identifiers where possible.

Example:

```text
DYN_STUDENT_NAME
DYN_PROGRAM_TITLE
DYN_DURATION
DYN_MODULES
DYN_GRADE
DYN_CERTIFICATE_NUMBER
DYN_ISSUE_DATE
DYN_COMPLETION_DATE
DYN_SIGNATORY_NAME
DYN_SIGNATORY_POSITION
DYN_QR
```

Static examples:

```text
STATIC_LOGO
STATIC_BORDER
STATIC_BACKGROUND
STATIC_MAIN_TITLE
STATIC_FOOTER
STATIC_DECORATION_01
```

The exact names must be based on the actual PSD after layer inspection.

---

# 6. Dynamic Field Manifest

Create a machine-readable manifest.

Example:

```json
{
  "templateId": "darbartech-certificate",
  "version": "1.0.0",
  "page": {
    "width": 3508,
    "height": 2480,
    "unit": "px",
    "dpi": 300,
    "orientation": "landscape",
    "colorMode": "CMYK"
  },
  "fields": {
    "student_name": {
      "type": "text",
      "required": true,
      "alignment": "center",
      "maxLines": 1
    },
    "program_title": {
      "type": "text",
      "required": true
    },
    "duration": {
      "type": "text",
      "required": true
    },
    "modules": {
      "type": "module_list",
      "required": true
    },
    "grade": {
      "type": "text",
      "required": false
    },
    "certificate_number": {
      "type": "text",
      "required": true
    },
    "issue_date": {
      "type": "date",
      "required": true
    },
    "qr": {
      "type": "qr",
      "required": true
    }
  }
}
```

The real coordinates and styles must be extracted from the PSD.

---

# 7. Typography Preservation

For every dynamic text layer record:

- font family
- PostScript font name
- weight
- style
- font size
- tracking
- leading
- alignment
- color
- paragraph settings
- text box bounds

Adobe Photoshop API v2 supports text-layer content/style/position operations, including custom fonts and character/paragraph properties. Use those capabilities if the chosen architecture is Adobe-based.

If the renderer is not Photoshop, reproduce the typography using legally deployable fonts and measured geometry.

Do not replace fonts based only on visual similarity without approval.

---

# 8. Font Licensing

A font can be visually correct but legally unusable on a server.

Before deployment:

1. identify the exact font
2. identify the license
3. confirm server-side/rendering use
4. confirm PDF embedding rights
5. document the decision

Do not upload proprietary font files to a server unless the license permits it.

Adobe's font guidance notes that font licenses vary and that font packaging/sharing restrictions must be checked.

---

# 9. Color Management

The master PSD is CMYK.

Do not blindly copy RGB hex values into the print renderer.

For each important color record:

```text
Brand navy:
CMYK: ______

Brand blue/cyan:
CMYK: ______

Black/body:
CMYK: ______

White:
CMYK: ______
```

The final CMYK values must be confirmed against the actual PSD/printer profile.

If the web preview is RGB, it is only a screen preview.

The print PDF is the print master.

---

# 10. QR Specification

QR should be generated as vector whenever possible.

Minimum requirements:

- sufficient quiet zone
- sufficient physical size
- high contrast
- no decorative distortion
- no clipping
- error correction appropriate for print
- URL tested after PDF export
- QR tested from a physical print

Do not embed personal information directly in the QR payload.

Recommended payload:

```text
https://<official-domain>/verify/<random-token>
```

---

# 11. Signature

The signature area should be treated as an official controlled asset.

If using a signature image:

- store securely
- prevent unauthorized replacement
- associate signature with signatory
- version if necessary
- preserve transparency
- maintain sufficient resolution
- validate that the selected signatory is authorized

Never allow a normal staff user to upload arbitrary signature artwork for an official certificate unless their role permits it.

---

# 12. Dynamic Layout Rules

## Student name

- centered
- single line if possible
- shrink within approved range
- never clip
- never stretch horizontally

## Program title

- may use 1–2 lines if the approved design supports it
- line height must be controlled
- maximum font reduction must be defined

## Module list

- controlled maximum count
- consistent spacing
- no overlap
- no clipping
- long titles must trigger fit logic

## Certificate number

- fixed location
- fixed style
- must always remain readable

## QR

- fixed physical size
- fixed location
- never overlap other content

---

# 13. Visual Regression Testing

Maintain a reference certificate.

Test generated output against the reference at:

- 100%
- 200%
- print proof

Compare:

- logo
- border
- recipient name
- title
- module positions
- grade
- footer
- QR
- signatures
- spacing
- colors

Any unexpected shift must be investigated.

---

# 14. Output Quality Rules

Never:

- export a screenshot as the final print PDF
- use a low-resolution web image as the master
- rasterize text unnecessarily
- stretch a raster image beyond its native quality
- use JPEG as the only print master
- remove embedded fonts without testing
- convert CMYK artwork to RGB and assume it will print identically

Preferred:

```text
Vector/static artwork
+
Vector/text
+
High-resolution raster assets
+
Print-aware PDF
```

Adobe currently recommends PDF/X-4 workflows for print-ready PDF output where appropriate.

---

# 15. PSD as Source of Truth

The PSD remains the design reference.

However, the production renderer must have its own versioned template configuration.

Example:

```text
/design/certificates/
    darbartech/
        v1.0.0/
            template.json
            assets/
            fonts/
            README.md
```

Do not depend on an unversioned PSD file in production.

---

# 16. Template Change Workflow

When the designer changes the PSD:

```text
New PSD
 ↓
Layer audit
 ↓
Visual comparison
 ↓
Dynamic-field mapping
 ↓
Template version bump
 ↓
Regression tests
 ↓
Printer proof
 ↓
Publish new version
```

Never silently replace the active production template.

Old issued certificates must retain their original template version.
