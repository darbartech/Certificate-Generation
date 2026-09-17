import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { adminUserUpdateSchema } from "@/lib/validation/schemas";
import { updateAdminAccount, getAdminRecord, listActiveSessions } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth("MANAGE_ADMINS", async (_req, { params }) => {
  try {
    const record = await getAdminRecord(params!.id);
    if (!record) return errorResponse("Admin not found", 404);
    return jsonResponse({
      success: true,
      admin: {
        id: record.id,
        username: record.username,
        role: record.role,
        permissions: record.permissions,
        isActive: record.is_active,
        mfaEnabled: record.mfa_enabled,
        lastLoginAt: record.last_login_at ?? null,
      },
      activeSessions: (await listActiveSessions(record.id)).length,
    });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load admin account");
  }
});

export const PATCH = withAdminAuth("MANAGE_ADMINS", async (req: NextRequest, { params }) => {
  try {
    const parsed = adminUserUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(
        { success: false, errors: parsed.error.issues.map((i) => i.message) },
        400
      );
    }
    const updated = await updateAdminAccount(params!.id, parsed.data);
    if (!updated) return errorResponse("Admin not found", 404);
    return jsonResponse({ success: true, admin: updated });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to update admin account");
  }
});

// Disable rather than delete: preserves the audit trail that references the
// account, while immediately revoking all of its sessions (§16).
export const DELETE = withAdminAuth("MANAGE_ADMINS", async (_req, { params, user }) => {
  if (params!.id === user!.id) return errorResponse("You cannot disable your own account", 400);
  try {
    const updated = await updateAdminAccount(params!.id, { isActive: false });
    if (!updated) return errorResponse("Admin not found", 404);
    return jsonResponse({ success: true, admin: updated });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to disable admin account");
  }
});
