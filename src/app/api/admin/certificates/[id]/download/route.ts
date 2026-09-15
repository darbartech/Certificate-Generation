import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, errorResponse } from "@/lib/middleware/auth";
import { downloadCertificatePdf } from "@/lib/services/certificateService";

export const GET = withAdminAuth("download", async (_req: NextRequest, { params }) => {
  try {
    const certificateId = params?.id;
    if (!certificateId) {
      return errorResponse("Certificate ID is required", 400);
    }

    const result = await downloadCertificatePdf(certificateId);
    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { success: false, errors: result.errors },
        { status: 400 }
      );
    }

    const uint8 = new Uint8Array(result.buffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": result.contentType!,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": uint8.length.toString(),
      },
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Download failed", 500);
  }
});
