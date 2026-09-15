const fs = require("fs");
const { PDFDocument } = require("pdf-lib");

const TARGETS = [
  { label: "REFERENCE  Certificate of Aayara final.pdf", path: "C:/Users/Nepal/Desktop/DarbarTech/Student/Certificate of Aayara final.pdf" },
  { label: "TESTING.pdf (Downloads)", path: "C:/Users/Nepal/Downloads/TESTING.pdf" },
  { label: "testing2.pdf (Downloads)", path: "C:/Users/Nepal/Downloads/testing2.pdf" },
  { label: "out/aayara-reference-test.pdf (repo out)", path: "out/aayara-reference-test.pdf" },
];

const out = [];
const mm = (pt) => (pt / 72 * 25.4).toFixed(2);

(async () => {
  for (const t of TARGETS) {
    out.push("############################################################");
    out.push("## " + t.label);
    out.push("## " + t.path + "  exists=" + fs.existsSync(t.path));
    out.push("############################################################");
    if (!fs.existsSync(t.path)) { out.push("  (skip — not present)"); out.push(""); continue; }
    try {
      const bytes = fs.readFileSync(t.path);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      const pages = doc.getPages();
      out.push("pages=" + pages.length + "  rawBytes=" + bytes.length + "  producer=" + (doc.getProducer ? doc.getProducer() : "?"));
      for (let p = 0; p < Math.min(pages.length, 12); p++) {
        const page = pages[p];
        const size = page.getSize();
        out.push("");
        out.push("--- Page " + (p + 1) + "  size=" + size.width.toFixed(1) + "x" + size.height.toFixed(1) + "pt  (~" + mm(size.width) + " x " + mm(size.height) + " mm)  rotate=" + (page.getRotation().angle || 0));
        let node = page.node;
        let content = "";
        try {
          const cs = node.Contents();
          content = cs ? cs.decodeIntoString() : "";
        } catch (e) {
          content = "(content parse error: " + (e && e.message ? e.message : e) + ")";
        }
        if (!content) content = "(empty content stream)";
        // text runs: Tf (font,size), positioned text via Td/Tm/Tj/TJ in BT..ET
        const btBlocks = content.match(/BT[\s\S]*?ET/g) || [];
        let runs = [];
        for (const blk of btBlocks) {
          let font = "?", size = 0;
          const tf = blk.match(/\/(\S+)\s+([\d.]+)\s+Tf/);
          if (tf) { font = tf[1]; size = parseFloat(tf[2]); }
          const tm = blk.match(/\[?[^%]*?cm|\d[\d.]*\s+0\s+0\s+[\d.]*\s+([\d.-]+)\s+([\d.-]+)\s*Tm/);
          let tx = 0, ty = 0;
          const tmAll = [...blk.matchAll(/([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*Tm/g)];
          if (tmAll.length) { tx = parseFloat(tmAll[tmAll.length - 1][5]); ty = parseFloat(tmAll[tmAll.length - 1][6]); }
          const tdAll = [...blk.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)\s+Td/g)];
          // strings
          const strs = [...blk.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj|\[(.*?)\]\s*TJ/g)];
          for (const st of strs) {
            let txt = "";
            if (st[1] !== undefined) txt = st[1];
            else if (st[2] !== undefined) {
              txt = (st[2].match(/\(((?:[^()\\]|\\.)*)\)/g) || []).map((s) => s.replace(/^\(/,"").replace(/\)$/,"")).join("");
            }
            runs.push({ font, size, tx, ty, txt: txt.replace(/\\\(/g,"(").replace(/\\\)/g,")").slice(0, 60) });
          }
        }
        // images with cm placement + Do
        const imgOps = [];
        const res = node.Resources ? node.Resources() : null;
        let xobj = null;
        if (res) { try { xobj = res.lookupMaybe("XObject"); } catch(e){} }
        const doCm = [...content.matchAll(/([\d.]+)\s+0\s+0\s+([\d.]+)\s+([\d.-]+)\s+([\d.-]+)\s+cm\s*\/I(\w+)\s+Do/g)];
        for (const c of doCm) {
          const w = parseFloat(c[1]), h = parseFloat(c[2]);
          imgOps.push({ w, h, x: parseFloat(c[3]), y: parseFloat(c[4]), name: c[5], mmW: mm(w), mmH: mm(h) });
        }
        const allImages = [...content.matchAll(/\/I(\w+)\s+[\d.]*\s*Do/g)];
        out.push("  BT-blocks=" + btBlocks.length + "  text-runs=" + runs.length + "  Do-images(placed)=" + imgOps.length + "  Do-mentions=" + allImages.length);
        // unique font sizes
        const sizes = {};
        for (const r of runs) sizes[r.font + " | " + r.size + "pt"] = (sizes[r.font + " | " + r.size + "pt"] || 0) + 1;
        out.push("  fonts/sizes:");
        for (const [k, v] of Object.entries(sizes)) out.push("    " + k + "  x" + v);
        out.push("  placed images:");
        for (const im of imgOps) out.push("    img/" + im.name + "  " + im.mmW + "mm x " + im.mmH + "mm @ (" + im.x.toFixed(1) + "," + im.y.toFixed(1) + ")pt");
        out.push("  first up-to-14 text runs:");
        for (const r of runs.slice(0, 14)) out.push("    [" + r.font + " " + r.size + "pt] (" + r.tx.toFixed(1) + "," + r.ty.toFixed(1) + ")  \"" + r.txt + "\"");
        // raw tail for diagnosis
        const tail = content.replace(/\s+/g, " ").slice(-2600);
        out.push("  [raw content tail] " + tail);
      }
    } catch (e) {
      out.push("  LOAD ERROR: " + (e && e.message ? e.message : e));
    }
    out.push("");
  }
  fs.writeFileSync("scripts/_pdfgap.txt", out.join("\n"), "utf8");
  console.log("wrote " + out.length);
})();
