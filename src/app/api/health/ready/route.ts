import { NextResponse } from "next/server";
import { getReadiness } from "@/lib/services/healthService";

export const dynamic = "force-dynamic";

// V2 §38: readiness probe. Returns 200 only when the instance can actually
// serve certificate work; 503 otherwise so load balancers stop routing to it.
export async function GET() {
  const report = await getReadiness();
  return NextResponse.json(report, { status: report.status === "ready" ? 200 : 503 });
}
