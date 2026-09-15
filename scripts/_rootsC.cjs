"use strict";
const fs = require("fs");
const o = [];
const W = "C:/Users/Nepal/Downloads/DarbarTech_Programmable_Certificate_System_Documentation";
const roots = [];
const walk = (d) => {
  let ok = true;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
    const p = d + "/" + e.name;
    if (e.isDirectory()) { if (fs.existsSync(p + "/package.json") && fs.existsSync(p + "/src")) roots.push(p); walk(p); }
  }
};
try { walk("C:/Users/Nepal/Downloads"); } catch (e) { o.push("walk err " + e.message); }
o.push("found roots:");
for (const r of roots) o.push("  " + r);
fs.writeFileSync("scripts/_rootsC.txt", o.join("\n"), "utf8");
console.log("roots written");
