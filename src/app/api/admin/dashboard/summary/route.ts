import { withAdminAuth, jsonResponse } from "@/lib/middleware/auth";
import { getDashboardSummary } from "@/lib/services/dashboardService";

export const GET = withAdminAuth(async () => {
  const summary = await getDashboardSummary();
  return jsonResponse({ success: true, data: summary });
});