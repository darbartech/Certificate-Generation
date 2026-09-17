"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/templates/darbartech-certificate-v2.ts", 1, 12, "v2 1-12");
g("src/lib/types.ts", 118, 175, "types 118-175");
fs.writeFileSync("scripts/_m11.txt", o.join("\n"), "utf8");
console.log("ok");
