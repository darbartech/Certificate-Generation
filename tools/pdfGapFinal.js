const fs = require("fs");
const zlib = require("zlib");

const out = [];
const MM = 72 / 25.4;
const mm = (pt) => (pt / MM).toFixed(2);
const targets = [
  { label: "REFERENCE  Certificate of Aayara final.pdf", path: "C:/Users/Nepal/Desktop/DarbarTech/Student/Certificate of Aayara final.pdf" },
  { label: "GEN  TESTING1.pdf", path: "C:/Users/Nepal/Downloads/TESTING1.pdf" },
  { label: "GEN  testing2.pdf", path: "C:/Users/Nepal/Downloads/testing2.pdf" },
];

function decode(c, dict) {
  // dict includes /Filter /FlateDecode etc
  let d = c;
  if (/\/FlateDecode/.test(dict)) {
    try { d = zlib.inflateSync(d); }
    catch { try { d = zlib.inflateRawSync(d); } catch {} }
  }
  return d;
}

for (const t of targets) {
  out.push("############################################################");
  out.push("## " + t.label);
  out.push("## " + t.path + "  exists=" + fs.existsSync(t.path));
  out.push("############################################################");
  if (!fs.existsSync(t.path)) { out.push("  [MISSING]"); out.push(""); continue; }
  const buf = fs.readFileSync(t.path);
  const lat = buf.toString("latin1");
  // page box
  const mb = /\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/.exec(lat);
  if (mb) {
    out.push("  MediaBox " + mb[1] + " " + mb[2] + " " + mb[3] + " " + mb[4] + "  => " + mm(+mb[3] - +mb[1]) + " x " + mm(+mb[4] - +mb[2]) + "mm");
  }
  // fonts resources: /Font << /F1 5 0 R /F2 6 0 R ... >>
  const fr = /\/Font\s*<<\s*([\s\S]*?)\s*>>/.exec(lat);
  const fontMap = {};
  if (fr) {
    for (const m of fr[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) fontMap[m[1]] = m[2];
    out.push("  fonts=" + Object.keys(fontMap).length + "  " + JSON.stringify(fontMap));
  }
  // images
  const imgList = [];
  const xoRe = /\/XObject\s*<<\s*([\s\S]*?)\s*>>/g;
  let xo;
  while ((xo = xoRe.exec(lat)) !== null) {
    for (const m of xo[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
      const fav = new RegExp(m[2] + "\\s+\\d+\\s+obj([\\s\\S]*?)endobj");
      const f = fav.exec(lat);
      if (f && /\/Image/.test(f[1])) {
        const w = +(/\/(?:Width)\s+(\d+)/.exec(f[1]) || [0, 0])[1];
        const h = +(/\/(?:Height)\s+(\d+)/.exec(f[1]) || [0, 0])[1];
        const bpc = +(/\/(?:BitsPerComponent)\s+(\d+)/.exec(f[1]) || [0, 0])[1];
        const cs = (/\/(?:ColorSpace)\s*\/(?:\w+\s+)?(\w+)/.exec(f[1]) || [0, "?"])[1];
        const flt = (/\/(?:Filter)\s*\/(FlateDecode|DCTDecode|ASCIIHexDecode)/.exec(f[1]) || [0, "?"])[1];
        imgList.push({ name: m[1], w, h, bpc, cs, flt });
      }
    }
  }
  out.push("  images=" + imgList.length);
  for (const im of imgList)
    out.push("    /" + im.name + "  " + im.w + "x" + im.h + "px  " + im.bpc + "bpc  " + im.cs + "  flt=" + im.flt);

  // content streams — decode and scan BT/ET for positioned text
  const streams = [];
  const stRe = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let stm;
  while ((stm = stRe.exec(lat)) !== null && streams.length < 50) {
    let raw = Buffer.from(stm[1], "latin1");
    try { raw = zlib.inflateSync(raw); } catch (e) { try { raw = zlib.inflateRawSync(raw); } catch (e2) {} }
    streams.push(raw.toString("latin1"));
  }
  const runs = [];
  const fonts = {};
  for (const s of streams) {
    let curFont = "?", curSize = 0;
    // BT blocks
    const bts = [...s.matchAll(/BT\s*([\s\S]*?)\s*ET/g)];
    for (const bt of bts) {
      const blk = bt[1];
      const tf = /\/(\w+)\s+([\d.\-]+)\s+Tf/.exec(blk);
      if (tf) { curFont = tf[1]; curSize = +tf[2]; }
      // get current Tm position
      const tms = [...blk.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*Tm/g)];
      let x = 0, y = 0;
      if (tms.length) { x = +tms[tms.length - 1][5]; y = +tms[tms.length - 1][6]; }
      // Td
      for (const td of blk.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+Td/g)) { x += +td[1]; y += +td[2]; }
      // Tj and TJ
      for (const m0 of blk.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) {
        const txt = m0[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
        runs.push({ x: +x.toFixed(1), y: +y.toFixed(1), f: curFont, sz: curSize, txt });
        const k = "/" + curFont + " " + curSize + "pt";
        fonts[k] = (fonts[k] || 0) + 1;
      }
      for (const m0 of blk.matchAll(/\[((?:[^\[\]]|\[(?:[^\[\]]*)\])*)\]\s*TJ/g)) {
        const parts = [...m0[1].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)];
        const txt = parts.map((p) => p[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")")).join("");
        runs.push({ x: +x.toFixed(1), y: +y.toFixed(1), f: curFont, sz: curSize, txt });
        const k = "/" + curFont + " " + curSize + "pt";
        fonts[k] = (fonts[k] || 0) + 1;
      }
    }
  }
  out.push("  textRuns(pt-space x,y | font size | text) — first 44 —");
  const sorted = runs.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  for (let i = 0; i < Math.min(44, sorted.length); i++) {
    const r = sorted[i];
    out.push("    x=" + r.x + " y=" + r.y + " | " + r.f + " " + r.sz + "pt | " + r.txt.slice(0, 42));
  }
  out.push("");
  out.push("  font/size counts:");
  for (const [k, v] of Object.entries(fonts)) out.push("    " + k + " x" + v);
  out.push("");
}

fs.writeFileSync("scripts/_pdfGapFinal.txt", out.join("\n"), "utf8");
console.log("wrote " + out.join("\n").length);
