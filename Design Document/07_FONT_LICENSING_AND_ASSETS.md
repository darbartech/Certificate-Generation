# 8. Font Licensing & Asset Requirements

- Montserrat and Cormorant Garamond are both distributed under the SIL Open Font License (OFL) via Google Fonts — free to embed in server-rendered PDFs and to subset/embed for print, with no royalty.
- Download the exact weights needed (Montserrat Regular/Medium/SemiBold/Bold/ExtraBold, Cormorant Garamond Bold) as .ttf/.otf files and bundle them with the renderer — do not substitute visually-similar system fonts without approval, since tracking and kerning were tuned for these specific families.
- The two logo elements are Smart Objects in the PSD; corresponding flattened PNGs already exist in the project (`psd and logo/final-logo.png`, `psd and logo/final small logo.png`, and `public/logo.png`, `public/logo-small.png`) — confirm these are up to date with the latest brand mark before wiring them into the renderer.
- QR code: generate as vector (SVG) where the rendering pipeline allows, at minimum ~14.7×14.6mm with adequate quiet zone, error correction level M or higher, and a payload of the form `https://<official-domain>/verify/<token>` — never encode personal data directly in the QR payload.
