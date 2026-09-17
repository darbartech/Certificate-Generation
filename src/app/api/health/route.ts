import { NextResponse } from "next/server";
import { getReadiness } from "@/lib/services/healthService";

export const dynamic = "force-dynamic";

// V2 §38: combined health summary. Same data as /ready but always 200 so a
// human or dashboard can read the component states without special-casing.
export async function GET() {
  const report = await getReadiness();
  return NextResponse.json(report, { status: 200 });
}
