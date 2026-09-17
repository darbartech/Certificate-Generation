"use strict";
const fs = require("fs");
const o = [];
const gr = (f, s, e, t) => {
  o.push("==" + t + " " + f);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
gr("src/lib/renderer/moduleFit.ts", 74, 141, "collect body");
gr("src/lib/renderer/moduleFit.ts", 1, 10, "imports");
gr("src/lib/templates/darbartech-certificate-v2.ts", 490, 540, "getTemplateById sig region");
fs.writeFileSync("scripts/_m14.txt", o.join("\n"), "utf8");
console.log("ok");
