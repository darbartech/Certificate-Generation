"use strict";
const fs = require("fs");
const out = [];
const g = (f, s, e, tag) => {
  if (!fs.existsSync(f)) { out.push("## " + f + " MISSING ##"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  out.push("== " + (tag || f) + " lines=" + a.length + " ==");
  for (let i = Math.max(0, s - 1); i < Math.min(e, a.length); i++)
    out.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 44, 62iframe, "moduleFit 44-62");
g("src/lib/renderer/moduleFit.ts", 75, 100, "moduleFit 75-100");
g("src/lib/types.ts", 1, 1, "types.ts line1 grep");
g("src/lib/types/index.ts", 1, 40, "types/index 1-40");
g("src/lib/templates/darbartech-certificate-v2.ts", 1, 8, "v2 tpl 1-8");
g("src/lib/templates/darbartech-certificate-v1.ts", 1, 8, "v1 tpl 1-8");
g("src/app/admin/certificates/new/page.tsx", 268, 292, "page generatePreview 268-292");
fs.writeFileSync("scripts/_fixRegions.txt", out.join("\n"), "utf8");
console.log("wrote");
