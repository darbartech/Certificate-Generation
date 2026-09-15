"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 3, "mFit import");
g("src/lib/renderer/moduleFit.ts", 48, 50, "mFit transform");
g("src/lib/templates/index.ts", 1, 6, "tpl idx 1-6");
g("src/lib/templates/index.ts", 40, 55, "tpl idx 40-55");
g("src/app/admin/certificates/new/page.tsx", 40, 60, "page state 40-60");
fs.writeFileSync("scripts/_m8.txt", o.join("\n"), "utf8");
console.log("ok");
