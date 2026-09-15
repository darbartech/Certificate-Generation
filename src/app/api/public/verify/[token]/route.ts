import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { logEvent } from "@/lib/services/auditService";
import { formatCertificateDate } from "@/lib/renderer/dateFormatter";
import { publicVerificationSchema } from "@/lib/validation/schemas";
import { validateRateLimit } from "@/lib/middleware/auth";
import { ISSUER_NAME } from "@/lib/services/certificateService";
import { DEFAULT_PUBLIC_FIELDS_V2, DEFAULT_PUBLIC_FIELDS } from "@/lib/templates/darbartech-certificate-v2";
import type { PublicVerificationResponse, VerificationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimit = validateRateLimit(`verify:${ip}`);
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

    const tokenParse = publicVerificationSchema.safeParse({ token: params.token });
    if (!tokenParse.success) {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Invalid verification link",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const token = tokenParse.data.token;
    const cert = await db.certificates.findByToken(token);

    if (!cert) {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Certificate not found or verification link is invalid",
      };
      return NextResponse.json(response, { status: 404 });
    }

    try {
      await logEvent(cert.id, "VERIFIED", undefined, {
        source: "public_api",
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
    } else {
      const response: PublicVerificationResponse = {
        valid: false,
        status: "NOT_FOUND",
        message: "Certificate record is not publicly available",
        verification_token: params.token,
      };
      return NextResponse.json(response, { status: 404 });
    }

    const isRevoked = status === "REVOKED";

    let modules: any[] | undefined = undefined;
    if (visibility.modules) {
      try {
        const mods = await db.certificateModules.findByCertificateId(cert.id);
        modules = mods
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((m: any) => ({
            order: m.sort_order,
            title: m.title,
            subtitle: m.subtitle,
          }));
      } catch {}
    }

    const response: PublicVerificationResponse = {
      valid: !isRevoked,
      status,
      verification_token: params.token,
      message: isRevoked ? "This certificate has been revoked" : undefined,
      certificate: {
        certificateNumber: visibility.certificateNumber ? cert.certificate_number : "",
        recipientName: visibility.recipientName ? cert.recipient_name : "",
        programTitle: visibility.programTitle ? cert.program_title : "",
        duration: visibility.duration ? cert.duration : "",
        trainingProvider: visibility.trainingProvider ? ISSUER_NAME : undefined,
        modules,
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

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": isRevoked ? "no-store" : "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    const response: PublicVerificationResponse = {
      valid: false,
      status: "NOT_FOUND",
      message: "Verification service unavailable",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
