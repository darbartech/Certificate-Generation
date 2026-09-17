const fs = require("fs");
const zlib = require("zlib");

const MM = 72 / 25.4 reconcile;
const targets = [
  { label: "REFERENCE  Certificate of Aayara final.pdf", path: "C:/Users/Nepal/Desktop/DarbarTech/Student/Certificate of Aayara final.pdf" },
  { label: "TEST       TESTING1.pdf (Downloads)", path: "C:/Users/Nepal/Downloads/TESTING1.pdf" },
  { label: "TEST       testing2.pdf (Downloads)", path: "C:/Users/Nepal/Downloads/testing2.pdf" },
  { label: "OUT        out/aayara-reference-test.pdf (repo)", path: "out/aayara-reference-test.pdf" },
];
const out = [];
const mm = (pt) => (pt / MM).toFixed(2);

const inflate = (buf) => {
  try { return zlib.inflateSync(buf); } catch (e) {}
  try { return zlib.inflateRawSync(buf); } catch (e) {}
  return null;
};

const parseStreams = (buff) => {
  const streams = [];
  let idx = 0;
  const b = buff;
  for (;;) {
    const st = b.indexOf(Buffer.from("stream"), idx);
    if (st < 0) break;
    const en = b.indexOf(Buffer.from("endstream"), st + 6);
    if (en < 0) break;
    let d = b.slice(st + 6, en);
    if (d.length > 2 && d[0] === 13 && d[1] === 10) d = d.slice(2);
    else if (d.length > 1 && d[0] === 10) d = d.slice(1);
    if (d.length > 1 && d[d.length - 1] === 10) d = d.slice(0, -1);
    if (d.length > 1 && d[d.length - 1] === 13) d = d.slice(0, -1);
    const dec = inflate(d);
    if (dec) streams.push(dec);
    idx = en + 9;
  }
  return streams;
};

for (const t of targets) {
  out.push("############################################################");
  out.push("## " + t.label);
  out.push("## " + t.path + "  exists=" + fs.existsSync(t.path));
  out.push("############################################################");
  if (!fs.existsSync(t.path)) { out.push("  [MISSING]"); out.push(""); continue; }
  const b = fs.readFileSync(t.path);
  const ascii = b.toString("latin1");
  out.push("  bytes=" + b.length + "  producer=" + (/\/Producer\s*\(([^)]*)\)/.exec(ascii) || [0, "?"])[1]);
  const media = (/\/(MediaBox)\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/.exec(ascii) || [0, 0, 0, 0, 0]);
  if (media[4]) {
    const w = +media[4] - +media[2], h = +media[5] - +media[3];
    out.push("  page = " + w.toFixed(1) + " x " + h.toFixed(1) + " pt  (" + mm(w) + " x " + mm(h) + " mm)  rotate=" + (/\/(Rotate)\s+(\d+)/.exec(ascii) || [0, 0, 0])[2]);
  }
  const objs = {};
  const oRe = /(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g;
  let m;
  while ((m = oRe.exec(ascii)) !== null) objs[m[1]] = m[2];
  // find XObject resources (images /Im1..)
  const imgDict = {};
  const xoRe = /\/XObject\s*<<([\s\S]*?)>>/g;
  let xo;
  while ((xo = xoRe.exec(ascii)) !== null) {
    for (const mm0 of xo[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) imgDict[mm0[1]] = mm0[2];
  }
  const imgs = {};
  for (const [name, ref] of Object.entries(imgDict)) {
    const d = objs[ref] || "";
    if (/\/Subtype\s*\/Image/.test(d)) {
      imgs[name] = {
        w: +(/\/(Width)\s+(\d+)/.exec(d) || [0, 0, 0])[2],
        h: +(/\/(Height)\s+(\d+)/.exec(d) || [0, 0, 0])[2],
        bpc: +(/\/(BitsPerComponent)\s+(\d+)/.exec(d) || [0, 0, 0])[2],
        cs: (/\/(ColorSpace)\s*\/(\w+)/.exec(d) || [0, "?"])[1],
      };
    }
  }
  out.push("  xobjects=" + Object.keys(imgs).length + " (images: " + Object.keys(imgs).join(", ") + ")");
  const streams = parseStreams(b);
  out.push("  decodedContentStreams=" + streams.length Optional);
  const runs = [];
  const imgPlaced = [];
  for (const st of streams) {
    const s = st.toString("latin1");

    // text runs
    let font = "?", size = 0;
    const tf = /\/\w+\s+([\d.\-]+)\s+Tf/.exec(s);
    if (tf) size = +tf[1];
    const runsBlock = [...s.matchAll(/BT[\s\S]*?ET/g)];
    for (const blk of runsBlock) {
      let bx = 0, by = 0;
      const tms = [...blk[0].matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*Tm/g)];
      if (tms.length) { bx = +tms[tms.length - 1][5]; by = +tms[tms.length - 1][6]; }
      const strs = [...blk[0].matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj|\[([\s\S]*?)\]\s*TJ/g)];
      for (const s2 of strs) {
        let txt = "";
        if (s2[1] !== undefined) txt = s2[1];
        else if (s2[2] !== undefined) {
          txt = (s2[2].match(/\(((?:[^()\\]|\\.)*)\)/g) || []).map((x) => x.slice(1, -1)).join("");
        }
        txt = txt.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
        runs.push({ x: +bx.toFixed(1), y: +by.toFixed(1), sz: size, txt });
      }
    }

    // image placements: cm + Do
    const cm = [...s.matchAll(/([\d.\-]+)\s+0\s+0\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+cm\s*\/(\w+)\s+Do/g)];
    for (const c of cm) {
      const i = imgs[c[5]] || {};
      imgPlaced.push({ name: c[5], w: +c[1], h: +c[2], x: +c[3], y: +c[4], pxW: i.w, pxH: i.h, bpc: i.bpc, cs: i.cs });
    }
  }
  out.push("  textRuns=" + runs.length + "  placedImages=" + imgPlaced.length);
  out.push("  ---- text runs (x y pt | size | text) — up to 40 ----");
  const sRuns = runs.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  for (let i = 0; i < Math.min(40, sRuns.length); i++) {
    const r = sRuns[i];
    out.push("    x=" + r.x + " y=" + r.y + " | " + r.sz.toFixed(1) + "pt | '" + r.txt.slice(0, 40) + "'");
  }
  out.push("  ---- placed images (name | mmW x mmH @ X,Y | pxWpxH bpc cs) ----");
  for (const i of imgPlaced) {
    out.push("    " + i.name + " | " + mm(i.w) + " x " + mm(i.h) + " mm @ (" + i.x.toFixed(1) + "," + i.y.toFixed(1) + ") | " + (i.pxW || "?") + "x" + (i.pxH || "?") + "px " + (i.bpc || "?") + "bpc " + (i.cs || "?"));
  }
  out.push("");
}
fs.writeFileSync("scripts/_gapOut.txt", out.join("\n"), "utf8");
console.log("wrote " + out.length);
