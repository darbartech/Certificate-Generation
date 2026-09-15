import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, checkPermission } from "@/lib/services/authService";
import type { AdminUser } from "@/lib/types";

export const ADMIN_COOKIE_NAME = "dt_admin_session";

export type ApiHandler = (
  req: NextRequest,
  ctx: { params?: Record<string, string>; user?: AdminUser }
) => Promise<NextResponse>;

type PermissionKey = keyof AdminUser["permissions"];

export const withAdminAuth = (
  handlerOrPermission: ApiHandler | PermissionKey,
  maybeHandler?: ApiHandler
) => {
  const handler: ApiHandler = typeof handlerOrPermission === "function"
    ? handlerOrPermission
    : (maybeHandler as ApiHandler);
  const requiredPermission: PermissionKey | undefined = typeof handlerOrPermission === "function"
    ? undefined
    : handlerOrPermission;

  return async (req: NextRequest, ctx: { params?: Record<string, string> }) => {
    try {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`(?:^|; )${ADMIN_COOKIE_NAME}=([^;]+)`));
      const token = match ? decodeURIComponent(match[1]) : null;

      if (!token) {
        return NextResponse.json(
          { success: false, error: "Not authenticated" },
          { status: 401 }
        );
      }

      const user = parseSessionToken(token);
      if (!user) {
        const response = NextResponse.json(
          { success: false, error: "Session expired" },
          { status: 401 }
        );
        response.cookies.set(ADMIN_COOKIE_NAME, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 0,
        });
        return response;
      }

      // Applied here, centrally, so every /api/admin/* route is throttled by
      // default — new routes get it automatically without remembering to wire
      // it up. Bucket is keyed by user + IP so a leaked session cookie can't
      // be scripted into an unlimited flood of authenticated mutations.
      const rateLimit = validateRateLimit(`${user.id}:${getClientIp(req)}`);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
          }
        );
      }

      if (requiredPermission && !checkPermission(user, requiredPermission)) {
        return NextResponse.json(
          { success: false, error: "Insufficient permissions" },
          { status: 403 }
        );
      }

      return handler(req, { ...ctx, user });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: "Authentication error" },
        { status: 500 }
      );
    }
  };
};

export const jsonResponse = (data: unknown, status = 200): NextResponse => {
  return NextResponse.json(data, { status });
};

export const errorResponse = (message: string, status = 400): NextResponse => {
  return NextResponse.json({ success: false, error: message }, { status });
};

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// In-memory, per-instance. Fine for a single-instance deployment; move to
// Supabase/Redis if you scale horizontally.

export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (identifier: string): { allowed: boolean; remaining: number; resetAt: number } => {
    const now = Date.now();
    let bucket = buckets.get(identifier);

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(identifier, bucket);
    }

    bucket.count++;
    const remaining = Math.max(0, maxRequests - bucket.count);
    return {
      allowed: bucket.count <= maxRequests,
      remaining,
      resetAt: bucket.resetAt,
    };
  };
};

// General-purpose limit for authenticated admin API routes.
export const validateRateLimit = createRateLimiter(30, 60 * 1000);

// Stricter limit specifically for the login endpoint (per IP), since it's
// the most brute-forceable route in the app.
export const validateLoginRateLimit = createRateLimiter(10, 5 * 60 * 1000);

export const getClientIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
};
