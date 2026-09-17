import { withAdminAuth, jsonResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { listActiveSessions, revokeAllSessions } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth("MANAGE_ADMINS", async (_req, { params }) => {
  try {
    const sessions = await listActiveSessions(params!.id);
    return jsonResponse({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        expiresAt: s.expires_at,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
      })),
    });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load sessions");
  }
});

export const DELETE = withAdminAuth("MANAGE_ADMINS", async (_req, { params }) => {
  try {
    const revoked = await revokeAllSessions(params!.id);
    return jsonResponse({ success: true, revoked });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to revoke sessions");
  }
});
