const fs = require("fs");
const out = [];

const page = "src/app/admin/certificates/new/page.tsx";
const s = fs.readFileSync(page, "utf8").split("\n");

const region = (from, to, label) => {
  out.push("### " + label + "  (lines " + from + "-" + to + ")");
  for (let i = from - 1; i < to && i < s.length; i++) {
    out.push((i + 1) + "|" + s[i]);
  }
  out.push("");
};

// imports (lines 1-18)
region(1, 18, "imports");

// state for previewErrors + templateErrors region
region(45, 60, "state previewErrors"); // find exact later; use grep anchors

fs.writeFileSync("scripts/_pageRegions1.txt", out.join("\n"), "utf8");
console.log("wrote " + out.length);
