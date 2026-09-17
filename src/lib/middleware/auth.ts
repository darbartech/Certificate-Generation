import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Redis from "ioredis";
import { resolveSessionWithCache, checkPermission } from "@/lib/services/authService";
import { isPersistenceUnavailableError } from "@/lib/database";
import { isCertificateStorageError } from "@/lib/services/storageService";
import { isSealedError } from "@/lib/errors";
import type { AdminUser } from "@/lib/types";

export const ADMIN_COOKIE_NAME = "dt_admin_session";

export type ApiHandler = (
  req: NextRequest,
  ctx: {
    params?: Record<string, string>;
    user?: AdminUser;
    requestId?: string;
    ip?: string;
    userAgent?: string;
  }
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
      // CSRF / origin protection (§56): state-changing requests must come from
      // a known origin. SameSite=Strict on the session cookie is defense-in-
      // depth, not the only control. Browsers always send Origin on mutating
      // requests; mismatches are rejected. Non-browser clients that omit Origin
      // still require the auth cookie, so they cannot be scripted cross-site.
      const originError = assertStateChangingOrigin(req);
      if (originError) {
        return NextResponse.json(
          { success: false, error: "Request origin rejected" },
          { status: 403 }
        );
      }

      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`(?:^|; )${ADMIN_COOKIE_NAME}=([^;]+)`));
      const token = match ? decodeURIComponent(match[1]) : null;

      if (!token) {
        return NextResponse.json(
          { success: false, error: "Not authenticated" },
          { status: 401 }
        );
      }

      const user = await resolveSessionWithCache(token);
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

      // T-B9 AC-28.1: Partial session (scope=mfa_setup) only allows MFA
      // setup endpoints. Any other route is rejected before anything else.
      const requestPath = req.nextUrl.pathname;
      const isMfaSetupRoute = requestPath.startsWith("/api/admin/me/mfa");
      if (user.sessionInfo?.scope === "mfa_setup" && !isMfaSetupRoute) {
        return NextResponse.json(
          {
            success: false,
            error: "MFA setup required before accessing admin features",
            mfaRequired: true,
            nextStep: "setup",
          },
          { status: 403 }
        );
      }

      // Applied here, centrally, so every /api/admin/* route is throttled by
      // default — new routes get it automatically without remembering to wire
      // it up. Bucket is keyed by user + IP so a leaked session cookie can't
      // be scripted into an unlimited flood of authenticated mutations.
      const rateLimit = await validateRateLimit(`${user.id}:${getClientIp(req)}`);
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

      // T-B9 AC-28.2: Privileged operations require an MFA-verified session.
      const MFA_REQUIRED_PERMISSIONS = new Set<string>([
        "REVOKE_CERTIFICATE",
        "REISSUE_CERTIFICATE",
        "MANAGE_ADMINS",
        "MANAGE_SETTINGS",
        "MANAGE_TEMPLATES",
        "MANAGE_SIGNATORIES",
      ]);

      const requestId = getOrCreateRequestId(req);

      if (requiredPermission && MFA_REQUIRED_PERMISSIONS.has(requiredPermission as string)) {
        const sessionMfaVerified = user.sessionInfo?.mfa_verified === true;
        if (!sessionMfaVerified) {
          return NextResponse.json(
            {
              success: false,
              error: "MFA verification required for this operation",
              requestId,
            },
            { status: 403 }
          );
        }
      }
      const ip = getClientIp(req);
      const userAgent = req.headers.get("user-agent") || undefined;

      const response = await handler(req, { ...ctx, user, requestId, ip, userAgent });
      response.headers.set("x-request-id", requestId);
      return response;
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

// V2 §20: a dependency outage (database or artifact storage) is a 503 Service
// Unavailable with a retryable message, never a generic 500. Callers pass the
// caught error; we classify it centrally so every route behaves consistently.
export const serviceErrorResponse = (
  err: unknown,
  fallbackMessage = "An internal error occurred.",
  requestId?: string
): NextResponse => {
  if (isPersistenceUnavailableError(err)) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code, retryable: true, requestId },
      { status: err.statusCode }
    );
  }
  if (isCertificateStorageError(err)) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code, retryable: true, requestId },
      { status: err.statusCode }
    );
  }
  if (isSealedError(err)) {
    switch (err.type) {
      case "InvalidStateTransitionError":
        return NextResponse.json(
          { success: false, error: "Request conflicts with current certificate state", code: err.code, requestId },
          { status: err.statusCode }
        );
      case "CertificateIntegrityError":
        return NextResponse.json(
          { success: false, error: err.retryable ? "Certificate artifact storage temporarily unavailable" : "Invalid certificate artifact", code: err.code, retryable: err.retryable, requestId },
          { status: err.statusCode }
        );
      case "AuthoritativeInputError":
        return NextResponse.json(
          { success: false, error: "Invalid certificate issuance parameters", code: err.code, requestId },
          { status: err.statusCode }
        );
    }
  }
  // V2 §20: never surface an unexpected error's raw message, which can leak
  // database/SQL/storage details. Log the real error server-side instead.
  console.error(`[api]${requestId ? ` requestId=${requestId}` : ""} unhandled error:`, err);
  return NextResponse.json(
    { success: false, error: fallbackMessage, requestId },
    { status: 500 }
  );
};

// ---------------------------------------------------------------------------
// Rate limiting (§37)
// ---------------------------------------------------------------------------
// Async, distributed-capable. When REDIS_URL is configured, the same bucket
// counters are shared across instances (fixed window via INCR + PEXPIRE). When
// it is absent — or Redis is temporarily unreachable — counters fall back to
// per-instance in-memory buckets, so a Redis outage throttles rather than
// failing the request open.

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backend: "redis" | "memory";
};

const REDIS_RATE_LIMIT_PREFIX = "dt:rl:";

let sharedRedisClient: Redis | null = null;
let redisUnavailableUntil = 0;

const getSharedRedisClient = (): Redis | null => {
  if (sharedRedisClient || !process.env.REDIS_URL) return sharedRedisClient;
  sharedRedisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => (times > 3 ? null : 100 * times),
  });
  sharedRedisClient.on("error", () => {
    // Errors surface at the call site; mark Redis unavailable briefly so a dead
    // instance isn't hammered on every request.
    redisUnavailableUntil = Date.now() + 15_000;
  });
  return sharedRedisClient;
};

export const createRateLimiter = (
  maxRequests: number,
  windowMs: number,
  limiterName: string
): ((identifier: string) => Promise<RateLimitResult>) => {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const checkMemory = (identifier: string): RateLimitResult => {
    const now = Date.now();
    let bucket = buckets.get(identifier);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(identifier, bucket);
    }
    bucket.count++;
    return {
      allowed: bucket.count <= maxRequests,
      remaining: Math.max(0, maxRequests - bucket.count),
      resetAt: bucket.resetAt,
      backend: "memory",
    };
  };

  return async (identifier: string): Promise<RateLimitResult> => {
    const redis = process.env.REDIS_URL ? getSharedRedisClient() : null;
    if (redis && Date.now() > redisUnavailableUntil) {
      try {
        const key = `${REDIS_RATE_LIMIT_PREFIX}${limiterName}:${identifier}`;
        const now = Date.now();
        const count = await redis.incr(key);
        if (count === 1) await redis.pexpire(key, windowMs);
        const ttl = await redis.pttl(key);
        const resetAt = ttl > 0 ? now + ttl : now + windowMs;
        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
          resetAt,
          backend: "redis",
        };
      } catch (err) {
        console.error(`[rate-limit] Redis unavailable for "${limiterName}" — falling back to in-memory.`, err);
      }
    }
    return checkMemory(identifier);
  };
};

// General-purpose limit for authenticated admin API routes.
export const validateRateLimit = createRateLimiter(30, 60 * 1000, "admin");

// Stricter limit specifically for the login endpoint (per IP), since it's
// the most brute-forceable route in the app.
export const validateLoginRateLimit = createRateLimiter(10, 5 * 60 * 1000, "login");

// V2 §31: public verification rate limits (per IP). The token route is 30/min
// — tokens are high-entropy random strings so enumeration is infeasible even at
// this rate; the manual route is 10/min since certificate numbers follow a
// predictable (prefix-year-sequence) format that an attacker could brute-force.
export const validatePublicVerifyByToken = createRateLimiter(30, 60 * 1000, "verify-token");
export const validatePublicVerifyManual = createRateLimiter(10, 60 * 1000, "verify-manual");

// V2 §19: forwarding headers are only trustworthy when the request actually
// arrived through the configured reverse proxy. Deployments that are not behind
// a trusted proxy must NOT let a client spoof its own IP (used for rate-limit
// bucketing and login event auditing) by sending x-forwarded-for.
const trustForwardedHeaders = (): boolean =>
  process.env.TRUSTED_PROXY_MODE === "true" || process.env.TRUST_PROXY === "true";

export const getClientIp = (req: NextRequest): string => {
  if (trustForwardedHeaders()) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  // Direct connection address when available; otherwise an explicit sentinel so
  // callers never treat an unknown value as a real, attacker-controlled IP.
  const direct = (req as unknown as { ip?: string }).ip;
  return direct || "unknown";
};

// V2 §21: one request ID flows middleware → services → audit → logs. An inbound
// `x-request-id` (set by the trusted proxy) is preserved for end-to-end tracing;
// otherwise one is generated.
export const getOrCreateRequestId = (req: NextRequest): string => {
  const inbound = req.headers.get("x-request-id");
  if (inbound && /^[A-Za-z0-9._-]{8,128}$/.test(inbound)) return inbound;
  return crypto.randomUUID();
};

// ---------------------------------------------------------------------------
// CSRF / origin protection (§56)
// ---------------------------------------------------------------------------
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const getAllowedOrigins = (req: NextRequest): Set<string> => {
  const origins = new Set<string>();
  for (const raw of [
    process.env.VERIFY_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERIFY_URL,
  ]) {
    if (raw && raw.trim()) origins.add(raw.trim().replace(/\/+$/, ""));
  }
  const host = req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    origins.add(`${proto}://${host}`);
  }
  return origins;
};

export const assertStateChangingOrigin = (req: NextRequest): string | null => {
  if (!STATE_CHANGING_METHODS.has(req.method)) return null;
  const origin = req.headers.get("origin");
  // No Origin header → non-browser client; the auth cookie (SameSite=Strict +
  // httpOnly) cannot be attached by a cross-site form, so this is acceptable.
  if (!origin) return null;
  const normalized = origin.replace(/\/+$/, "");
  if (getAllowedOrigins(req).has(normalized)) return null;
  return `Origin "${origin}" is not an allowed origin for ${req.method} on this deployment.`;
};
