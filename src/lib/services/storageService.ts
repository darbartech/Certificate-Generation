import fs from "fs";
import path from "path";
import os from "os";

const STORAGE_DIR = process.env.CERTIFICATE_STORAGE_DIR || path.join(os.tmpdir(), "darbartech-certificates");

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const getYearDir = (certificateNumber: string): string => {
  const match = certificateNumber.match(/-(\d{4})-/);
  const year = match ? match[1] : new Date().getFullYear().toString();
  return path.join(STORAGE_DIR, year, certificateNumber);
};

export const storageService = {
  async savePdf(certificateNumber: string, pdfBuffer: Buffer): Promise<string> {
    const dir = getYearDir(certificateNumber);
    ensureDir(dir);
    const key = path.join(dir, "certificate.pdf");
    fs.writeFileSync(key, pdfBuffer);
    return key;
  },

  async savePreview(certificateNumber: string, pngBuffer: Buffer): Promise<string> {
    const dir = getYearDir(certificateNumber);
    ensureDir(dir);
    const key = path.join(dir, "preview.png");
    fs.writeFileSync(key, pngBuffer);
    return key;
  },

  async saveMetadata(certificateNumber: string, metadata: Record<string, unknown>): Promise<string> {
    const dir = getYearDir(certificateNumber);
    ensureDir(dir);
    const key = path.join(dir, "metadata.json");
    fs.writeFileSync(key, JSON.stringify(metadata, null, 2));
    return key;
  },

  async getPdf(key: string): Promise<Buffer | null> {
    try {
      if (fs.existsSync(key)) {
        return fs.readFileSync(key);
      }
      return null;
    } catch {
      return null;
    }
  },

  async getPreview(key: string): Promise<Buffer | null> {
    try {
      if (fs.existsSync(key)) {
        return fs.readFileSync(key);
      }
      return null;
    } catch {
      return null;
    }
  },
};

export default storageService;
