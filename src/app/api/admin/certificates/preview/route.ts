import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/middleware/auth";
import { certificateCreateSchema } from "@/lib/validation/schemas";
import {
  generateCertificatePreview,
  validateCourseData,
} from "@/lib/services/certificateService";
import { db } from "@/lib/database";
import type { AdminUser } from "@/lib/types";

export const POST = withAdminAuth("preview", async (req: NextRequest, { user }) => {
  try {
    const body = await req.json();
    const parsed = certificateCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const courseErrors = await validateCourseData(parsed.data, "preview");
    if (courseErrors.length > 0) {
      return NextResponse.json(
        { success: false, errors: courseErrors },
        { status: 400 }
      );
    }

    const result = await generateCertificatePreview(parsed.data);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, errors: result.errors || ["Preview generation failed"] },
        { status: 400 }
      );
    }

    try {
      const previewBase64 = result.data.toString("base64");
      return NextResponse.json({
        success: true,
        preview: `data:application/pdf;base64,${previewBase64}`,
        contentType: result.contentType,
        warnings: result.errors,
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, errors: [err instanceof Error ? err.message : "Preview error"] },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
});
