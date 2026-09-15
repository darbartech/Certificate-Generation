/**
 * T25 build-time guard (CERTIFICATE_DESIGN_PARITY_ROUND3.md, §3 item 5 / §4 T25).
 *
 * BUG-11's root cause was that several shapes referenced the brand corporate-blue
 * (and sibling brand) colors as hardcoded literal strings instead of via the
 * `colors.<name>.hex` / `colors.<name>.hexSrgb` palette tokens. When Round 1 corrected
 * the palette, those literals silently kept rendering the old, pre-correction value.
 *
 * This script scans the certificate template files for any of the brand hex literals
 * appearing OUTSIDE the `colors` palette object declaration (where they are legitimately
 * defined once) and fails the build if it finds one. Run via `npm run check:brand-hex`;
 * wired into `npm run lint` and `npm run build` so a reintroduced literal can't ship.
 */

import fs from "fs";
import path from "path";

const TEMPLATE_DIR = path.resolve(process.cwd(), "src/lib/templates");

// Every brand hex the palette currently defines — pre-correction ("hex") and
// corrected ("hexSrgb") — for deepNavy, corporateBlue, and teal. Hardcoding ANY of
// these outside the `colors` object is the failure mode (even the "correct" value
// drifts silently the next time the palette is recalibrated), so all are forbidden.
const FORBIDDEN_HEX_LITERALS = [
  "#1669B2", // corporateBlue.hex (pre-correction — the literal BUG-11 was frozen on)
  "#0F668F", // corporateBlue.hexSrgb (corrected value — still must be referenced via token)
  "#34C5CA", // teal.hex
  "#0099B8", // teal.hexSrgb
  "#061A50", // deepNavy.hex
  "#152B48", // deepNavy.hexSrgb
];

type Violation = {
  file: string;
  line: number;
  hex: string;
  text: string;
};

/**
 * Strips out the `const colors = { ... };` object literal (the one legitimate place
 * these hex strings are allowed to appear) and returns the file with that span blanked
 * out (same line count, so reported line numbers still line up with the original file).
 */
function blankOutColorsDeclaration(source: string): string {
  const declStart = source.search(/const\s+colors\s*=\s*\{/);
  if (declStart === -1) return source;

  // Walk forward from the opening brace to find its matching close, respecting nesting.
  const openBraceIdx = source.indexOf("{", declStart);
  let depth = 0;
  let closeBraceIdx = -1;
  for (let i = openBraceIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        closeBraceIdx = i;
        break;
      }
    }
  }
  if (closeBraceIdx === -1) return source;

  const before = source.slice(0, declStart);
  const declaration = source.slice(declStart, closeBraceIdx + 1);
  const after = source.slice(closeBraceIdx + 1);

  // Replace every non-newline char in the declaration with a space, preserving line breaks
  // so subsequent line numbers computed via split("\n") stay accurate.
  const blanked = declaration.replace(/[^\n]/g, " ");

  return before + blanked + after;
}

function findViolationsInFile(filePath: string): Violation[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const scanned = blankOutColorsDeclaration(raw);
  const lines = scanned.split("\n");
  const violations: Violation[] = [];

  lines.forEach((lineText, idx) => {
    // Skip full-line `//` comments — explanatory prose (e.g. "formerly hardcoded to
    // #1669B2") legitimately mentions the forbidden literals without using them as a
    // value. This only skips lines that are ENTIRELY a comment, so a real code line
    // with a trailing comment is still scanned.
    if (/^\s*\/\//.test(lineText)) return;

    for (const hex of FORBIDDEN_HEX_LITERALS) {
      if (lineText.toUpperCase().includes(hex.toUpperCase())) {
        violations.push({
          file: filePath,
          line: idx + 1,
          hex,
          text: lineText.trim(),
        });
      }
    }
  });

  return violations;
}

function main(): void {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`T25 check: template directory not found at ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(TEMPLATE_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(TEMPLATE_DIR, f));

  const allViolations = files.flatMap(findViolationsInFile);

  if (allViolations.length > 0) {
    console.error(
      `\nT25 FAILED — ${allViolations.length} hardcoded brand hex literal(s) found outside the palette object:\n`
    );
    for (const v of allViolations) {
      console.error(`  ${path.relative(process.cwd(), v.file)}:${v.line}  [${v.hex}]  ${v.text}`);
    }
    console.error(
      "\nReplace each literal with the matching colors.<name>.hex / colors.<name>.hexSrgb token.\n" +
        "See CERTIFICATE_DESIGN_PARITY_ROUND3.md §1 (BUG-11) for context.\n"
    );
    process.exit(1);
  }

  console.log(`T25 passed — no hardcoded brand hex literals outside the palette object (${files.length} file(s) checked).`);
}

main();
