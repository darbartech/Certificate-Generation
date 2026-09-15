"use strict";
const fs = require("fs");
const o = [];
const g = (f, s, e, t) => {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/templates/darbartech-certificate-v2.ts", 1, 20, "v2 head");
g("src/lib/templates/index.ts", 1, 20, "index head");
g("src/lib/types.ts", 90, 135, "types 90-135");
g("src/lib/types.ts", 1, 60, "types 1-60");
fs.writeFileSync("scripts/_m13.txt", o.join("\n"), "utf8");
console.log("ok");
