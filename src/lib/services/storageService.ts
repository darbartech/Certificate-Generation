import fs from "fs";
import path from "path";
import os from "os";
import { supabaseAdmin } from "@/lib/database/supabase";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const STORAGE_DIR =
  process.env.CERTIFICATE_STORAGE_DIR ||
  path.join(os.tmpdir(), "darbartech-certificates");

// V2 §6: official certificates live in a PRIVATE bucket. Keys are prefixed
// `sb:` when they refer to a Supabase Storage object and `fs:` when they fell
// back to the local disk (development only — production never creates `fs:`).
const STORAGE_BUCKET = process.env.CERTIFICATE_STORAGE_BUCKET || "certificate-pdfs";

/**
 * A durable-storage failure. Issuance must treat this as fatal (the certificate
 * is NOT issued) and leave a recoverable ISSUE_FAILED record instead.
 */
export class CertificateStorageError extends Error {
  readonly code = "STORAGE_UNAVAILABLE" as const;
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = "CertificateStorageError";
  }
}

export const isCertificateStorageError = (
  err: unknown
): err is CertificateStorageError => err instanceof CertificateStorageError;

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const getYearDir = (certificateNumber: string, artifactVersion: number): string => {
  const match = certificateNumber.match(/-(\d{4})-/);
  const year = match ? match[1] : new Date().getFullYear().toString();
  return path.join(STORAGE_DIR, year, `${certificateNumber}-v${artifactVersion}`);
};

// V2 §6: issued/{certificateId}/{certificateNumber}-v{version}.pdf — one
// immutable object per rendered artifact. The version segment makes a
// re-render/reissue collision detectable instead of silently overwriting a
// signed certificate.
const getBucketPath = (
  certificateId: string,
  certificateNumber: string,
  artifactVersion: number
): string => {
  const safeNumber = certificateNumber.replace(/[^A-Za-z0-9._-]/g, "_");
  const safeId = certificateId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `issued/${safeId}/${safeNumber}-v${artifactVersion}.pdf`;
};

const isAlreadyExistsError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("resource already exists")
  );
};

/**
 * Settles a certificate artifact into private, immutable storage.
 *
 * V2 §5/§6:
 * - Production: the ONLY acceptable outcome is a successful private-bucket
 *   upload. Any failure throws `CertificateStorageError` and issuance fails
 *   into a recoverable ISSUE_FAILED state. There is no filesystem fallback.
 * - Development: an upload failure may fall back to the process-local disk so
 *   the app runs without Storage configured.
 * - `upsert: false`: an existing object is an artifact collision, never a
 *   silent overwrite.
 */
const persistArtifact = async (
  certificateId: string,
  certificateNumber: string,
  artifactVersion: number,
  buffer: Buffer,
  contentType: string
): Promise<string> => {
  if (supabaseAdmin) {
    const sbKey = getBucketPath(certificateId, certificateNumber, artifactVersion);
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(sbKey, buffer, {
        contentType,
        upsert: false,
        cacheControl: "private, max-age=0, no-store",
      });
    if (!error) return `sb:${sbKey}`;

    // Never overwrite an issued artifact. A collision is a hard failure.
    if (isAlreadyExistsError(error.message)) {
      throw new CertificateStorageError(
        `Artifact collision at ${sbKey}: an object already exists and issued artifacts are immutable.`
      );
    }

    if (IS_PRODUCTION) {
      console.error(
        `[storageService] Private bucket upload failed for ${sbKey}: ${error.message}`
      );
      throw new CertificateStorageError("Certificate artifact storage unavailable.");
    }
    console.warn(
      `[storageService] Supabase Storage upload failed for ${sbKey}: ` +
        `${error.message}. Falling back to local disk (development only).`
    );
  } else if (IS_PRODUCTION) {
    throw new CertificateStorageError(
      "Certificate artifact storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)."
    );
  } else {
    console.warn(
      "[storageService] Supabase Storage not configured. Using local disk fallback (development only)."
    );
  }

  const dir = getYearDir(certificateNumber, artifactVersion);
  ensureDir(dir);
  const localKey = path.join(dir, "certificate.pdf");
  fs.writeFileSync(localKey, buffer);
  return `fs:${localKey}`;
};

export const storageService = {
  async savePdf(
    certificateId: string,
    certificateNumber: string,
    pdfBuffer: Buffer,
    artifactVersion = 1
  ): Promise<string> {
    return persistArtifact(
      certificateId,
      certificateNumber,
      artifactVersion,
      pdfBuffer,
      "application/pdf"
    );
  },

  async savePreview(
    certificateId: string,
    certificateNumber: string,
    pngBuffer: Buffer,
    artifactVersion = 1
  ): Promise<string> {
    return persistArtifact(
      certificateId,
      certificateNumber,
      artifactVersion,
      pngBuffer,
      "image/png"
    );
  },

  async getPdf(key: string): Promise<Buffer | null> {
    if (key.startsWith("sb:")) {
      if (!supabaseAdmin) return null;
      const { data, error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .download(key.slice(3));
      if (error || !data) {
        console.warn(`[storageService] Download failed for ${key}: ${error?.message || "no data"}`);
        return null;
      }
      return Buffer.from(await data.arrayBuffer());
    }
    const localKey = key.startsWith("fs:") ? key.slice(3) : key;
    try {
      if (fs.existsSync(localKey)) return fs.readFileSync(localKey);
      return null;
    } catch {
      return null;
    }
  },

  async getPreview(key: string): Promise<Buffer | null> {
    return this.getPdf(key);
  },

  /**
   * V2 §6 download strategy: authenticated admins receive a SHORT-LIVED signed
   * URL instead of any long-lived/public object URL. Returns null for local
   * (development) keys, which callers stream directly.
   */
  async createSignedUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    if (!key.startsWith("sb:")) return null;
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(key.slice(3), expiresInSeconds);
    if (error || !data?.signedUrl) {
      console.warn(
        `[storageService] createSignedUrl failed for ${key}: ${error?.message || "no url"}`
      );
      return null;
    }
    return data.signedUrl;
  },

  /**
   * Deterministic key for a certificate artifact, mirroring `persistArtifact`.
   * Used by issuance recovery to inspect whether a render that timed out
   * actually landed in storage (V2 §12).
   */
  buildPdfKey(certificateId: string, certificateNumber: string, artifactVersion = 1): string {
    if (supabaseAdmin) {
      return `sb:${getBucketPath(certificateId, certificateNumber, artifactVersion)}`;
    }
    const dir = getYearDir(certificateNumber, artifactVersion);
    return `fs:${path.join(dir, "certificate.pdf")}`;
  },

  storageBucket: STORAGE_BUCKET,
  isConfigured: !!supabaseAdmin,
};

export default storageService;
