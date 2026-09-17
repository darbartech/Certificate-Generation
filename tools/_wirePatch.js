const fs = require("fs");
const P = "src/app/admin/certificates/new/page.tsx";
const s = fs.readFileSync(P, "utf8");
const lines = s.split("\n");
const log = [];

const fail = (msg) => { log.push("FAIL: " + msg); fs.writeFileSync("scripts/_wireLog.txt", log.join("\n"), "utf8"); console.log("fail"); process.exit(1); };

// --- 1. verify anchors exist (exact-match on line text) ---
function findExact(idx0, text) {
  for (let i = idx0; i < lines.length; i++) if (lines[i] === text) return i;
  return -1;
}

const A = "import { getCurrentDateStr } from \"@/lib/renderer/dateFormatter\";";
const aIdx = findExact(0, A);
if (aIdx < 0) fail("import anchor not found: " + A);

const B = "const [previewErrors, setPreviewErrors] = useState<string[]>([]);";
const bIdx = findExact(aIdx, B);
if (bIdx < 0) fail("previewErrors state not found");

// --- 2. insert imports after the dateFormatter import ---
const importBlock =
  "import { getCurrentDateStr } from \"@/lib/renderer/dateFormatter\";\n" +
  "import { collectModuleFitIssues, type ModuleFitIssue } from \"@/lib/renderer/moduleFit\";\n" +
  "import { getTemplateById } from \"@/lib/templates\";";
lines[aIdx] = importBlock;

// --- 3. insert state after previewErrors state ---
const stateBlock =
  B +
  "\n// Pre-flight module-tile fit issues — set by generatePreview so the admin gets a" +
  "\n// per-module, actionable reason BEFORE the PDF renderer refuses (fail-loud, never distort)." +
  "\nconst [previewFitIssues, setPreviewFitIssues] = useState<ModuleFitIssue[]>([]);";
lines[bIdx] = stateBlock;

// --- 4. guard inside generatePreview ---
const C = "const generatePreview = async () => {";
const cIdx = findExact(bIdx, C);
if (cIdx < 0) fail("generatePreview anchor not found");

const D = "const result = await apiClient.generatePreview(formData);";
const dIdx = findExact(cIdx, D);
if (dIdx < 0) fail("apiClient.generatePreview call not found");

// insert guard right after setFormErrors([]) inside generatePreview try-block.
// Safer: insert right before the apiClient.generatePreview call.
const guard =
  "    // GAP-08 pre-flight: run the exact renderer fit math against v2 tile geometry.\n" +
  "    // Never silently distort — if a module title/subtitle can't render, block with the\n" +
  "    // precise per-tile reason right here instead of a cryptic \"Layout warnings\" dump.\n" +
  "    if (!formData.certificateTemplateId) {\n" +
  "      setPreviewFitIssues([]);\n" +
  "    } else {\n" +
  "      const tpl = getTemplateById(formData.certificateTemplateId, formData.certificateTemplateVersion);\n" +
  "      if (tpl) {\n" +
  "        const issues = collectModuleFitIssues(tpl, formData.modules);\n" +
  "        setPreviewFitIssues(issues);\n" +
  "        if (issues.length > 0) {\n" +
  "          setPreviewErrors(issues.map((i) => i.reason));\n" +
  "          setPreviewLoading(false);\n" +
  "          return;\n" +
  "        }\n" +
  "      }\n" +
  "    }\n" +
  "    " + D;
lines[dIdx] = guard;

// --- 5. render the issues in the previewErrors region? Keep minimal: also clear when starting. ---
// add clear at top of generatePreview
const topClear =
  C + "\n    setPreviewFitIssues([]);";
lines[cIdx] = topClear;

fs.writeFileSync(P, lines.join("\n"), "utf8");
log.push("OK  patched " + P);
log.push("  import@L" + (aIdx + 1) + "  state@L" + (bIdx + 1) + "  guard@L" + (cIdx + 1));
fs.writeFileSync("scripts/_wireLog.txt", log.join("\n"), "utf8");
console.log("patched");
