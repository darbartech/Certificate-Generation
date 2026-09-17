import { NextRequest, NextResponse } from "next/server";
import { db, isPersistenceUnavailableError } from "@/lib/database";
import { logEvent } from "@/lib/services/auditService";
import { formatCertificateDate } from "@/lib/renderer/dateFormatter";
import { certificateNumberManualSchema } from "@/lib/validation/schemas";
import { getClientIp, validatePublicVerifyManual } from "@/lib/middleware/auth";
import { ISSUER_NAME } from "@/lib/services/certificateService";
import { DEFAULT_PUBLIC_FIELDS_V2, DEFAULT_PUBLIC_FIELDS } from "@/lib/templates/darbartech-certificate-v2";
import type { PublicVerificationResponse, VerificationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// V2 §31: Single generic not-found for the manual verifier. Certificate
// numbers are enumerable (prefix + year + 5-digit sequence) so any signal
// about WHY the lookup failed (bad format vs. doesn't exist vs. not yet
// issued vs. withdrawn) helps an attacker. Always reply with the same 404.
const GENERIC_NOT_FOUND: PublicVerificationResponse = {
  valid: false,
  status: "NOT_FOUND",
  message: "Certificate not found or invalid",
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await validatePublicVerifyManual(`public-verify-manual:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    let parsed;
    try {
      const body = await req.json();
      parsed = certificateNumberManualSchema.safeParse(body);
    } catch {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    if (!parsed.success) {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    const cert = await db.certificates.findByNumber(parsed.data.certificateNumber.trim().toUpperCase());

    if (!cert) {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    try {
      await logEvent(cert.id, "VERIFIED", undefined, {
        source: "manual_search",
        ip: ip.length > 64 ? ip.slice(0, 64) : ip,
      });
    } catch {}

    const fallbackVisibility = cert.template_version === "2.0.0"
      ? DEFAULT_PUBLIC_FIELDS_V2
      : DEFAULT_PUBLIC_FIELDS;
    const visibility = (cert.public_visibility ||
      fallbackVisibility) as Record<string, boolean>;

    let status: VerificationStatus = "NOT_FOUND";
    if (cert.status === "ISSUED" || cert.status === "REISSUED") {
      status = "VALID";
    } else if (cert.status === "REVOKED") {
      status = "REVOKED";
    } else if (cert.status === "SUPERSEDED") {
      status = "SUPERSEDED";
    } else {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    const isRevoked = status === "REVOKED";
    const isSuperseded = status === "SUPERSEDED";

    const response: PublicVerificationResponse = {
      valid: !isRevoked && !isSuperseded,
      status,
      message: isRevoked
        ? "This certificate has been revoked"
        : isSuperseded
          ? "This certificate has been superseded by a newer certificate"
          : undefined,
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
        supersededAt: isSuperseded ? cert.superseded_at || undefined : undefined,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // V2 §20: an outage is retryable 503, not a generic 500.
    const unavailable = isPersistenceUnavailableError(err);
    const response: PublicVerificationResponse = {
      valid: false,
      status: "NOT_FOUND",
      message: unavailable
        ? "Verification service is temporarily unavailable. Please try again shortly."
        : "Verification service unavailable",
    };
    return NextResponse.json(response, { status: unavailable ? 503 : 500 });
  }
}
