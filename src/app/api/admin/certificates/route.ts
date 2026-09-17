import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { db } from "@/lib/database";
import { certificateCreateSchema } from "@/lib/validation/schemas";
import {
  createDraftCertificate,
  getCertificateWithModules,
} from "@/lib/services/certificateService";
import type { AdminUser } from "@/lib/types";

export const GET = withAdminAuth("VIEW_CERTIFICATES", async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    const status = searchParams.get("status") || undefined;
    const q = searchParams.get("q") || undefined;

    const certificates = await db.certificates.list({ limit, offset, status, q });
    const count = await db.certificates.count({ status, q });

    const stats = {
      total: await db.certificates.count({ q }),
      issued: await db.certificates.count({ statuses: ["ISSUED", "REISSUED"], q }),
      draft: await db.certificates.count({ status: "DRAFT", q }),
      revoked: await db.certificates.count({ status: "REVOKED", q }),
    };

    return jsonResponse({
      success: true,
      data: certificates.map((c) => ({
        id: c.id,
        certificate_number: c.certificate_number,
        recipient_name: c.recipient_name,
        program_title: c.program_title,
        duration: c.duration,
        issue_date: c.issue_date,
        grade: c.grade,
        status: c.status,
        template_version: c.template_version,
        issued_at: c.issued_at,
        created_at: c.created_at,
        revoked_at: c.revoked_at,
      })),
      pagination: {
        limit,
        offset,
        total: count,
      },
      stats,
    });
  } catch (err) {
    console.error("[GET /api/admin/certificates] failed:", err);
    return serviceErrorResponse(err, "Failed to list certificates");
  }
});

export const POST = withAdminAuth("CREATE_CERTIFICATE", async (req: NextRequest, { user, requestId, ip, userAgent }) => {
  try {
    const body = await req.json();
    const parsed = certificateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const result = await createDraftCertificate(parsed.data, (user as AdminUser).id, {
      requestId,
      ip,
      userAgent,
    });
    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }

    const certWithModules = await getCertificateWithModules(result.certificate!.id);
    return jsonResponse({
      success: true,
      certificate: certWithModules?.certificate || result.certificate,
      modules: certWithModules?.modules || result.modules,
    }, 201);
  } catch (err) {
    console.error("[POST /api/admin/certificates] failed:", err);
    return serviceErrorResponse(err, "Failed to create certificate");
  }
});