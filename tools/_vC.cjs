"use strict";
var fs = require("fs");
var o = [];
var g = function (f, s, e, t) {
  o.push("==" + t);
  if (!fs.existsSync(f)) { o.push("MISSING"); return; }
  var a = fs.readFileSync(f, "utf8").split("\n");
  for (var i = s - 1; i < Math.min(e, a.length); i++) o.push((i + 1) + "|" + a[i]);
};
g("src/lib/renderer/moduleFit.ts", 47, 50, "mFit 47-50");
g("src/lib/renderer/moduleFit.ts", 1, 3, "mFit 1-3");
g("src/app/admin/certificates/new/page.tsx", 264, 282, "page 264-282");
fs.writeFileSync("scripts/_vC.txt", o.join("\n"), "utf8");
console.log("doneC");
