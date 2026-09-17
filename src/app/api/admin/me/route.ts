import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse } from "@/lib/middleware/auth";

export const GET = withAdminAuth(async (_req, { user }) => {
  return jsonResponse({
    success: true,
    user: {
      id: user!.id,
      username: user!.username,
      role: user!.role,
      permissions: user!.permissions,
      mfaEnabled: !!user!.mfaEnabled,
    },
  });
});
