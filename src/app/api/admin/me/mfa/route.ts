import { NextRequest, NextResponse } from "next/server";
import {
  withAdminAuth,
  jsonResponse,
  errorResponse,
  serviceErrorResponse,
  ADMIN_COOKIE_NAME,
  getClientIp,
} from "@/lib/middleware/auth";
import { mfaConfirmSchema } from "@/lib/validation/schemas";
import {
  generateMfaSetup,
  verifyTotp,
  enableMfa,
  disableMfa,
  getAdminRecord,
  createAdminSession,
} from "@/lib/services/authService";

export const dynamic = "force-dynamic";

// V2 §17: TOTP enrollment for the logged-in admin.
// POST  → returns a fresh secret + otpauth URI (nothing persisted yet).
// PUT   → verifies a code against that secret, then enables MFA.
// DELETE→ disables MFA.
export const POST = withAdminAuth(async (_req, { user }) => {
  try {
    const setup = generateMfaSetup(user!.username);
    return jsonResponse({ success: true, secret: setup.secret, otpauthUri: setup.uri });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to start MFA setup");
  }
});

export const PUT = withAdminAuth(async (req: NextRequest, { user, ip, userAgent }) => {
  try {
    const parsed = mfaConfirmSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(
        { success: false, errors: parsed.error.issues.map((i) => i.message) },
        400
      );
    }
    if (!verifyTotp(parsed.data.secret, parsed.data.token)) {
      return errorResponse("Invalid MFA code", 400);
    }
    await enableMfa(user!.id, parsed.data.secret);

    // T-B9 AC-28.1: After MFA setup succeeds, upgrade the partial session
    // to a full, MFA-verified session so the user isn't kicked back to login.
    const clientIp = ip || getClientIp(req);
    const newSession = await createAdminSession(
      user!.id,
      { ip: clientIp, userAgent },
      { mfaVerified: true }
    );
    const response = NextResponse.json({
      success: true,
      mfaEnabled: true,
      mfaVerified: true,
    });
    response.cookies.set(ADMIN_COOKIE_NAME, encodeURIComponent(newSession.sessionId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (err) {
    return serviceErrorResponse(err, "Failed to enable MFA");
  }
});

export const GET = withAdminAuth(async (_req, { user }) => {
  try {
    const record = await getAdminRecord(user!.id);
    return jsonResponse({ success: true, mfaEnabled: !!record?.mfa_enabled });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load MFA status");
  }
});

export const DELETE = withAdminAuth(async (_req, { user }) => {
  try {
    await disableMfa(user!.id);
    return jsonResponse({ success: true, mfaEnabled: false });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to disable MFA");
  }
});
