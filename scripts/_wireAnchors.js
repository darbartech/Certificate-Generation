const fs = require("fs");
const out = [];
const P = "src/app/admin/certificates/new/page.tsx";
const s = fs.readFileSync(P, "utf8").split("\n");

// 1) exact imports block lines 1-20
out.push("== imports 1-20 ==");
for (let i = 0; i < 20 && i < s.length; i++) out.push((i + 1) + "|" + s[i]);
out.push("");

// 2) generatePreview call site — print region where apiClient.generatePreview(formData) is called (from anchor L264-303)
out.push("== generatePreview region (find 'apiClient.generatePreview' then -12..+6) ==");
let g = -1;
for (let i = 0; i < s.length; i++) if (s[i].includes("apiClient.generatePreview")) { g = i; break; }
for (let i = Math.max(0, g - 12); i < Math.min(s.length, g + 6); i++) out.push((i + 1) + "|" + s[i]);
out.push("");

// 3) the isTemplateCompatible + templateIssues derived block (L183-197)
out.push("== isTemplateCompatible / templateIssues region ==");
for (let i = 0; i < s.length; i++) if (/const isTemplateCompatible/.test(s[i])) {
  for (let j = i; j < Math.min(s.length, i + 18); j++) out.push((j + 1) + "|" + s[j]);
  break;
}
out.push("");

// 4) where previewErrors state is declared
out.push("== previewErrors state decl ==");
for (let i = 0; i < s.length; i++) if (/const \[previewErrors/.test(s[i])) out.push((i + 1) + "|" + s[i]);
out.push("");

fs.writeFileSync("scripts/_wireAnchors.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
