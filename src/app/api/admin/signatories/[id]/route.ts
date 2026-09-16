import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { db, seedDatabase } from "@/lib/database";

export const GET = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    await seedDatabase();
    const signatoryId = params?.id;
    if (!signatoryId) {
      return errorResponse("Signatory ID is required", 400);
    }
    const signatory = await db.signatories.findById(signatoryId);
    if (!signatory) {
      return errorResponse("Signatory not found", 404);
    }
    return jsonResponse({ success: true, signatory });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to fetch signatory", 500);
  }
});

export const PATCH = withAdminAuth("manageTemplates", async (req: NextRequest, { params }) => {
  try {
    await seedDatabase();
    const signatoryId = params?.id;
    if (!signatoryId) {
      return errorResponse("Signatory ID is required", 400);
    }

    const existing = await db.signatories.findById(signatoryId);
    if (!existing) {
      return errorResponse("Signatory not found", 404);
    }

    const body = await req.json();

    const fields: Partial<{
      name: string;
      position: string;
      active: boolean;
      is_default_secondary: boolean;
    }> = {};
    for (const key of ["name", "position"] as const) {
      if (typeof body[key] === "string" && body[key].trim().length > 0) {
        fields[key] = body[key].trim();
      }
    }
    if (typeof body.active === "boolean") {
      fields.active = body.active;
    }
    if (typeof body.isDefaultSecondary === "boolean") {
      fields.is_default_secondary = body.isDefaultSecondary;
    }

    if (fields.is_default_secondary) {
      const allSignatories = await db.signatories.list(false);
      for (const s of allSignatories) {
        if (s.id !== signatoryId && s.is_default_secondary) {
          await db.signatories.update(s.id, { is_default_secondary: false });
        }
      }
    }

    if (Object.keys(fields).length === 0) {
      return errorResponse("No updatable fields provided");
    }

    const updated = await db.signatories.update(signatoryId, fields);
    if (!updated) {
      return errorResponse("Failed to update signatory", 500);
    }

    return jsonResponse({ success: true, signatory: updated });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to update signatory", 500);
  }
});