"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("== " + t + " " + f + " ==");
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 54, "moduleFit 1-54");
g("src/lib/renderer/moduleFit.ts", 75, 104, "moduleFit 75-104");
g("src/lib/types.ts", 1, 90, "types 1-90");
g("src/lib/renderer/moduleFit.ts", 1, 54, "dup");
fs.writeFileSync("scripts/_m5.txt", o.join("\n"), "utf8");
console.log("ok");
