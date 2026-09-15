import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getTemplateById } from "../src/lib/templates/darbartech-certificate-v2";
import { renderCertificatePdf } from "../src/lib/renderer/certificateRenderer";
import type { CertificateRenderInput } from "../src/lib/types";

// Exact Aayara reference payload (see spec.md Background & Context). Renders with
// NO dev server, browser, or Supabase credentials — pure in-memory pdf-lib pipeline.
const TEMPLATE_ID = "darbartech-certificate";
const TEMPLATE_VERSION = "2.0.0";
const RENDERER_VERSION = "certificate-engine 2.0.0";
const VERIFICATION_TOKEN = "TEST-TOKEN";

const referenceInput: CertificateRenderInput = {
  templateId: TEMPLATE_ID,
  templateVersion: TEMPLATE_VERSION,
  rendererVersion: RENDERER_VERSION,
  certificateNumber: "DT-CERT-2026-00125",
  recipient: { name: "AAYARA SHRESTHA" },
  program: {
    title: "PROFESSIONAL COMPUTER & DIGITAL SKILLS PROGRAM",
    duration: "4 Months",
  },
  trainingProvider: "DarbarTech Group of Technology",
  modules: [
    { order: 1, title: "COMPUTER FUNDAMENTALS", subtitle: "Basic Computer Operations" },
    { order: 2, title: "OFFICE APPLICATIONS", subtitle: "Microsoft Word | Excel | PowerPoint" },
    { order: 3, title: "GRAPHIC DESIGN", subtitle: "Adobe Photoshop | Illustrator | Canva" },
    { order: 4, title: "NEPALI TYPING", subtitle: "Unicode · Traditional Nepali Typing" },
  ],
  grade: "A+",
  issueDate: "2026-09-11",
  signatory: { name: "Mohan Shahi", position: "Authorized Signatory" },
  secondarySignatory: { name: "Nirmala Shrestha", position: "Managing Director" },
  verificationUrl: `https://darbartech.com/verify/${VERIFICATION_TOKEN}`,
};

async function main(): Promise<void> {
  const template = getTemplateById(TEMPLATE_ID, TEMPLATE_VERSION);
  const result = await renderCertificatePdf(referenceInput, template);

  if (!result.success || (result.errors && result.errors.length > 0)) {
    for (const e of result.errors || []) {
      console.error(e);
    }
    console.error("Reference render failed with hard errors. See above.");
    process.exit(1);
  }
  if (!result.data) {
    console.error("Renderer returned success but no PDF data buffer.");
    process.exit(1);
  }

  const outDir = resolve(process.cwd(), "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "aayara-reference-test.pdf");
  writeFileSync(outPath, result.data);
  console.log(`Wrote ${outPath} (${result.data.length} bytes)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});