"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 3, "imp");
g("src/lib/types.ts", 40, 85, "types 40-85");
g("src/lib/templates/index.ts", 1, 4, "tplidx");
g("src/app/admin/certificates/new/page.tsx", 1, 13, "page imp");
g("src/app/admin/certificates/new/page.tsx", 56, 64, "page modules state");
fs.writeFileSync("scripts/_m10.txt", o.join("\n"), "utf8");
console.log("ok");
