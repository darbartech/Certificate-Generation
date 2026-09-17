import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { certificateRevokeSchema } from "@/lib/validation/schemas";
import { revokeCertificate } from "@/lib/services/certificateService";
import type { AdminUser } from "@/lib/types";

export const POST = withAdminAuth("REVOKE_CERTIFICATE", async (req: NextRequest, { params, user, requestId, ip, userAgent }) => {
  try {
    const certificateId = params?.id;
    if (!certificateId) {
      return errorResponse("Certificate ID is required", 400);
    }

    const body = await req.json();
    const parsed = certificateRevokeSchema.safeParse({ id: certificateId, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const result = await revokeCertificate(
      parsed.data.id,
      parsed.data.reason,
      (user as AdminUser).id,
      { requestId, ip, userAgent },
      parsed.data.category
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.errors },
        { status: 400 }
      );
    }

    return jsonResponse({
      success: true,
      certificate: result.certificate,
      message: "Certificate revoked successfully",
    });
  } catch (err) {
    return serviceErrorResponse(err, "Revoke failed");
  }
});
