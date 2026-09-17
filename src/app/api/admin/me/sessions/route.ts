import { withAdminAuth, jsonResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { listActiveSessions, revokeAllSessions } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

// V2 §16 "logout all": the current admin can view and revoke every one of their
// own active sessions, e.g. after losing a device.
export const GET = withAdminAuth(async (_req, { user }) => {
  try {
    const sessions = await listActiveSessions(user!.id);
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

export const DELETE = withAdminAuth(async (_req, { user }) => {
  try {
    const revoked = await revokeAllSessions(user!.id);
    return jsonResponse({ success: true, revoked });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to revoke sessions");
  }
});
