import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_SECURITY_HEADERS: Record<string, string> = {
  // §35 Content Security Policy: non-breaking strict baseline.
  // 'unsafe-inline' required by Next.js hydration runtime; tighten by adding
  // nonces hashes in a future iteration.
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
    "style-src 'self' 'unsafe-inline' https: fonts.googleapis.com; " +
    "font-src 'self' fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';",
  // HSTS: 1 year, include subdomains, preload eligibility
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // Never sniff MIME type (blocks polyglot XSS payloads)
  "X-Content-Type-Options": "nosniff",
  // Referrer: send full origin only to same-site HTTPS destinations, no origin on downgrade
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Disable unused powerful APIs by default
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.NODE_ENV === "production") {
    for (const [name, value] of Object.entries(PRODUCTION_SECURITY_HEADERS)) {
      res.headers.set(name, value);
    }
  } else {
    // Non-production: still set X-Content-Type-Options and frame-ancestors as defense-in-depth
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return res;
}

// Apply broadly — covers pages + API routes.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|logo-small\\.png).*)"],
};
