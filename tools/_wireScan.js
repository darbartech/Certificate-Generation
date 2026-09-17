const fs = require("fs");
const out = [];
const P = "src/app/admin/certificates/new/page.tsx";
const s = fs.readFileSync(P, "utf8").split("\n");

out.push("== PAGE: lines 1-20 (imports) ==");
for (let i = 0; i < 20 && i < s.length; i++) out.push((i + 1) + "|" + s[i]);
out.push("");

out.push("== PAGE: previewErrors state + generatePreview region ==");
for (let i = 0; i < s.length; i++) {
  const l = s[i];
  if (/previewErrors|setPreviewErrors|const \[preview|EXACT_MODULE_COUNT = 4|const generatePreview|apiClient\.generatePreview|\.generatePreview\(|collectModuleFit|templateIssues|getTemplateById/.test(l)) {
    out.push((i + 1) + "|" + l);
  }
}
out.push("");

out.push("== REGISTRY: templates dir exports (getter signatures) ==");
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) { if (!/node_modules|\.next|\.git/.test(p)) walk(p); }
    else if (/\.(ts)$/.test(e.name)) {
      const t = fs.readFileSync(p, "utf8");
      if (/getTemplateById|getTemplateBy(Id|Key)|REGISTRY|templateRegistry|TEMPLATE_REGISTRY|byVersion|export\s+function\s+getTemplate/.test(t)) {
        out.push("## " + p);
        const m = /export\s+(?:function|const)\s+(getTemplate\w*)\s*(?:=\s*\([^)]*\)\s*=>|\([^)]*\)\s*[:{])?([\s\S]{0,220})/.exec(t);
        if (m) out.push("   " + m[1] + " : " + m[2].replace(/\n/g, " ").slice(0, 180));
        for (const mm of t.matchAll(/(export\s+(?:function|const)\s+\w*\s*=|export\s*\{[^}]*\})/g)) {
          out.push("   [surface] " + mm[1].slice(0, 80));
        }
        out.push("");
      }
    }
  }
};
walk("src/lib/templates");
walk("src/lib");

out.push("");
fs.writeFileSync("scripts/_wireAnchors.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
