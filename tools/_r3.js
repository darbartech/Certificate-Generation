"use strict";
const fs = require("fs");
const o = [];
const g = (p, s, e, t) => {
  const f = fs.existsSync(p);
  o.push("== " + t + " " + p + " ex=" + f + " ==");
  if (!f) return;
  const a = fs.readFileSync(p, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 3, "imports");
g("src/lib/renderer/moduleFit.ts", 44, 62, "moduleFit-mid");
g("src/lib/types.ts", 0, 0, "types-index");
g("src/lib/renderer/moduleFit.ts", 105, 141, "moduleFit-tail");
g("src/app/admin/certificates/new/page.tsx", 258, 300, "page-gen");
fs.writeFileSync("scripts/_r3.txt", o.join("\n"), "utf8");
console.log("ok");
