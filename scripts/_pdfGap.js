"use strict";
const fs = require("fs");
const zlib = require("zlib");

const MM = 2.834645669; // pt per mm
const out = [];
const toMM = (pt) => (pt / MM).toFixed(2onge);

const inflateBlob = (buf) => {
  try { return { s: buf, d: zlib.inflateSync(buf) }; }
  catch (e) { try { return { s: buf, d: zlib.inflateRawSync(buf) }; } catch (e2) { return { s: buf, d: null }; } }
};

// find all streams (raw), inflate, return {raw, decoded}
function getStreams(buf) {
  const b = buf;
  const streams = [];
  const starts = [];
  for (let i = 0; i < b.length - 6; ++i) {
    if (b[i] === 0x73 && b[i + 1] === 0x74 && b[i + 2] === 0x72 && b[i + 3] === 0x65 && b[i + 4] === 0x61 && b[i + 5] === 0x6d) {
      const sIdx = i + 6;
      let eIdx = -1;
      for (let j = sIdx; j < b.length - 9; ++j) {
        if (b[j] === 0x65 && b[j + 1] === 0x6e && b[j + 2] === 0x64 && b[j + 3] === 0x73 && b[j + 4] === 0x74 && b[j + 5] === 0x72 && b[j + 6] === 0x65 && b[j + 7] === 0x61 && b[j + 8] === 0x6d) { eIdx = j; break; }
      }
      if (eIdx > sIdx) {
        let d = b.slice(sIdx, eIdx);
        if (d.length > 2 && d[0] === 0x0d && d[1] === 0x0a) d = d.slice(2);
        else if (d.length > 1 && d[0] === 0x0a) d = d.slice(1);
        while (d.length && (d[d.length - 1] === 0x0a || d[d.length - 1] === 0x0d)) d = d.slice(0, -1);
        streams.push(d);
        i = eIdx + 8;
      }
    }
  }
  return streams.map((d) => inflateBlob(d));
}

const TARGETS = require("./_gapTargets.js");

for (const t of TARGETS) {
  out.push("");
  out.push("############################################################");
  out.push("## " + t.label);
  out.push("## " + t.path + "   exists=" + fs.existsSync(t.path) + "  size=" + (fs.existsSync(t.path) ? fs.statSync(t.path).size + "B" : "?"));
  out.push("############################################################");
  if (!fs.existsSync(t.path)) { out.push("  [MISSING]"); continue; }
  const buf = fs.readFileSync(t.path);
  const ascii = buf.toString("latin1");

  const pageW = [], pageH = [], rot = [];
  const mbRe = /\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/g;
  let m;
  while ((m = mbRe.exec(ascii)) !== null) {
    pageW.push(+m[3] - +m[1]);
    pageH.push(+m[4] - +m[2]);
  }
  const rRe = /\/Rotate\s+(\d+)/g;
  while ((m = rRe.exec(ascii)) !== null) rot.push(+m[1]);
  const media = pageW.length ? pageW[0] : 0, meH = pageH.length ? pageH[0] : 0;
  const pageCount = pageW.length;
  out.push("  pages=" + pageCount + "  page0=" + media.toFixed(1) + "x" + meH.toFixed(1) + "pt  (" + toMM(media) + " x " + toMM(meH) + " mm)  rotate0=" + (rot[0] || 0));
  const prod = (/\/Producer\s*\(([^)]*)\)/.exec(ascii) || [0, "?"])[1];
  const creator = (/\/Creator\s*\(([^)]*)\)/.exec(ascii) || [0, "?"])[1];
  const fonts = (/\/Font\s+(\d+)\s+\d+\s+R/.exec(ascii) || [0, "?"])[1];

  // images: XObject dicts /ImN W/H/BPC/CS
  const imgInfo = {};
  const xoRe = /\/XObject\s*<<([\s\S]*?)>>/g;
  while ((m = xoRe.exec(ascii)) !== null) {
    for (const mm0 of m[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
      const name = mm0[1], ref = mm0[2];
      const objRe = new RegExp(ref + "\\s+\\d+\\s+obj([\\s\\S]*?)endobj");
      const od = objRe.exec(ascii) || [0, ""];
      if (/\/Subtype\s*\/Image/.test(od[1])) {
        imgInfo[name] = {
          w: +(/\/(Width)\s+(\d+)/.exec(od[1]) || [0, 0, 0])[2],
          h: +(/\/(Height)\s+(\d+)/.exec(od[1]) || [0, 0, 0])[2],
          bpc: +(/\/(BitsPerComponent)\s+(\d+)/.exec(od[1]) || [0, 0, 0])[2],
          cs: (/\/(ColorSpace)\s*\/(\w+)/.exec(od[1]) || [0, "?"])[2],
        };
      }
    }
  }

  const runs = [];
  const imgs = [];
  const streams = getStreams(buf);
  for (const st of streams) {
    if (!st.d) continue;
    const s = st.d.toString("latin1");
    // --- text ---
    let font = "?", size = 0;
    const tf0 = /\/([A-Za-z0-9\-]+)\s+([\d.\-]+)\s+Tf/.exec(s);
    if (tf0) { font = tf0[1]; size = +tf0[2]; }
    const btRe = /BT\b([\s\S]*?)\bET/g;
    let bm;
    while ((bm = btRe.exec(s)) !== null) {
      let bx = 0, by = 0;
      const tm0 = /(?:[\d.\-]+\s+){4}([\d.\-]+)\s+([\d.\-]+)\s*Tm/.exec(bm[1]);
      if (tm0) { bx = +tm0[1]; by = +tm0[2]; }
      const td0 = [...bm[1].matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+Td/g)];
      for (const td of td0) { bx += +td[1]; by += +td[2]; }
      const tj0 = [...bm[1].matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj|\[([\s\S]*?)\]\s*TJ/g)];
      for (const tj of tj0) {
        let txt = "";
        if (tj[1] !== undefined) txt = tj[1];
        else if (tj[2] !== undefined) {
          const pieces = [...tj[2].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)];
          txt = pieces.map((p) => p[1]).join("");
        }
        txt = txt.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\n/g, "").replace(/\\\d+\)/, "");
        runs.push({ f: font, sz: size, x: +bx.toFixed(1), y: +by.toFixed(1), t: txt });
        bx += size; // rough
      }
    }
    // --- images ---
    const cmRe = /([\d.\-]+)\s+0\s+0\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+cm\s*\/(\w+)\s+Do/g;
    let c;
    while ((c = cmRe.exec(s)) !== null) {
      const w = +c[1], h = +c[2], x = +c[3], y = +c[4];
      const info = imgInfo[c[5]] || {};
      imgs.push({ name: c[5], w, h, x, y, px: info.w, py: info.h, bpc: info.bpc, cs: info.cs });
    }
  }
  out.push("  textRuns=" + runs.length + "  placedImages=" + imgs.length);
  out.push("  ---- fonts (name size = count) (from decoded streams) ----");
  const fsM = {};
  for (const r of runs) { const k = r.f + " " + r.sz.toFixed(1) + "pt"; fsM[k] = (fsM[k] || 0) + 1; }
  for (const [k, v] of Object.entries(fsM)) out.push("    " + k + "  x" + v);
  out.push("  ---- placed images (name | mmW x mmH | x,y mm | px x py | bpc cs) ----");
  for (const im of imgs) {
    out.push("    /" + im.name + " | " + toMM(im.w) + " x " + toMM(im.h) + " mm | @(" + toMM(im.x) + "," + toMM(im.y) + ") | " + (im.px || "?") + "x" + (im.py || "?") + "px " + (im.bpc || "?") + "bpc " + (im.cs || "?"));
  }
  out.push("  ---- text runs (x,y pt | font size | txt) — up to 45, sorted top-to-bottom ----");
  const st2 = runs.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  for (let i = 0; i < Math.min(45, st2.length); i++) {
    const r = st2[i];
    out.push("    x=" + r.x + " y=" + r.y + " | " + r.f + " " + r.sz.toFixed(1) + "pt | '" + r.t.slice(0, 42) + "'");
  }
  out.push("");
}

fs.writeFileSync("scripts/_pdfGapOut.txt", out.join("\n"), "utf8");
console.log("wrote " + out.length + " lines");
