"use strict";
const fs = require("fs");
const o = [];
const edit = (f, cbs, tag) => {
  o.push("==" + tag + " " + f + " exists=" + fs.existsSync(f));
  if (!fs.existsSync(f)) { o.push("  MISSING"); return; }
  let s = fs.readFileSync(f, "utf8");
  for (const cb of cbs) {
    const before = s;
    s = cb(s);
    o.push("  " + (s === before ? "NOCHANGE" : "changed") + " " + cb.name);
  }
  fs.writeFileSync(f, s, "utf8");
};
const A = (s) => s.split("CertificateModuleInput").join("CertificateModule");
const B = (s) => s.split("field.transformUppercase || field.uppercase ?").join("field.transformUppercase ?");
const C = (s) => s.split("formData.certificateTemplateId ?? formData.certificateTemplateVersion,").join("formData.certificateTemplateId ?? formData.certificateTemplateVersion ?? \"\",");

edit("src/lib/renderer/moduleFit.ts", [A, B], "moduleFit");
edit("src/app/admin/certificates/new/page.tsx", [C], "page");
fs.writeFileSync("scripts/_fixLog5.txt", o.join("\n"), "utf8");
console.log("done");
