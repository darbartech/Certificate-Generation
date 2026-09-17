import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { getCertificateWithModules } from "@/lib/services/certificateService";
import { getAuditTrail } from "@/lib/services/auditService";

export const GET = withAdminAuth("VIEW_CERTIFICATES", async (_req: NextRequest, { params }) => {
  try {
    const certificateId = params?.id;
    if (!certificateId) {
      return errorResponse("Certificate ID is required", 400);
    }

    const certWithModules = await getCertificateWithModules(certificateId);
    if (!certWithModules) {
      return errorResponse("Certificate not found", 404);
    }

    const events = await getAuditTrail(certificateId);

    return jsonResponse({
      success: true,
      certificate: certWithModules.certificate,
      modules: certWithModules.modules,
      events,
    });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to fetch certificate");
  }
});
