"use strict";
const fs = require("fs");
const out = [];

const mtf = "src/lib/renderer/moduleTileFit.ts";
out.push("== " + mtf + "  exists=" + fs.existsSync(mtf) + " ==");
if (fs.existsSync(mtf)) {
  const a = fs.readFileSync(mtf, "utf8").split("\n");
  out.push("  lines=" + a.length);
  out.push("  line 78-92:");
  for (let i = 77; i < 92 && i < a.length; i++) out.push("    " + (i + 1) + "|" + a[i]);
  out.push("  export surface:");
  for (let i = 0; i < a.length; i++) {
    const t = a[i].trim();
    if (/^(export|exported)\b/.test(t) || /\bexport\s+(interface|type|const|function|default)\b/.test(t))
      out.push("    " + (i + 1) + "|" + t);
  }
}
out.push("");

const mf = "src/lib/renderer/moduleFit.ts";
out.push("== " + mf + "  exists=" + fs.existsSync(mf) + " ==");
if (fs.existsSync(mf)) {
  const a = fs.readFileSync(mf, "utf8").split("\n");
  out.push("  lines=" + a.length);
  out.push("  export surface:");
  for (let i = 0; i < a.length; i++) {
    const t = a[i].trim();
    if (/\bexport\s+(interface|type|const|function|default)\b/.test(t))
      out.push("    " + (i + 1) + "|" + t);
  }
}
out.push("");

const page = "src/app/admin/certificates/new/page.tsx";
out.push("== " + page + " renderer imports ==");
const pb = fs.readFileSync(page, "utf8").split("\n");
for (let i = 0; i < 30 && i < pb.length; i++) if (/renderer|moduleFit|moduleTileFit|textFitting/.test(pb[i])) out.push("    " + (i + 1) + "|" + pb[i]);

fs.writeFileSync("scripts/_fitTruth2.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
