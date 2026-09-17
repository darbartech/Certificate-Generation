import { withAdminAuth, jsonResponse } from "@/lib/middleware/auth";
import { getDatabaseHealth } from "@/lib/database";

// Read-only health surface for the admin UI. Exposes the per-table circuit
// breaker state so a Supabase degradation is visible to admins (via the
// AdminLayout banner) instead of silently writing to ephemeral memory.
export const GET = withAdminAuth(async () => {
  return jsonResponse({ success: true, ...getDatabaseHealth() });
});
