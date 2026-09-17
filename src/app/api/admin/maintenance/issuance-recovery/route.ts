import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { recoverStaleIssuance } from "@/lib/services/certificateService";

export const dynamic = "force-dynamic";

// V2 §12: periodic stale-issuance recovery. Safe to invoke repeatedly — it is
// idempotent and never mints a new certificate number. Intended to be called by
// a scheduler every 5-15 minutes:
//   curl -X POST -H "x-cron-secret: $ISSUANCE_RECOVERY_SECRET" \
//        https://<host>/api/admin/maintenance/issuance-recovery
// or by an authenticated admin from the console.
const runRecovery = async () => {
  const report = await recoverStaleIssuance({ actorId: "recovery-job" });
  return jsonResponse({ success: true, report });
};

const withAuth = withAdminAuth("MANAGE_SETTINGS", async () => runRecovery());

export async function POST(req: NextRequest) {
  const secret = process.env.ISSUANCE_RECOVERY_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (secret && provided && provided === secret) {
    try {
      return await runRecovery();
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Recovery failed", 503);
    }
  }
  return withAuth(req, {});
}

export async function GET(req: NextRequest) {
  return POST(req);
}
