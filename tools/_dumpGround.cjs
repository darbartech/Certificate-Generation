const fs = require("fs");
const out = [];

const grab = (file, a, b, label) => {
  const p = "src/" + file;
  if (!fs.existsSync(p)) { out.push("=== " + label + " : MISSING " + p + " ==="); out.push(""); return; }
  const L = fs.readFileSync(p, "utf8").split("\n");
  out.push("=== " + label + " (lines " + a + "-" + b + ", file " + p + ", total " + L.length + ") ===");
  for (let i = a - 1; i < b && i < L.length; i++) out.push((i + 1) + "|" + L[i]);
  out.push("");
};

// 1) admin page imports + guard-related state + quickfill + preview/issue handlers
grab("app/admin/certificates/new/page.tsx", 1, 75, "IMPORTS + EXACT consts");
grab("app/admin/certificates/new/page.tsx", 255, 425, "QUICKFILL→GUARD→PREVIEW/ISSUE");
grab("app/admin/certificates/new/page.tsx", 700, 815, "COURSE SELECT MAPPING + UI issues block");

// 2) renderer fit entry (the authoritative math the guard must mirror)
grab("lib/renderer/textFitting.ts", 108, 165, "fitTextToField FULL");
grab("lib/renderer/moduleFit.ts", 1, 99999, "moduleFit.ts FULL");

fs.writeFileSync("scripts/_groundFull.txt", out.join("\n"), "utf8");
console.log("dumped ok lines=" + out.length);
