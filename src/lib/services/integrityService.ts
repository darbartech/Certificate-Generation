import crypto from "crypto";
import { db } from "@/lib/database";
import storageService from "@/lib/services/storageService";
import { verifyAuditChain } from "@/lib/services/auditService";

export type IntegrityStatus = "PASS" | "WARNING" | "FAIL";

export type IntegrityCheck = {
  name: string;
  status: IntegrityStatus;
  detail?: string;
};

export type IntegrityReport = {
  certificateId: string;
  overall: IntegrityStatus;
  checks: IntegrityCheck[];
};

const sha256 = (buf: Buffer): string =>
  crypto.createHash("sha256").update(buf).digest("hex");

const worst = (checks: IntegrityCheck[]): IntegrityStatus => {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL";
  if (checks.some((c) => c.status === "WARNING")) return "WARNING";
  return "PASS";
};

// V2 §37: admin-only deep verification of a certificate's authoritative record,
// artifact and audit trail. Output is PASS / WARNING / FAIL per check; it is
// never exposed on the public verification endpoint.
export const checkCertificateIntegrity = async (
  certificateId: string
): Promise<IntegrityReport> => {
  const checks: IntegrityCheck[] = [];

  const cert = await db.certificates.findById(certificateId);
  if (!cert) {
    return {
      certificateId,
      overall: "FAIL",
      checks: [{ name: "certificate record", status: "FAIL", detail: "Certificate not found." }],
    };
  }
  checks.push({ name: "certificate record", status: "PASS" });

  // Verification hash shape (the raw token is intentionally not persisted, so
  // the hash cannot be recomputed here — only its presence/shape is checked).
  const hash = cert.verification_token_hash;
  const hashValid = !!hash && /^[a-f0-9]{64}$/.test(hash);
  checks.push({
    name: "verification hash",
    status: hashValid ? "PASS" : cert.status === "DRAFT" || cert.status === "PREVIEW" ? "WARNING" : "FAIL",
    detail: hashValid ? undefined : "No valid verification_token_hash on record.",
  });

  // Snapshot present: needed to re-render deterministically.
  const snapshot = cert.data_snapshot;
  const snapshotOk = !!snapshot && typeof snapshot === "object" && Object.keys(snapshot).length > 0;
  checks.push({
    name: "data snapshot",
    status: snapshotOk ? "PASS" : "WARNING",
    detail: snapshotOk ? undefined : "Missing or empty data_snapshot.",
  });

  // Status relationships.
  const statusIssues: string[] = [];
  if (cert.status === "SUPERSEDED" && !cert.superseded_by_id) {
    statusIssues.push("SUPERSEDED without superseded_by_id");
  }
  if (cert.status === "REISSUED" && !cert.superseded_by_id) {
    statusIssues.push("REISSUED without superseded_by_id");
  }
  if (cert.reissued_from_id && cert.reissued_from_id === cert.id) {
    statusIssues.push("reissued_from_id points to itself");
  }
  if (cert.status === "REVOKED" && !cert.revoked_at) {
    statusIssues.push("REVOKED without revoked_at");
  }
  checks.push({
    name: "status relationships",
    status: statusIssues.length === 0 ? "PASS" : "FAIL",
    detail: statusIssues.length ? statusIssues.join("; ") : undefined,
  });

  // Artifact presence and integrity.
  const issuedLike = ["ISSUED", "SUPERSEDED", "REISSUED", "REVOKED"].includes(cert.status);
  if (!cert.pdf_storage_key) {
    checks.push({
      name: "pdf artifact",
      status: issuedLike ? "FAIL" : "WARNING",
      detail: "No pdf_storage_key on record.",
    });
  } else {
    let pdf: Buffer | null = null;
    try {
      pdf = await storageService.getPdf(cert.pdf_storage_key);
    } catch (err) {
      checks.push({
        name: "pdf artifact",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Artifact read failed.",
      });
    }
    if (pdf) {
      checks.push({ name: "pdf artifact", status: "PASS" });
      if (cert.pdf_sha256) {
        const actual = sha256(pdf);
        checks.push({
          name: "pdf sha-256",
          status: actual === cert.pdf_sha256 ? "PASS" : "FAIL",
          detail: actual === cert.pdf_sha256 ? undefined : "Stored hash does not match artifact.",
        });
      } else {
        checks.push({ name: "pdf sha-256", status: "WARNING", detail: "No stored hash." });
      }
      if (typeof cert.pdf_size === "number") {
        checks.push({
          name: "pdf size",
          status: pdf.length === cert.pdf_size ? "PASS" : "FAIL",
          detail: pdf.length === cert.pdf_size ? undefined : `Expected ${cert.pdf_size}, got ${pdf.length}.`,
        });
      } else {
        checks.push({ name: "pdf size", status: "WARNING", detail: "No stored size." });
      }
    } else {
      checks.push({
        name: "pdf artifact",
        status: issuedLike ? "FAIL" : "WARNING",
        detail: "Artifact could not be read from storage.",
      });
    }
  }

  // Audit chain.
  try {
    const chainOk = await verifyAuditChain(certificateId);
    checks.push({
      name: "audit chain",
      status: chainOk ? "PASS" : "FAIL",
      detail: chainOk ? undefined : "Tamper-evident hash chain is broken.",
    });
  } catch (err) {
    checks.push({
      name: "audit chain",
      status: "WARNING",
      detail: err instanceof Error ? err.message : "Could not verify audit chain.",
    });
  }

  return { certificateId, overall: worst(checks), checks };
};
