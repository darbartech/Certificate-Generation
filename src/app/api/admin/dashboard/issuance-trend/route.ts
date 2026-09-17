import { NextRequest } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { getIssuanceTrend } from "@/lib/services/dashboardService";

export const GET = withAdminAuth("VIEW_CERTIFICATES", async (req: NextRequest) => {
  try {
    const weeksParam = req.nextUrl.searchParams.get("weeks");
    const weeks = Math.min(Math.max(parseInt(weeksParam || "12", 10) || 12, 1), 52);
    const trend = await getIssuanceTrend(weeks);
    return jsonResponse({ success: true, data: trend });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to load issuance trend");
  }
});