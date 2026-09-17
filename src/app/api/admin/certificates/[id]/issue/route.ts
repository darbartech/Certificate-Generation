import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { certificateCreateSchema } from "@/lib/validation/schemas";
import {
  issueCertificate,
  getCertificateWithModules,
  validateCourseData,
} from "@/lib/services/certificateService";
import type { AdminUser } from "@/lib/types";

export const POST = withAdminAuth("ISSUE_CERTIFICATE", async (req: NextRequest, { params, user, requestId, ip, userAgent }) => {
  try {
    const draftId = params?.id;
    if (!draftId) {
      return errorResponse("Certificate ID is required", 400);
    }

    const body = await req.json();
    const parsed = certificateCreateSchema.safeParse(body.certificateData || body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const courseErrors = await validateCourseData(parsed.data);
    if (courseErrors.length > 0) {
      return NextResponse.json(
        { success: false, errors: courseErrors },
        { status: 400 }
      );
    }

    const result = await issueCertificate(draftId, parsed.data, (user as AdminUser).id, {
      requestId,
      ip,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.errors || ["Issuance failed"] },
        { status: 400 }
      );
    }

    const certWithModules = await getCertificateWithModules(result.certificate!.id);
    return jsonResponse({
      success: true,
      certificate: certWithModules?.certificate || result.certificate,
      modules: certWithModules?.modules || result.modules,
      // V2 §7: the raw verification link is returned exactly once here; it is
      // never persisted in raw form and never returned by read endpoints.
      verificationUrl: result.verificationUrl,
      message: "Certificate issued successfully",
    });
  } catch (err) {
    return serviceErrorResponse(err, "Issuance failed");
  }
});
