import { NextRequest, NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validation/schemas";
import { authenticateAdmin, generateSessionToken } from "@/lib/services/authService";
import { ADMIN_COOKIE_NAME, validateLoginRateLimit, getClientIp } from "@/lib/middleware/auth";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = validateLoginRateLimit(`login:${ip}`);

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

    const user = await authenticateAdmin(parsed.data.username, parsed.data.password);
    if (!user) {
      // Deliberately generic: don't distinguish "wrong password", "unknown
      // username", or "account locked" in the response, to avoid leaking
      // which usernames exist or are currently locked out.
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const sessionToken = generateSessionToken(user);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
      },
    });

    response.cookies.set(ADMIN_COOKIE_NAME, encodeURIComponent(sessionToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
