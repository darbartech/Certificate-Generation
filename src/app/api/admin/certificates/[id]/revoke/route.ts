import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { certificateRevokeSchema } from "@/lib/validation/schemas";
import { revokeCertificate } from "@/lib/services/certificateService";
import type { AdminUser } from "@/lib/types";

export const POST = withAdminAuth("revoke", async (req: NextRequest, { params, user }) => {
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
      (user as AdminUser).id
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
    return errorResponse(err instanceof Error ? err.message : "Revoke failed", 500);
  }
});
