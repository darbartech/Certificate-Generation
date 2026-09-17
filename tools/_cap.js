"use strict";
const fs = require("fs");
const o = [];
const g = (p, s, e) => {
  const f = "src/" + p;
  o.push("== " + f + " ex=" + fs.existsSync(f) + " ==");
  if (!fs.existsSync(f)) return;
  const a = fs.readFileSync(f, "utf8").split("\n");
  for (let i = s - 1; i < e && i < a.length; i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleTileFit.ts"[///cap