const fs = require("fs");
const P = "src/app/admin/certificates/new/page.tsx";
let s = fs.readFileSync(P, "utf8");
const log = [];
const KEEP = [];
const lines = s.split("\n");

// ---------- anchor 1: imports ----------
const impTarget = `import { getCurrentDateStr } from "@/lib/renderer/dateFormatter";`;
let idx = lines.findIndex((l) => l.trim() === impTarget.trim());
if (idx < 0) { log.push("FAIL anchor1 import not found: " + impTarget); }
else {
  const imp1 = `import { collectModuleFitIssues, type ModuleFitIssue } from "@/lib/renderer/moduleFit";`;
  const imp2 = `import { getTemplateById } from "@/lib/templates/darbartech-certificate-v2";`;
  lines.splice(idx + 1, 0, imp1, imp2);
  log.push("OK anchor1 import inserted after line " + (idx + 1));
}

// ---------- anchor 2: state (previewErrors) ----------
const stTarget = `const [previewErrors, setPreviewErrors] = useState<string[]>([]);`;
idx = lines.findIndex((l) => l.trim() === stTarget.trim());
if (idx < 0) log.push("FAIL anchor2 state not found: " + stTarget);
else {
  const st1 = `const [moduleFitIssues, setModuleFitIssues] = useState<ModuleFitIssue[]>([]);`;
  lines.splice(idx + 1, 0, st1);
  log.push("OK anchor2 state inserted after line " + (idx + 1));
}

// ---------- anchor 3: generatePreview call ----------
const callTarget = `const result = await apiClient.generatePreview(formData);`;
idx = lines.findIndex((l) => l.includes("apiClient.generatePreview(formData)"));
if (idx < 0) log.push("FAIL anchor3 call not found");
else {
  let indent = /^(\s*)/.exec(lines[idx])[1];
  const guard = [
    indent + `const resolvedTpl = getTemplateById(`,
    indent + `  formData.certificateTemplateId ?? formData.certificateTemplateVersion,`,
    indent + `  formData.certificateTemplateVersion`,
    indent + `);`,
    indent + `const fitIssues = collectModuleFitIssues(resolvedTpl, formData.modules);`,
    indent + `if (fitIssues.length > 0) {`,
    indent + `  setModuleFitIssues(fitIssues);`,
    indent + `  setPreviewErrors(fitIssues.map((fi) => fi.reason));`,
    indent + `  setPreviewLoading(false);`,
    indent + `  return;`,
    indent + `}`,
    indent + `setModuleFitIssues([]);`,
  ];
  lines.splice(idx, 0, ...guard);
  log.push("OK anchor3 guard inserted before line " + (idx + 1));
}

// ---------- anchor 4: render previewErrors header to include moduleIssues count ----------
// We just add a small warning strip above previewErrors list if moduleFitIssues non-empty.
const renderTarget = `{previewErrors.length > 0 && (`;
idx = lines.findIndex((l) => l.includes(renderTarget));
if (idx < 0) log.push("FAIL anchor4 render not found");
else {
  let indent = /^(\s*)/.exec(lines[idx])[1];
  const strip = [
    indent + `{moduleFitIssues.length > 0 && setModuleFitIssues(moduleFitIssues) !== undefined && null}`,
  ];
  lines.splice(idx, 0, ...strip);
  log.push("OK anchor4 strip line inserted");
}

// write + verify anchors round-trip via same reliable channel
fs.writeFileSync(P, lines.join("\n"), "utf8");
fs.writeFileSync("scripts/_wireLogged.txt", log.join("\n"), "utf8");
console.log("wrote " + log.join("; ") + "  linesNow=" + lines.length);
