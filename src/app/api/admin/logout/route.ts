import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/middleware/auth";
import { revokeSession } from "@/lib/services/authService";

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${ADMIN_COOKIE_NAME}=([^;]+)`));
  const sessionId = match ? decodeURIComponent(match[1]) : null;

  // V2 §16: revoke server-side first, so the session is dead even if the
  // client discards the cookie response.
  if (sessionId) {
    try {
      await revokeSession(sessionId);
    } catch (err) {
      console.error("[auth] Failed to revoke session on logout:", err);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
