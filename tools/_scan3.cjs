"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING " + f); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 4, "mFit 1-4");
g("src/lib/renderer/moduleFit.ts", 74, 81, "mFit 74-81");
g("src/lib/renderer/moduleFit.ts", 44, 55, "mFit 44-55");
g("src/app/admin/certificates/new/page.tsx", 264, 292, "page 264-292");
fs.writeFileSync("scripts/_scan3.txt", o.join("\n"), "utf8");
console.log("scan3 done");
