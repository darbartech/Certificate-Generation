"use strict";
const fs = require("fs");
const r = (p, from, to, tag) => {
  const s = fs.readFileSync(p, "utf8");
  if (!s.includes(from)) throw new Error(tag + " anchor missing: " + JSON.stringify(from.slice(0, 60)));
  const n = s.split(from).join(to);
  fs.writeFileSync(p, n, "utf8");
  return "OK " + tag;
};
const o = [];
o.push(r("src/lib/renderer/moduleFit.ts",
  "CertificateModuleInput }",
  "CertificateModule }", "A-import"));
o.push(r("src/lib/renderer/moduleFit.ts",
  "CertificateModuleInput[]",
  "CertificateModule[]", "B-param"));
o.push(r("src/lib/renderer/moduleFit.ts",
  "  field.transformUppercase || field.uppercase ? text.toUpperCase() : text;",
  "  field.transformUppercase ? text.toUpperCase() : text;", "C-uppercase"));
o.push(r("src/app/admin/certificates/new/page.tsx",
  "        formData.certificateTemplateId ?? formData.certificateTemplateVersion,\n",
  "        formData.certificateTemplateId ?? formData.certificateTemplateVersion ?? \"\",\n", "D-tsv"));
fs.writeFileSync("scripts/_fixLog4.txt", o.join("\n"), "utf8");
console.log("done");
