import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import { db, seedDatabase } from "@/lib/database";
import { courseCreateSchema } from "@/lib/validation/schemas";

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    await seedDatabase();
    const activeOnlyParam = req.nextUrl.searchParams.get("activeOnly");
    const activeOnly = activeOnlyParam === "true";
    const courses = await db.courses.list(activeOnly);
    const coursesWithModules = await Promise.all(
      courses.map(async (c) => ({
        ...c,
        modules: await db.courseModules.findByCourseId(c.id, true),
      }))
    );
    return jsonResponse({ success: true, data: coursesWithModules });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to list courses", 500);
  }
});

export const POST = withAdminAuth("manageTemplates", async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = courseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const course = await db.courses.create({
      code: parsed.data.code,
      title: parsed.data.title,
      duration: parsed.data.duration,
      active: true,
    });

    if (parsed.data.modules) {
      for (const mod of parsed.data.modules) {
        await db.courseModules.create({
          course_id: course.id,
          sort_order: mod.order,
          title: mod.title,
          subtitle: mod.subtitle || null,
          active: true,
        });
      }
    }

    return jsonResponse({ success: true, course }, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to create course", 500);
  }
});
