"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t + " " + f + " ==");
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 1, 141, "moduleFit FULL");
o.push("");
o.push("== page imports 1-14 ==");
o.push("MISSING-channel");
fs.writeFileSync("scripts/_m9.txt", o.join("\n"), "utf8");
console.log("ok");
