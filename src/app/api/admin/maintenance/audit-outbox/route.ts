import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { processAuditOutbox } from "@/lib/services/auditService";

export const dynamic = "force-dynamic";

// V2 §11: drains the durable audit outbox. Idempotent; safe to invoke repeatedly.
// Intended to be called by a scheduler every few minutes, or by an admin.
const runDrain = async () => {
  const result = await processAuditOutbox(100);
  return jsonResponse({ success: true, ...result });
};

const withAuth = withAdminAuth("MANAGE_SETTINGS", async () => runDrain());

export async function POST(req: NextRequest) {
  const secret = process.env.AUDIT_OUTBOX_SECRET || process.env.ISSUANCE_RECOVERY_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (secret && provided && provided === secret) {
    try {
      return await runDrain();
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Outbox drain failed", 503);
    }
  }
  return withAuth(req, {});
}

export async function GET(req: NextRequest) {
  return POST(req);
}
