"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 5, "mFit 1-5");
g("src/lib/renderer/moduleFit.ts", 74, 105, "mFit 74-105");
g("src/app/admin/certificates/new/page.tsx", 260, 290, "page 260-290");
fs.writeFileSync("scripts/_m7.txt", o.join("\n"), "utf8");
console.log("ok");
