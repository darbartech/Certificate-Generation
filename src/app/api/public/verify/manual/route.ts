import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { logEvent } from "@/lib/services/auditService";
import { formatCertificateDate } from "@/lib/renderer/dateFormatter";
import { certificateNumberManualSchema } from "@/lib/validation/schemas";
import { validateRateLimit } from "@/lib/middleware/auth";
import { ISSUER_NAME } from "@/lib/services/certificateService";
import { DEFAULT_PUBLIC_FIELDS } from "@/lib/templates/darbartech-certificate-v1";
import type { PublicVerificationResponse, VerificationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimit = validateRateLimit(`manual-verify:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = certificateNumberManualSchema.safeParse(body);

    if (!parsed.success) {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Invalid certificate number format",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const cert = await db.certificates.findByNumber(parsed.data.certificateNumber.trim().toUpperCase());

    if (!cert) {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Certificate not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    try {
      await logEvent(cert.id, "VERIFIED", undefined, {
        source: "manual_search",
        ip: ip.length > 64 ? ip.slice(0, 64) : ip,
      });
    } catch {}

    const visibility = (cert.public_visibility ||
      DEFAULT_PUBLIC_FIELDS) as Record<string, boolean>;

    let status: VerificationStatus = "NOT_FOUND";
    if (cert.status === "ISSUED" || cert.status === "REISSUED") {
      status = "VALID";
    } else if (cert.status === "REVOKED") {
      status = "REVOKED";
    } else {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Certificate record is not publicly available",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const isRevoked = status === "REVOKED";

    const response: PublicVerificationResponse = {
      valid: !isRevoked,
      status,
      message: isRevoked ? "This certificate has been revoked" : undefined,
      certificate: {
        certificateNumber: visibility.certificateNumber ? cert.certificate_number : "",
        recipientName: visibility.recipientName ? cert.recipient_name : "",
        programTitle: visibility.programTitle ? cert.program_title : "",
        duration: visibility.duration ? cert.duration : "",
        completionDate:
          visibility.completionDate && cert.completion_date
            ? formatCertificateDate(cert.completion_date)
            : undefined,
        issueDate: visibility.issueDate ? formatCertificateDate(cert.issue_date) : cert.issue_date,
        grade: visibility.grade && cert.grade ? cert.grade : undefined,
        issuer: visibility.issuer ? ISSUER_NAME : "",
        status,
        revokedAt: isRevoked ? cert.revoked_at || undefined : undefined,
        revocationReason: isRevoked ? cert.revocation_reason || undefined : undefined,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const response: PublicVerificationResponse = {
      valid: false,
      status: "NOT_FOUND",
      message: "Verification service unavailable",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
