import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// V2 §38: liveness probe. Only answers whether the process is running — no
// dependency checks, so a slow database never causes a healthy process to be
// restarted.
export async function GET() {
  return NextResponse.json({ status: "live" });
}
