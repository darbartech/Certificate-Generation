const fs = require("fs");

const out = [];
const cat = (p, label, max) => {
  if (!fs.existsSync(p)) {
    out.push("## MISSING " + p);
    out.push("");
    return;
  }
  out.push("## " + label + "  (" + p + ")");
  out.push(fs.readFileSync(p, "utf8"));
  out.push("");
};

// Reconstruct the page's guard-relevant region using anchors:
// stage|generatePreview|collectModuleFit|EXACT_MODULE_COUNT|templateIssues|isTemplateCompatible|runModuleFit|handleCourse|certificateTemplateId|generatePreview
const page = "src/app/admin/certificates/new/page.tsx";
const s = fs
  .readFileSync(page, "utf8")
  .split("\n");
out.push("## PAGE anchor scan: " + page + " (lines=" + s.length + ")");
for (let i = 0; i < s.length; i++) {
  if (
    /collectModuleFit|runModuleFit|EXACT_MODULE_COUNT|isTemplateCompatible|templateIssues|handleCourseSelect|generatePreview|previewErrors|setPreviewErrors|catch /i.test(s[i])
  ) {
    out.push("L" + (i + 1) + "| " + s[i].trim());
  }
}
out.push("");

// search for getTemplate / getCertificateTemplate exports
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) walk(p);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      const t = fs.readFileSync(p, "utf8");
      if (/export (const|function)\s+(getVersionedTemplate|getCertificateTemplate|getTemplateConfig|getTemplate)\b/.test(t)) {
        out.push("FOUND getter candidate: " + p);
      }
    }
  }
};
walk("src");
out.push("");

// direct: does moduleFit.ts reference getTileTemplate internally with a deterministic order? Show the file's tile id/enum mapping.
cat("src/lib/renderer/moduleFit.ts", "moduleFit.ts FULL", 0);

fs.writeFileSync("scripts/_probeOut.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
