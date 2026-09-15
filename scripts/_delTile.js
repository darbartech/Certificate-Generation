"use strict";
const fs = require("fs");
const paths = [
  "src/lib/renderer/moduleTileFit.ts",
  "src/lib/renderer/moduleTileFit.js",
];
const out = [];
for (const p of paths) {
  const ex = fs.existsSync(p);
  if (ex) {
    fs.unlinkSync(p);
    out.push("DELETED " + p);
  } else {
    out.push("absent  " + p);
  }
}
fs.writeFileSync("scripts/_delLog.txt", out.join("\n"), "utf8");
console.log(out.join("\n"));
