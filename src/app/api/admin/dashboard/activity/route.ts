import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { getRecentActivity } from "@/lib/services/dashboardService";

export const GET = withAdminAuth("VIEW_CERTIFICATES", async (req: NextRequest) => {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "15", 10) || 15, 1), 50);
    const activity = await getRecentActivity(limit);
    return jsonResponse({ success: true, data: activity });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load activity");
  }
});