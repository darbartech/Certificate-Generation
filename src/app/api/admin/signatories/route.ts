import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { db, seedDatabase } from "@/lib/database";
import { signatoryCreateSchema } from "@/lib/validation/schemas";

export const GET = withAdminAuth(async () => {
  try {
    await seedDatabase();
    const signatories = await db.signatories.list(true);
    return jsonResponse({ success: true, data: signatories });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to list signatories");
  }
});

export const POST = withAdminAuth("MANAGE_SIGNATORIES", async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = signatoryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    if (parsed.data.isDefaultSecondary) {
      const allSignatories = await db.signatories.list(false);
      for (const s of allSignatories) {
        if (s.is_default_secondary) {
          await db.signatories.update(s.id, { is_default_secondary: false });
        }
      }
    }

    const signatory = await db.signatories.create({
      name: parsed.data.name,
      position: parsed.data.position,
      signature_storage_key: parsed.data.signatureImage || null,
      active: parsed.data.active !== false,
      is_default_secondary: parsed.data.isDefaultSecondary === true,
    });

    return jsonResponse({ success: true, signatory }, 201);
  } catch (err) {
    return serviceErrorResponse(err, "Failed to create signatory");
  }
});
