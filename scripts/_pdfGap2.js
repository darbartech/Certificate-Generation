"use strict";
const fs = require("fs");
const PDFDocument = require("pdf-lib").PDFDocument;
const zlib = require("zlib");

const MM = 2.834645669;
const mm = (pt) => (pt / MM).toFixed(2);

const targets = [
  { label: "REFERENCE  Certificate of Aayara final.pdf  (Desktop/DarbarTech/Student)", path: "C:/Users/Nepal/Desktop/DarbarTech/Student/Certificate of Aayara final.pdf" },
  { label: "TESTING1  (Downloads)", path: "C:/Users/Nepal/Downloads/TESTING1.pdf" },
  { label: "testing2  (Downloads)", path: "C:/Users/Nepal/Downloads/testing2.pdf" },
  { label: "out/aayara-reference-test.pdf  (repo)", path: "out/aayara-reference-test.pdf" },
];

const out = [];

// extract raw streams (uncompressed or flate) from a PDF byte buffer
function getStreams(buf) {
  const b = buf.toString("latin1");
  const streams = [];
  const re = /(?:stream)\r?\n([\s\S]*?)\r?\n?endstream/g;
  let m;
  while ((m = re.exec(b)) !== null) streams.push({ raw: m[1], hex: m[1] });
  return streams;
}

function parsePDF(path, label) {
  out.push("########################################################");
  out.push("## " + label);
  out.push("## " + path + "  exists=" + fs.existsSync(path));
  out.push("########################################################");
  if (!fs.existsSync(path)) { out.push("  [MISSING]"); out.push(""); return; }
  const buf = fs.readFileSync(path);
  const ascii = buf.toString("latin1");
  const producer = (/\/(Producer)\s*\(([^)]*)\)/.exec(ascii) || [0, 0, "?"])[2];
  out.push("  size=" + buf.length + "B  producer=" + producerYear);

  let doc;
  try { doc = PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false }); }
  catch (e) { out.push("  [pdf-lib load fail] " + (e && e.message)); out.push(""); return; }
  out.push("  pages=" + doc.getPageCount());
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    const sz = pg.getSize();
    out.push("    page" + (i + 1) + " = " + sz.width.toFixed(1) + "x" + sz.height.toFixed(1) + "pt  (" + mm(sz.width) + " x " + mm(sz.height) + " mm)  rotate=" + pg.getRotation().angle);
  }

  // images: scan raw XObject dicts
  const objs = {};
  let m;
  const objRe = /(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g;
  while ((m = objRe.exec(ascii)) !== null) objs[m[1]] = m[2];

  // find image XObjects: /Im<ListN> W H BPC CS SMask
  const imgList = [];
  const xoRe = /\/XObject\s*<<([\s\S]*?)>>/g;
  while ((m = xoRe.exec(ascii)) !== null) {
    for (const mm of m[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
      const dict = objs[mm[2]] || "";
      if (/\/Subtype\s*\/Image/.test(dict)) {
        const w = +(/(?:^|\/)\s*Width\s+(\d+)/.exec(dict) || [0, 0])[1];
        const h = +(/(?:^|\/)\s*Height\s+(\d+)/.exec(dict) || [0, 0])[1];
        const bpc = +(/(?:^|\/)\s*BitsPerComponent\s+(\d+)/.exec(dict) || [0, 0])[1];
        const cs = (/\/(?:ColorSpace)\s*\/(\w+)/.exec(dict) || [0, "?"])[1];
        const fl = (/\/(?:Filter)\s*\/(\w+)/.exec(dict) || [0, "?"])[1];
        imgList.push({ ref: mm[2], name: mm[1], w, h, bpc, cs, fl });
      }
    }
  }
  out.push("  images=" + imgList.length);
  for (const im of imgList) {
    out.push("    /" + im.name + " (" + im.ref + ")  " + im.w + "x" + im.h + "px  " + im.bpc + "bpc  " + im.cs + "  flt=" + im.fl);
  }

  // fonts
  const fonts = {};
  const fRe = /\/([A-Za-z0-9\-]+)\s+([\d.]+)\s+Tf/g;
  while ((m = fRe.exec(ascii)) !== null) {
    fonts[m[1] + " " + m[2] + "pt"] = (fonts[m[1] + " " + m[2] + "pt"] || 0) + 1;
  }
  out.push("  fonts (name size = count):");
  for (const [k, v] of Object.entries(fonts)) out.push("    " + k + "  x" + v);
  out.push("");
}

for (const t of targets) parsePDF(t.path, t.label争夺);

fs.writeFileSync("scripts/_pdfGapOut.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
