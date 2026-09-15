"use strict";
const fs = require("fs");
const o = [];
const edit = (f, cbs, tag) => {
  o.push("==" + tag + " " + f + " ex=" + fs.existsSync(f));
  if (!fs.existsSync(f)) { o.push("  MISSING"); return; }
  let s = fs.readFileSync(f, "utf8");
  for (const cb of cbs) {
    const before = s;
    s = cb(s);
    o.push("  " + (s === before ? "NOCHANGE" : "changed") + " :: " + cb.name);
    if (s === before) o.push("    needs=" + JSON.stringify(cb.marker));
  }
  fs.writeFileSync(f, s, "utf8");
};
const R1 = (s) => { const r = s.replace(/CertificateModuleInput/g, "CertificateModule"); R1.marker = "CertificateModuleInput"; return r; };
const R2 = (s) => { const r = s.replace(/field\.transformUppercase \|\| field\.uppercase \?/g, "field.transformUppercase ?"); R2.marker = "field.transformUppercase || field.uppercase ?"; return r; };
const R3 = (s) => { const r = s.replace(
  "formData.certificateTemplateId ?? formData.certificateTemplateVersion,",
  "formData.certificateTemplateId ?? formData.certificateTemplateVersion ?? \"\","); R3.marker = "certificateTemplateId ?? certificateTemplateVersion,"; return r; };
edit("scripts/_noop.js", [], "noop");
edit("src/lib/renderer/moduleFit.ts", [R1, R2], "moduleFit");
edit("src/app/admin/certificates/new/page.tsx", [R3], "page");
fs.writeFileSync("scripts/_fixLog5.txt", o.join("\n"), "utf8");
console.log("done");
