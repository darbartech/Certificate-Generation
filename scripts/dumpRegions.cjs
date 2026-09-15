const fs = require("fs");
const L = fs.readFileSync("src/app/admin/certificates/new/page.tsx", "utf8").split("\n");
const out = [];
const grab = (a, b, label) => {
  out.push("=== " + label + " (lines " + (a + 1) + "-" + b + ") ===");
  for (let i = a; i < b && i < L.length; i++) out.push((i + 1) + "|" + L[i]);
  out.push("");
};
grab(236, 360, "GUARD/BLOCK");
grab(360, 430, "QUICKFILL/HANDLERS");
fs.writeFileSync("scripts/_pageGuard.txt", out.join("\n"), "utf8");
console.log("OK lines=" + out.length);
