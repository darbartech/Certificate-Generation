"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/templates/darbartech-certificate-v2.ts", 226, 300, "v2 tail 226-300");
g("src/lib/templates/darbartech-certificate-v2.ts", 320, 420, "v2 320-420");
fs.writeFileSync("scripts/_m12.txt", o.join("\n"), "utf8");
console.log("ok");
