import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, jsonResponse, errorResponse, serviceErrorResponse } from "@/lib/middleware/auth";
import { db, seedDatabase } from "@/lib/database";
import { moduleSchema } from "@/lib/validation/schemas";
import { DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";

const courseModulesPatchSchema = z
  .array(moduleSchema)
  .superRefine((val, ctx) => {
    const activeModules = val.filter((m) => m.title.trim().length > 0);
    const { minCount, maxCount } = DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints;
    if (minCount === maxCount) {
      if (activeModules.length !== minCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `This template requires exactly ${minCount} active modules — you have ${activeModules.length}`,
        });
      }
    } else {
      if (activeModules.length < minCount || activeModules.length > maxCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `This template requires between ${minCount} and ${maxCount} active modules — you have ${activeModules.length}`,
        });
      }
    }
  });

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
    return serviceErrorResponse(err, "Failed to fetch course");
  }
});

export const PATCH = withAdminAuth("MANAGE_COURSES", async (req: NextRequest, { params }) => {
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

    // Full module replacement when a modules array is supplied. The update is
    // performed transactionally via the update_course_with_modules RPC (§18):
    // course fields + module grid commit or roll back together, so a mid-way
    // failure can never leave a course with new fields but an empty module set.
    if ("modules" in body) {
      const parsed = courseModulesPatchSchema.safeParse(body.modules);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            errors: parsed.error.issues.map((i) =>
              i.path.length > 0 ? `Module ${i.path[0]}: ${i.message}` : i.message
            ),
          },
          { status: 400 }
        );
      }
      const result = await db.courses.updateWithModules(
        courseId,
        fields as Omit<Partial<import("@/lib/types").CourseRecord>, "id" | "created_at" | "updated_at">,
        parsed.data.map((mod) => ({
          sort_order: mod.order,
          title: mod.title,
          subtitle: mod.subtitle || null,
          active: true,
        }))
      );
      if (!result.course) {
        return errorResponse("Course not found while saving modules", 404);
      }
      return jsonResponse({ success: true, course: result.course, modules: result.modules });
    }

    const modules = await db.courseModules.findByCourseId(courseId, false);
    return jsonResponse({ success: true, course: updated || existing, modules });
  } catch (err) {
    return serviceErrorResponse(err, "Failed to update course");
  }
});
