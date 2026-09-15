"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t + " " + f + " ex=" + fs.existsSync(f));
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 2, "imp");
g("src/lib/renderer/moduleFit.ts", 44, 52, "u258");
g("src/lib/renderer/moduleFit.ts", 74, 82, "sig");
g("src/lib/renderer/moduleFit.ts", 138, 141, "tail");
g("src/app/admin/certificates/new/page.tsx", 264, 278, "tplcall");
g("src/lib/types.ts", 11, 16, "modtype");
fs.writeFileSync("scripts/_gt3.txt", o.join("\n"), "utf8");
console.log("wrote " + o.length);
