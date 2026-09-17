import { NextRequest, NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validation/schemas";
import {
  authenticateAdmin,
  createAdminSession,
  verifyTotp,
} from "@/lib/services/authService";
import { recordLoginFailure } from "@/lib/services/loginThrottle";
import {
  ADMIN_COOKIE_NAME,
  validateLoginRateLimit,
  getClientIp,
  assertStateChangingOrigin,
  getOrCreateRequestId,
} from "@/lib/middleware/auth";

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const response = await handleLogin(req, requestId);
  response.headers.set("x-request-id", requestId);
  return response;
}

async function handleLogin(req: NextRequest, requestId: string): Promise<NextResponse> {
  try {
    const originError = assertStateChangingOrigin(req);
    if (originError) {
      return NextResponse.json(
        { success: false, error: "Request origin rejected" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const rateLimit = await validateLoginRateLimit(ip);

    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const auth = await authenticateAdmin(parsed.data.username, parsed.data.password, {
      ip,
      userAgent,
    });
    if (!auth) {
      // Deliberately generic: don't distinguish "wrong password", "unknown
      // username", or "account locked" in the response, to avoid leaking
      // which usernames exist or are currently locked out.
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // T-B9 AC-28.1: SUPER_ADMIN without MFA must set up MFA before gaining
    // full access. Issue a scoped partial session that only permits MFA setup.
    if (auth.user.role === "super_admin" && !auth.record.mfa_enabled) {
      const partial = await createAdminSession(
        auth.user.id,
        { ip, userAgent },
        { mfaVerified: false, scope: "mfa_setup" }
      );
      const partialResponse = NextResponse.json({
        success: false,
        mfaRequired: true,
        nextStep: "setup",
        user: {
          id: auth.user.id,
          username: auth.user.username,
          role: auth.user.role,
          mfaEnabled: false,
        },
        partialSessionToken: partial.sessionId,
      });
      partialResponse.cookies.set(ADMIN_COOKIE_NAME, encodeURIComponent(partial.sessionId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return partialResponse;
    }

    // V2 §17: Accounts with MFA enabled require a TOTP second factor.
    let mfaVerified = false;
    if (auth.record.mfa_enabled) {
      if (!parsed.data.totp) {
        return NextResponse.json(
          { success: false, error: "MFA code required", mfaRequired: true },
          { status: 401 }
        );
      }
      if (!verifyTotp(auth.record.mfa_secret, parsed.data.totp)) {
        // §18: a valid password with a wrong second factor must not grant an
        // unlimited TOTP-guessing oracle — count it against the same lockout.
        await recordLoginFailure(parsed.data.username, ip);
        return NextResponse.json(
          { success: false, error: "Invalid MFA code", mfaRequired: true },
          { status: 401 }
        );
      }
      mfaVerified = true;
    }

    const { sessionId } = await createAdminSession(
      auth.user.id,
      { ip, userAgent },
      { mfaVerified }
    );
    const response = NextResponse.json({
      success: true,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
        permissions: auth.user.permissions,
        mfaEnabled: auth.record.mfa_enabled,
        mfaVerified,
      },
    });

    response.cookies.set(ADMIN_COOKIE_NAME, encodeURIComponent(sessionId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (err) {
    console.error(`[login] requestId=${requestId} login failed:`, err);
    return NextResponse.json(
      { success: false, error: "An internal error occurred.", requestId },
      { status: 500 }
    );
  }
}
