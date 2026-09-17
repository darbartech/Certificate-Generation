import { withAdminAuth, jsonResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { checkCertificateIntegrity } from "@/lib/services/integrityService";

export const dynamic = "force-dynamic";

// V2 §37: admin-only "Verify Certificate Integrity" operation.
export const GET = withAdminAuth("DOWNLOAD_CERTIFICATE", async (_req, { params, requestId }) => {
  try {
    const report = await checkCertificateIntegrity(params!.id);
    return jsonResponse({ success: true, report });
  } catch (err) {
    return serviceErrorResponse(err, "Integrity check failed", requestId);
  }
});
