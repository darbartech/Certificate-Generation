import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { db, seedDatabase } from "@/lib/database";
import { moduleSchema } from "@/lib/validation/schemas";

const courseModulesPatchSchema = z.array(moduleSchema);

export const GET = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    await seedDatabase();
    const courseId = params?.id;
    if (!courseId) {
      return errorResponse("Course ID is required", 400);
    }
    const course = await db.courses.findById(courseId);
    if (!course) {
      return errorResponse("Course not found", 404);
    }
    const modules = await db.courseModules.findByCourseId(courseId, false);
    return jsonResponse({ success: true, course, modules });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to fetch course", 500);
  }
});

export const PATCH = withAdminAuth("manageTemplates", async (req: NextRequest, { params }) => {
  try {
    await seedDatabase();
    const courseId = params?.id;
    if (!courseId) {
      return errorResponse("Course ID is required", 400);
    }

    const existing = await db.courses.findById(courseId);
    if (!existing) {
      return errorResponse("Course not found", 404);
    }

    const body = await req.json();

    const fields: Partial<{ code: string; title: string; duration: string; active: boolean }> = {};
    for (const key of ["code", "title", "duration"] as const) {
      if (typeof body[key] === "string" && body[key].trim().length > 0) {
        fields[key] = body[key].trim();
      }
    }
    if (typeof body.active === "boolean") {
      fields.active = body.active;
    }

    const updated = await db.courses.update(courseId, fields);

    // Full module replacement when a modules array is supplied. Delete-then-
    // create gives the simplest correct behavior for the UI's module editor.
    if ("modules" in body) {
      const parsed = courseModulesPatchSchema.safeParse(body.modules);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            errors: parsed.error.issues.map((i) => `Module ${i.path[0] ?? 0}: ${i.message}`),
          },
          { status: 400 }
        );
      }
      await db.courseModules.deleteByCourseId(courseId);
      for (const mod of parsed.data) {
        await db.courseModules.create({
          course_id: courseId,
          sort_order: mod.order,
          title: mod.title,
          subtitle: mod.subtitle || null,
          active: true,
        });
      }
    }

    const modules = await db.courseModules.findByCourseId(courseId, false);
    return jsonResponse({ success: true, course: updated || existing, modules });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to update course", 500);
  }
});