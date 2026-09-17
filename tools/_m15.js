"use strict";
const fs = require("fs");
const o = [];
const t = fs.readFileSync("src/lib/types.ts", "utf8").split("\n");
o.push("CertificateModuleInput occurrences:");
t.forEach((l, i) => { if (l.includes("CertificateModuleInput")) o.push("  " + (i + 1) + "|" + l); });
o.push("CertificateModule type lines:");
t.forEach((l, i) => { if (l.includes("export type CertificateModule")) o.push("  " + (i + 1) + "|" + l); });
const v2 = fs.readFileSync("src/lib/templates/darbartech-certificate-v2.ts", "utf8").split("\n");
o.push("TemplateField interface/fields (v2 imports):");
v2.slice(0, 12).forEach((l, i) => o.push("  " + (i + 1) + "|" + l));
o.push("getTemplateById export:");
v2.forEach((l, i) => { if (l.trim().startsWith("export const getTemplateById")) o.push("  " + (i + 1) + "|" + l); });
const idx = "src/lib/templates/index.ts";
o.push("templates/index.ts exists=" + fs.existsSync(idx));
if (fs.existsSync(idx)) {
  const a = fs.readFileSync(idx, "utf8").split("\n");
  a.forEach((l, i) => { if (l.includes("getTemplateById")) o.push("  " + (i + 1) + "|" + l); });
}
fs.writeFileSync("scripts/_m15.txt", o.join("\n"), "utf8");
console.log("ok");
