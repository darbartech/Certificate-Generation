"use strict";
const fs = require("fs");
const o = [];
const g = (p, s, e, t) => {
  const f = "src/" + p;
  o.push("== " + t + " " + f + " ex=" + fs.existsSync(f) + " ==");
  if (!fs.existsSync(f)) return;
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < e && i < a.length; i++) o.push((i + 1) + "|" + a[i]);
};
g("lib/types.ts", 1, 3, "t");
g("lib/types/certificate.ts", 12, 30, "cert");
g("lib/types/certificate.ts", 1, 8, "cert0");
g("lib/renderer/moduleFit.ts", 1, 60, "fitTop");
g("lib/renderer/moduleFit.ts", 100, 122, "fitEnd");
g("lib/templates/index.ts", 1, 40, "tplIdx");
fs.writeFileSync("scripts/_t4.txt", o.join("\n"), "utf8");
console.log("ok");
