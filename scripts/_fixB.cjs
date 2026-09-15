"use strict";
const fs = require("fs");
const R = "C:/Users/Nepal/Downloads/DarbarTech_Programmable_Certificate_System_Documentation";
const o = [];
const E = (rel, from, to, id) => {
  const p = R + "/" + rel;
  o.push("==" + id + " " + rel + " ex=" + fs.existsSync(p));
  if (!fs.existsSync(p)) { o.push("  MISSING"); return; }
  let s = fs.readFileSync(p, "utf8");
  const n = s.split(from).length - 1;
  s = s.split(from).join(to);
  fs.writeFileSync(p, s, "utf8");
  o.push("  replaced=" + n + (n === 0 ? "  !!ANCHOR_MISSING" : ""));
};
E("src/lib/renderer/moduleFit.ts", "CertificateModuleInput", "CertificateModule", "e1");
E("src/lib/renderer/moduleFit.ts", "field.transformUppercase || field.uppercase ?", "field.transformUppercase ?", "e2");
E("src/app/admin/certificates/new/page.tsx", "formData.certificateTemplateId ?? formData.certificateTemplateVersion,",
  "formData.certificateTemplateId ?? formData.certificateTemplateVersion ?? \"\",", "e3");
fs.writeFileSync(R + "/scripts/_fixLogB.txt", o.join("\n"), "utf8");
console.log("ok");
