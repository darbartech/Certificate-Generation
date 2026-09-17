import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { adminUserCreateSchema } from "@/lib/validation/schemas";
import { listAdminAccounts, createAdminAccount } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

// V2 §15/§22: admin account management. MANAGE_ADMINS (super admin) only.
export const GET = withAdminAuth("MANAGE_ADMINS", async () => {
  try {
    const admins = await listAdminAccounts();
    return jsonResponse({ success: true, admins });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load admin accounts");
  }
});

export const POST = withAdminAuth("MANAGE_ADMINS", async (req: NextRequest) => {
  try {
    const parsed = adminUserCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(
        { success: false, errors: parsed.error.issues.map((i) => i.message) },
        400
      );
    }
    const admin = await createAdminAccount({
      username: parsed.data.username,
      password: parsed.data.password,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    });
    return jsonResponse({ success: true, admin }, 201);
  } catch (err) {
    if (err instanceof Error && /already exists/i.test(err.message)) {
      return errorResponse(err.message, 409);
    }
    return serviceErrorResponse(err, "Failed to create admin account");
  }
});
