import { db } from "@/lib/database";
import {
  DARBARTECH_CERTIFICATE_TEMPLATE,
  DARBARTECH_CERTIFICATE_TEMPLATE_V2,
  DEFAULT_PUBLIC_FIELDS,
  DEFAULT_PUBLIC_FIELDS_V2,
  getTemplateById,
} from "@/lib/templates/darbartech-certificate-v2";
import { certificateCreateSchema, type CertificateCreateInput } from "@/lib/validation/schemas";
import { generateCertificateNumber, generateStudentId } from "./numberingService";
import { generateVerificationToken, getVerificationUrl } from "./verificationService";
import { logEvent } from "./auditService";
import { storageService } from "./storageService";
import { certificateRenderer } from "@/lib/renderer/certificateRenderer";
import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateRenderInput,
  CertificateModule,
  RenderResult,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
} from "@/lib/types";

const TEMPLATE_ID = "darbartech-certificate";
const TEMPLATE_VERSION = "2.0.0";
const RENDERER_VERSION = "certificate-engine 2.0.0";
const ISSUER_NAME = "DarbarTech Group of Technology";

// Organisation-wide default for the secondary (Managing Director) signatory.
// Kept at the service layer so auditors and future maintainers can change it
// in one obvious place, instead of hiding a fallback inside the renderer.
// To remove: override via explicit secondarySignatory on every certificate create,
// or delete this constant and drop the ?? fallback inside buildRenderInput.
const DEFAULT_SECONDARY_SIGNATORY: SignatoryRecord = {
  id: "default-managing-director",
  name: "Nirmala Shrestha",
  position: "Managing director",
  active: true,
};

export type CreateCertificateResult = {
  success: boolean;
  certificate?: CertificateRecord;
  modules?: CertificateModuleRecord[];
  errors?: string[];
};

type CourseSnapshotTaken = {
  takenAt: string;
  course: CourseRecord | null;
  modules: CourseModuleRecord[];
};

type CertificateDataSnapshotEnvelope = {
  schemaVersion: 1;
  courseSnapshot: CourseSnapshotTaken;
  certificateInput: CertificateCreateInput;
};

const validateInput = (input: CertificateCreateInput): string[] => {
  const result = certificateCreateSchema.safeParse(input);
  if (!result.success) {
    return result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  }
  return [];
};

async function buildSnapshotEnvelope(
  input: CertificateCreateInput
): Promise<CertificateDataSnapshotEnvelope> {
  let course: CourseRecord | null = null;
  let courseModules: CourseModuleRecord[] = [];
  if (input.program.id) {
    course = await db.courses.findById(input.program.id);
    if (course) {
      courseModules = await db.courseModules.findByCourseId(course.id, false);
    }
  }
  return {
    schemaVersion: 1,
    courseSnapshot: {
      takenAt: new Date().toISOString(),
      course,
      modules: courseModules,
    },
    certificateInput: input,
  };
}

const buildRenderInput = (
  data: CertificateCreateInput,
  certificateNumber: string,
  verificationToken: string
): CertificateRenderInput => {
  const sortedModules = [...data.modules]
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      order: m.order,
      title: m.title,
      subtitle: m.subtitle,
    }));

  const trainingProvider =
    (data as unknown as { providerName?: string }).providerName || ISSUER_NAME;

  return {
    templateId: (data as unknown as { certificateTemplateId?: string }).certificateTemplateId || TEMPLATE_ID,
    templateVersion:
      (data as unknown as { certificateTemplateVersion?: string }).certificateTemplateVersion ||
      TEMPLATE_VERSION,
    rendererVersion: RENDERER_VERSION,
    certificateNumber,
    recipient: {
      name: data.recipient.name,
    },
    program: {
      title: data.program.title,
      duration: data.program.duration,
    },
    trainingProvider,
    modules: sortedModules,
    grade: data.grade || undefined,
    completionDate: data.completionDate || undefined,
    issueDate: data.issueDate,
    signatory: {
      name: data.signatory.name,
      position: data.signatory.position,
      signatureAsset: data.signatory.signatureImage,
    },
    secondarySignatory: {
      name:
        (data as unknown as { secondarySignatory?: { name?: string } }).secondarySignatory?.name ??
        DEFAULT_SECONDARY_SIGNATORY.name,
      position:
        (data as unknown as { secondarySignatory?: { position?: string } }).secondarySignatory?.position ??
        DEFAULT_SECONDARY_SIGNATORY.position,
      signatureAsset:
        (data as unknown as { secondarySignatory?: { signatureImage?: string } }).secondarySignatory
          ?.signatureImage ?? undefined,
    },
    verificationUrl: getVerificationUrl(verificationToken),
  };
};

export const createDraftCertificate = async (
  input: CertificateCreateInput,
  actorId?: string
): Promise<CreateCertificateResult> => {
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const verificationToken = generateVerificationToken();

  const certificateNumber = input.manualCertificateNumber
    ? input.manualCertificateNumber
    : `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const snapshotEnvelope = await buildSnapshotEnvelope(input);

  const cert = await db.certificates.create({
    certificate_number: certificateNumber,
    verification_token: verificationToken,
    template_id: TEMPLATE_ID,
    template_version: TEMPLATE_VERSION,
    renderer_version: RENDERER_VERSION,
    recipient_name: input.recipient.name,
    student_id: input.recipient.studentId || null,
    program_id: input.program.id || null,
    program_title: input.program.title,
    duration: input.program.duration,
    completion_date: input.completionDate || null,
    issue_date: input.issueDate,
    grade: input.grade || null,
    status: "DRAFT",
    signatory_id: input.signatory.id || null,
    signatory_name_snapshot: input.signatory.name,
    signatory_position_snapshot: input.signatory.position,
    public_visibility: DEFAULT_PUBLIC_FIELDS_V2,
    data_snapshot: snapshotEnvelope as unknown as Record<string, unknown>,
  });

  const moduleRecords = await db.certificateModules.bulkCreate(
    input.modules.map((m) => ({
      certificate_id: cert.id,
      sort_order: m.order,
      title: m.title,
      subtitle: m.subtitle || null,
    }))
  );

  await logEvent(cert.id, "CREATED", actorId, {
    recipientName: input.recipient.name,
    programTitle: input.program.title,
  });

  return { success: true, certificate: cert, modules: moduleRecords };
};

export const generateCertificatePreview = async (
  input: CertificateCreateInput
): Promise<RenderResult> => {
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    return {
      success: false,
      contentType: "application/pdf",
      errors: validationErrors,
    };
  }

  const template = getTemplateById(TEMPLATE_ID, TEMPLATE_VERSION);
  const tmpToken = generateVerificationToken();
  const tmpNumber = input.manualCertificateNumber || `PREVIEW-${Date.now().toString(36).toUpperCase()}`;
  const renderInput = buildRenderInput(input, tmpNumber, tmpToken);

  return certificateRenderer.renderPreview(renderInput, template);
};

export const issueCertificate = async (
  draftId: string,
  rawInput: CertificateCreateInput,
  actorId?: string
): Promise<CreateCertificateResult> => {
  const validationErrors = validateInput(rawInput);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  // Student IDs are never typed in by the admin — auto-assign one now
  // (reusing the original recipient's ID on a reissue) before anything else
  // reads `input`, so the generated ID also lands in the historical
  // data_snapshot below and is preserved correctly on future reissues.
  let studentId: string;
  try {
    studentId = await generateStudentId(rawInput.issueDate, rawInput.recipient.studentId);
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
  const input: CertificateCreateInput = {
    ...rawInput,
    recipient: { ...rawInput.recipient, studentId },
  };

  const snapshotEnvelope = await buildSnapshotEnvelope(input);

  let certificateNumber: string;
  try {
    certificateNumber = await generateCertificateNumber(
      input.issueDate,
      input.manualCertificateNumber
    );
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }

  const verificationToken = generateVerificationToken();
  const verificationUrl = getVerificationUrl(verificationToken);

  const template = getTemplateById(TEMPLATE_ID, TEMPLATE_VERSION);
  const renderInput = buildRenderInput(input, certificateNumber, verificationToken);

  const pdfResult = await certificateRenderer.renderPrintPdf(renderInput, template);
  if (!pdfResult.success || !pdfResult.data) {
    return {
      success: false,
      errors: pdfResult.errors || ["PDF rendering failed"],
    };
  }

  let pdfStorageKey: string | null = null;
  try {
    pdfStorageKey = await storageService.savePdf(certificateNumber, pdfResult.data);
  } catch (storageErr) {
    return {
      success: false,
      errors: [`Storage failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`],
    };
  }

  let targetCert: CertificateRecord | null;
  let modules: CertificateModuleRecord[] = [];

  try {
    targetCert = await db.certificates.findById(draftId);
  } catch {
    targetCert = null;
  }

  if (targetCert && targetCert.status === "DRAFT") {
    targetCert = await db.certificates.update(draftId, {
      certificate_number: certificateNumber,
      verification_token: verificationToken,
      template_id: TEMPLATE_ID,
      template_version: TEMPLATE_VERSION,
      renderer_version: RENDERER_VERSION,
      recipient_name: input.recipient.name,
      student_id: input.recipient.studentId || null,
      program_id: input.program.id || null,
      program_title: input.program.title,
      duration: input.program.duration,
      completion_date: input.completionDate || null,
      issue_date: input.issueDate,
      grade: input.grade || null,
      status: "ISSUED",
      signatory_id: input.signatory.id || null,
      signatory_name_snapshot: input.signatory.name,
      signatory_position_snapshot: input.signatory.position,
      public_visibility: DEFAULT_PUBLIC_FIELDS_V2,
      pdf_storage_key: pdfStorageKey,
      issued_at: new Date().toISOString(),
      data_snapshot: snapshotEnvelope as unknown as Record<string, unknown>,
    });

    modules = await db.certificateModules.findByCertificateId(draftId);
  } else {
    targetCert = await db.certificates.create({
      certificate_number: certificateNumber,
      verification_token: verificationToken,
      template_id: TEMPLATE_ID,
      template_version: TEMPLATE_VERSION,
      renderer_version: RENDERER_VERSION,
      recipient_name: input.recipient.name,
      student_id: input.recipient.studentId || null,
      program_id: input.program.id || null,
      program_title: input.program.title,
      duration: input.program.duration,
      completion_date: input.completionDate || null,
      issue_date: input.issueDate,
      grade: input.grade || null,
      status: "ISSUED",
      signatory_id: input.signatory.id || null,
      signatory_name_snapshot: input.signatory.name,
      signatory_position_snapshot: input.signatory.position,
      public_visibility: DEFAULT_PUBLIC_FIELDS_V2,
      pdf_storage_key: pdfStorageKey,
      issued_at: new Date().toISOString(),
      data_snapshot: snapshotEnvelope as unknown as Record<string, unknown>,
    });

    modules = await db.certificateModules.bulkCreate(
      input.modules.map((m) => ({
        certificate_id: targetCert!.id,
        sort_order: m.order,
        title: m.title,
        subtitle: m.subtitle || null,
      }))
    );
  }

  await logEvent(targetCert!.id, "ISSUED", actorId, {
    certificateNumber,
    recipientName: input.recipient.name,
    studentId: input.recipient.studentId,
    programTitle: input.program.title,
    verificationUrl,
  });

  return { success: true, certificate: targetCert!, modules };
};

export const revokeCertificate = async (
  certificateId: string,
  reason: string,
  actorId?: string
): Promise<{ success: boolean; certificate?: CertificateRecord | null; errors?: string[] }> => {
  if (!reason || reason.trim().length === 0) {
    return { success: false, errors: ["Revocation reason is required"] };
  }

  const cert = await db.certificates.findById(certificateId);
  if (!cert) {
    return { success: false, errors: ["Certificate not found"] };
  }

  if (cert.status === "REVOKED") {
    return { success: false, errors: ["Certificate is already revoked"] };
  }

  if (cert.status !== "ISSUED" && cert.status !== "REISSUED") {
    return { success: false, errors: [`Cannot revoke certificate with status: ${cert.status}`] };
  }

  const updated = await db.certificates.update(certificateId, {
    status: "REVOKED",
    revoked_at: new Date().toISOString(),
    revocation_reason: reason.trim(),
  });

  await logEvent(certificateId, "REVOKED", actorId, { reason: reason.trim() });

  return { success: true, certificate: updated };
};

export const reissueCertificate = async (
  certificateId: string,
  reason: string,
  updatedInput: Partial<CertificateCreateInput>,
  actorId?: string,
  refreshCourseData?: boolean
): Promise<CreateCertificateResult> => {
  const original = await db.certificates.findById(certificateId);
  if (!original) {
    return { success: false, errors: ["Certificate not found"] };
  }

  if (original.status !== "ISSUED" && original.status !== "REISSUED") {
    return {
      success: false,
      errors: [`Cannot reissue certificate with status: ${original.status}`],
    };
  }

  const rawSnapshot = (original.data_snapshot || {}) as unknown as
    | CertificateDataSnapshotEnvelope
    | CertificateCreateInput
    | Record<string, unknown>;

  const isEnvelope =
    typeof rawSnapshot === "object" &&
    rawSnapshot !== null &&
    (rawSnapshot as CertificateDataSnapshotEnvelope).schemaVersion === 1 &&
    typeof (rawSnapshot as CertificateDataSnapshotEnvelope).certificateInput === "object";

  const historicInput: CertificateCreateInput | undefined = isEnvelope
    ? (rawSnapshot as CertificateDataSnapshotEnvelope).certificateInput
    : (rawSnapshot as CertificateCreateInput);

  const beforeCourseId =
    (historicInput?.program?.id as string | undefined) || original.program_id || null;

  const certModules = await db.certificateModules.findByCertificateId(certificateId);
  const fallbackModules: CertificateModule[] = certModules.map((m) => ({
    order: m.sort_order,
    title: m.title,
    subtitle: m.subtitle || undefined,
  }));

  const baseProgram = (historicInput?.program as CertificateCreateInput["program"] | undefined) || {
    id: original.program_id || undefined,
    title: original.program_title,
    duration: original.duration,
  };

  const baseModules =
    (historicInput?.modules as CertificateCreateInput["modules"] | undefined) || fallbackModules;

  let programForReissue: CertificateCreateInput["program"] = baseProgram;
  let modulesForReissue: CertificateCreateInput["modules"] = baseModules;
  let extraCourseFields: Partial<CertificateCreateInput> = {};

  if (refreshCourseData) {
    const courseIdToRefresh =
      (updatedInput.program?.id as string | undefined) || baseProgram.id || null;
    if (courseIdToRefresh) {
      const freshCourse = await db.courses.findById(courseIdToRefresh);
      if (!freshCourse) {
        return {
          success: false,
          errors: [
            `Cannot refresh course data: course ID ${courseIdToRefresh} no longer exists in the catalog.`,
          ],
        };
      }
      if (!freshCourse.active) {
        return {
          success: false,
          errors: [
            `Cannot refresh course data: course "${freshCourse.code}" is currently inactive.`,
          ],
        };
      }
      const freshModules = await db.courseModules.findByCourseId(freshCourse.id, true);

      programForReissue = {
        id: freshCourse.id,
        code: freshCourse.code,
        title: freshCourse.certificateTitle || freshCourse.title,
        duration: freshCourse.duration,
      };
      modulesForReissue = [...freshModules]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          order: m.sort_order,
          title: m.title,
          subtitle: m.subtitle || undefined,
        }));
      extraCourseFields = {
        certificateTemplateId: freshCourse.certificateTemplateId,
        certificateTemplateVersion: freshCourse.certificateTemplateVersion,
        providerName: freshCourse.providerName,
        completionStatement: freshCourse.completionStatement,
      } as Partial<CertificateCreateInput>;
    } else {
      programForReissue = updatedInput.program || baseProgram;
      modulesForReissue = updatedInput.modules || baseModules;
    }
  } else {
    if (updatedInput.program) programForReissue = updatedInput.program;
    if (updatedInput.modules) modulesForReissue = updatedInput.modules;
  }

  const baseOptionalFields =
    (historicInput as unknown as Partial<CertificateCreateInput> | undefined) || {};

  const mergedInput: CertificateCreateInput = {
    recipient:
      updatedInput.recipient ||
      (historicInput?.recipient as CertificateCreateInput["recipient"] | undefined) ||
      { name: original.recipient_name },
    program: programForReissue,
    modules: modulesForReissue,
    grade:
      updatedInput.grade !== undefined
        ? updatedInput.grade
        : ((historicInput?.grade as CertificateCreateInput["grade"] | undefined) ||
          original.grade ||
          undefined),
    completionDate:
      updatedInput.completionDate !== undefined
        ? updatedInput.completionDate
        : ((historicInput?.completionDate as CertificateCreateInput["completionDate"] | undefined) ||
          original.completion_date ||
          undefined),
    issueDate:
      updatedInput.issueDate ||
      (historicInput?.issueDate as CertificateCreateInput["issueDate"] | undefined) ||
      original.issue_date,
    signatory:
      updatedInput.signatory ||
      (historicInput?.signatory as CertificateCreateInput["signatory"] | undefined) ||
      {
        name: original.signatory_name_snapshot,
        position: original.signatory_position_snapshot,
      },
    manualCertificateNumber:
      updatedInput.manualCertificateNumber || baseOptionalFields.manualCertificateNumber,
    certificateTemplateId:
      extraCourseFields.certificateTemplateId ||
      (baseOptionalFields as unknown as { certificateTemplateId?: string }).certificateTemplateId,
    certificateTemplateVersion:
      extraCourseFields.certificateTemplateVersion ||
      (baseOptionalFields as unknown as { certificateTemplateVersion?: string })
        .certificateTemplateVersion,
    providerName:
      extraCourseFields.providerName ||
      (baseOptionalFields as unknown as { providerName?: string }).providerName,
    completionStatement:
      extraCourseFields.completionStatement ||
      (baseOptionalFields as unknown as { completionStatement?: string }).completionStatement,
  } as CertificateCreateInput;

  const afterCourseId = mergedInput.program.id || null;

  await revokeCertificate(certificateId, `Reissued: ${reason}`, actorId);

  const issueResult = await issueCertificate(crypto.randomUUID(), mergedInput, actorId);
  if (issueResult.success && issueResult.certificate) {
    await db.certificates.update(issueResult.certificate.id, {
      reissued_from_id: certificateId,
    });
    await logEvent(issueResult.certificate.id, "REISSUED", actorId, {
      originalCertificateId: certificateId,
      reason: reason.trim(),
      refreshCourseDataRequested: !!refreshCourseData,
      beforeCourseId,
      afterCourseId,
      refreshedFromCanonical: !!refreshCourseData && !!beforeCourseId,
    });
  }

  return issueResult;
};

export async function validateCourseData(
  input: CertificateCreateInput,
  mode: "preview" | "issue" = "issue"
): Promise<string[]> {
  const errors: string[] = [];

  if (!input.program.title.trim()) {
    errors.push("Program title is required.");
  }
  if (!input.program.duration.trim()) {
    errors.push("Duration is required.");
  }
  input.modules.forEach((m, i) => {
    if (!m.title.trim()) {
      errors.push(`Module ${i + 1}: title is required.`);
    }
  });

  if (input.program.id) {
    const course = await db.courses.findById(input.program.id);
    if (!course) {
      if (mode === "issue") {
        errors.push("Selected course does not exist in the canonical catalog.");
      }
    } else {
      if (!course.active) {
        errors.push(
          `Selected course "${course.code}" is inactive and cannot be used for new certificates.`
        );
      }

      if (course.code && input.program.code && course.code !== input.program.code) {
        errors.push(
          `Posted course code (${input.program.code}) does not match canonical course code (${course.code}).`
        );
      }

      const canonicalTitle = course.certificateTitle || course.title;
      if (input.program.title.trim() !== canonicalTitle.trim()) {
        errors.push(
          `Posted program title does not match the canonical title for course "${course.code}".`
        );
      }

      if (input.program.duration.trim() !== course.duration.trim()) {
        errors.push(
          `Posted duration does not match the canonical duration for course "${course.code}".`
        );
      }

      if (input.modules.length > 0) {
        const canonicalModules = await db.courseModules.findByCourseId(course.id, true);

        const orderCounts = new Map<number, number>();
        for (const m of input.modules) {
          orderCounts.set(m.order, (orderCounts.get(m.order) || 0) + 1);
        }
        const duplicateOrders: number[] = [];
        orderCounts.forEach((count, order) => {
          if (count > 1) duplicateOrders.push(order);
        });
        if (duplicateOrders.length > 0) {
          errors.push(
            `Duplicate module order positions: ${duplicateOrders.sort((a, b) => a - b).join(", ")}.`
          );
        }

        for (const postedMod of input.modules) {
          const matched = canonicalModules.find(
            (cm) =>
              cm.title.trim().toLowerCase() === postedMod.title.trim().toLowerCase() &&
              cm.sort_order === postedMod.order &&
              cm.active
          );
          if (!matched) {
            errors.push(
              `Module "${postedMod.title}" (order ${postedMod.order}) is not an active module in course "${course.code}".`
            );
          }
        }

        const sortedOrders = [...input.modules].map((m) => m.order).sort((a, b) => a - b);
        const isConsecutive = sortedOrders.every((v, i) => v === i + 1);
        if (!isConsecutive) {
          errors.push(
            "Module order is invalid. Orders must be a consecutive sequence starting at 1."
          );
        }
      }
    }
  }

  const constraints = DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints;
  if (
    constraints &&
    typeof constraints.minCount === "number" &&
    typeof constraints.maxCount === "number" &&
    constraints.minCount === constraints.maxCount
  ) {
    if (input.modules.length !== constraints.minCount) {
      errors.push(
        `Module count (${input.modules.length}) does not match template requirement of exactly ${constraints.minCount}.`
      );
    }
  }

  return errors;
}

export const getCertificateWithModules = async (
  certificateId: string
): Promise<{ certificate: CertificateRecord; modules: CertificateModuleRecord[] } | null> => {
  const cert = await db.certificates.findById(certificateId);
  if (!cert) return null;
  const modules = await db.certificateModules.findByCertificateId(certificateId);
  return { certificate: cert, modules };
};

export const downloadCertificatePdf = async (
  certificateId: string
): Promise<{ success: boolean; buffer?: Buffer; contentType?: string; filename?: string; errors?: string[] }> => {
  const cert = await db.certificates.findById(certificateId);
  if (!cert) {
    return { success: false, errors: ["Certificate not found"] };
  }

  if (cert.status !== "ISSUED" && cert.status !== "REISSUED") {
    return { success: false, errors: [`Certificate not issued. Status: ${cert.status}`] };
  }

  if (!cert.pdf_storage_key) {
    return { success: false, errors: ["PDF artifact not found for certificate"] };
  }

  const buffer = await storageService.getPdf(cert.pdf_storage_key);
  if (!buffer) {
    return { success: false, errors: ["PDF file not found in storage"] };
  }

  const safeRecipient = cert.recipient_name.replace(/[^a-zA-Z0-9_ ]/g, "").replace(/\s+/g, "_");
  const filename = `${cert.certificate_number}_${safeRecipient}.pdf`;

  await logEvent(cert.id, "DOWNLOADED", undefined, { filename });

  return {
    success: true,
    buffer,
    contentType: "application/pdf",
    filename,
  };
};

export { ISSUER_NAME, TEMPLATE_ID, TEMPLATE_VERSION };
