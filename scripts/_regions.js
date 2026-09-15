"use strict";
const fs = require("fs");
const out = [];
const g = (f, s, e) => {
  if (!fs.existsSync(f)) { out.push(f + " MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  out.push("== " + f + "  lines=" + a.length + " ==");
  for (let i = Math.max(0, s - 1); i < Math.min(e, a.length); i++)
    out.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 10);
g("src/lib/renderer/moduleFit.ts", 40, 75);
g("src/app/admin/certificates/new/page.tsx", 262, 285);
fs.writeFileSync("scripts/_regions.txt", out.join("\n"), "utf8");
console.log("wrote");
