"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 48, 51, "mFit 48-51");
g("src/lib/renderer/moduleFit.ts", 75, 80, "mFit 75-80");
g("src/lib/types.ts", 1, 40, "types 1-40");
g("src/lib/templates/darbartech-certificate-v2.ts", 1, 4, "v2 tpl 1-4");
g("src/lib/templates/index.ts", 1, 40, "tpl index 1-40");
fs.writeFileSync("scripts/_m6.txt", o.join("\n"), "utf8");
console.log("ok");
