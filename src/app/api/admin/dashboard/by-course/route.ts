import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { getCertificatesByCourse } from "@/lib/services/dashboardService";

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const daysParam = req.nextUrl.searchParams.get("days");
    const limit = Math.min(Math.max(parseInt(limitParam || "5", 10) || 5, 1), 20);
    const days = Math.min(Math.max(parseInt(daysParam || "90", 10) || 90, 1), 3650);
    const byCourse = await getCertificatesByCourse(limit, days);
    return jsonResponse({ success: true, data: byCourse });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to load course breakdown", 500);
  }
});