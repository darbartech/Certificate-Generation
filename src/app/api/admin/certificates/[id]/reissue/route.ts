import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonResponse, errorResponse } from "@/lib/middleware/auth";
import {
  certificateReissueSchema,
  certificateCreateSchema,
  type CertificateCreateInput,
} from "@/lib/validation/schemas";
import {
  reissueCertificate,
  getCertificateWithModules,
  validateCourseData,
} from "@/lib/services/certificateService";
import type { AdminUser } from "@/lib/types";

export const POST = withAdminAuth("issue", async (req: NextRequest, { params, user }) => {
  try {
    const certificateId = params?.id;
    if (!certificateId) {
      return errorResponse("Certificate ID is required", 400);
    }

    const body = await req.json();
    const parsed = certificateReissueSchema.safeParse({ id: certificateId, ...body });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    if (parsed.data.refreshCourseData && parsed.data.updates) {
      const refreshValidation = certificateCreateSchema.safeParse({
        recipient: parsed.data.updates.recipient || { name: "placeholder" },
        program: parsed.data.updates.program,
        modules: parsed.data.updates.modules,
        grade: parsed.data.updates.grade ?? "",
        completionDate: parsed.data.updates.completionDate ?? "",
        issueDate: parsed.data.updates.issueDate || new Date().toISOString().slice(0, 10),
        signatory: parsed.data.updates.signatory || {
          name: "placeholder",
          position: "placeholder",
        },
      });
      if (refreshValidation.success) {
        const courseErrors = await validateCourseData(
          refreshValidation.data as CertificateCreateInput
        );
        if (courseErrors.length > 0) {
          return NextResponse.json(
            { success: false, errors: courseErrors },
            { status: 400 }
          );
        }
      }
    }

    const result = await reissueCertificate(
      parsed.data.id,
      parsed.data.reason,
      parsed.data.updates || {},
      (user as AdminUser).id,
      parsed.data.refreshCourseData
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.errors || ["Reissue failed"] },
        { status: 400 }
      );
    }

    const certWithModules = await getCertificateWithModules(result.certificate!.id);
    return jsonResponse({
      success: true,
      certificate: certWithModules?.certificate || result.certificate,
      modules: certWithModules?.modules || result.modules,
      message: "Certificate reissued successfully",
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Reissue failed", 500);
  }
});
