const fs = require("fs");
const out = [];

// 1) Walk ALL src files for module-fit guard tokens (robust, no shell globbing)
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = d + "/" + e.name;
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) {
      const s = fs.readFileSync(p, "utf8");
      if (/moduleTileFit|moduleFit|tileFit|fitTile|ModuleTileIssue|moduleFitWarnings/i.test(s)) {
        const rel = p.split("/src/")[1] || p;
        out.push("## " + rel);
        out.push("  hasTypeTitles=" + /submit|previewIssue|firstPass|overflowPolicy|fillFunction/i.test(s));
        out.push("  lines=" + s.split("\n").length);
      }
    }
  }
};
walk("src");

// 2) Where is coherentModuleFit / getModuleTileTemplate used from page?
const page = fs.readFileSync("src/app/admin/certificates/new/page.tsx", "utf8");
out.push("===== page.tsx fit-token refs =====");
for (const m of page.matchAll(/^(.*collectModuleTileFit.*|.*getModuleTileTemplate.*|.*moduleFit.*)$/gm)) {
  out.push("  " + m[1].trim());
}
out.push("===== moduleFit.ts content (full, first 40) =====");
try {
  const mf = fs.readFileSync("src/lib/renderer/moduleFit.ts", "utf8").split("\n");
  for (let i = 0; i < Math.min(40, mf.length); i++) out.push((i + 1) + "|" + mf[i]);
} catch (e) {
  out.push("  ENOENT " + e.message);
}
out.push("===== moduleTileFit.ts content (first 190) =====");
try {
  const mt = fs.readFileSync("src/lib/renderer/moduleTileFit.ts", "utf8").split("\n");
  for (let i = 0; i < Math.min(190, mt.length); i++) out.push((i + 1) + "|" + mt[i]);
} catch (e) {
  out.push("  ENOENT " + e.message);
}

fs.writeFileSync("scripts/_fitGround.txt", out.join("\n"), "utf8");
console.log("ok " + out.length);
