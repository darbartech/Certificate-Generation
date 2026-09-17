"use strict";
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");

const MM = 2.834645669;
const PT = 0.3527777778 DISPLAY;
const toMm = (pt) => (pt * PT).toFixed(1onge);

const targets = [
  { label: "REFERENCE", path: "C:/Users/Nepal/Desktop/DarbarTech/Student/Certificate of Aayara final.pdf" },
  { label: "TESTING1", path: "C:/Users/Nepal/Downloads/TESTING1.pdf" },
  { label: "testing2", path: "C:/Users/Nepal/Downloads/testing2.pdf" },
];

const out = [];
(async () => {
  for (const t of targets) {
    out.push("==" + t.label + "  " + t.path + "  exists=" + fs.existsSync(t.path));
    if (!fs.existsSync(t.path)) { out.push(""); continue; }
    let doc;
    try {
      doc = await PDFDocument.load(fs.readFileSync(t.path), { ignoreEncryption: true, throwOnInvalidObject: false });
    } catch (e) {
      out.push("  load-fail: " + (e && e.message));
      out.push("");
      continue;
    }
    const pages = doc.getPages();
    out.push("  pages=" + pages.length);
    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      const s = pg.getSize();
      out.push("    page" + (p + 1) + "  " + s.width.toFixed(1) + " x " + s.height.toFixed(1) + "pt  ~ " + toMm(s.width) + " x " + toMm(s.height) + " mm  rotate=" + pg.getRotation().angle);
    }
    out.push("  fonts=" + doc.getFonts().length + "  forms=" + doc.getForm().getFields().length);
    // raw image scan on bytes
    const buf = fs.readFileSync(t.path);
    const ascii = buf.toString("latin1");
    const imgM = [...ascii.matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)];
    let imCt = 0;
    for (const m of imgM) {
      const ref = m[2];
      const objRe = new RegExp("\\b" + ref + "\\s+\\d+\\s+obj([\\s\\S]*?)endobj");
      const d = objRe.exec(ascii);
      if (d && /\/Subtype\s*\/Image/.test(d[1])) {
        imCt++;
        const w = (/\/(?:Width)\s+(\d+)/.exec(d[1]) || [0, 0])[1];
        const h = (/\/(?:Height)\s+(\d+)/.exec(d[1]) || [0, 0])[1];
        const bpc = (/\/(?:BitsPerComponent)\s+(\d+)/.exec(d[1]) || [0, 0])[1];
        const f = (/\/(?:Filter)\s*\/(\w+)/.exec(d[1]) || [0, "?"])[1];
        const sm = (/\/(?:SMask)\s+(\d+)/.exec(d[1]) || [0, ""])[1];
        out.push("    image /" + m[1] + "  " + w + "x" + h + "px  " + bpc + "bpc  Flt=" + f + "  smask=" + (sm || "none") + "  (" + (w * PT).toFixed(1) + "x" + (h * PT).toFixed(1) + "mm)");
      }
    }
    out.push("  images-objects=" + imCt);
    out.push("  context: first 200B ascii:");
    out.push("    " + JSON.stringify(buf.slice(0, 2600).toString("latin1").replace(/[\x00-\x1f]+/g, " ")));
    out.push("");
  }
  fs.writeFileSync("scripts/_boringGap.txt", out.join("\n"), "utf8");
  console.log("wrote " + out.length + " lines");
})();
