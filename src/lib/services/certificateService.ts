import crypto from "crypto";
import { db, persistenceGuardError, sha256Hex } from "@/lib/database";
import {
  DARBARTECH_CERTIFICATE_TEMPLATE,
  DARBARTECH_CERTIFICATE_TEMPLATE_V2,
  DEFAULT_PUBLIC_FIELDS,
  DEFAULT_PUBLIC_FIELDS_V2,
  getTemplateById,
} from "@/lib/templates/darbartech-certificate-v2";
import { certificateCreateSchema, type CertificateCreateInput } from "@/lib/validation/schemas";
import { CERTIFICATE_PREFIX, generateCertificateNumber, generateStudentId } from "./numberingService";
import { generateVerificationToken, getVerificationUrl } from "./verificationService";
import { logEvent } from "./auditService";
import { storageService } from "./storageService";
import { certificateRenderer } from "@/lib/renderer/certificateRenderer";
import { AuthoritativeInputError } from "@/lib/errors";
import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateRenderInput,
  CertificateModule,
  RenderResult,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
  ReissueOperation,
} from "@/lib/types";

const TEMPLATE_ID = "darbartech-certificate";
const TEMPLATE_VERSION = "2.0.0";
const RENDERER_VERSION = "certificate-engine 2.0.0";
const ISSUER_NAME = "DarbarTech Group of Technology";

export type CreateCertificateResult = {
  success: boolean;
  certificate?: CertificateRecord;
  modules?: CertificateModuleRecord[];
  // Ephemeral: the raw verification token is returned exactly once (for the
  // post-issue QR/link) and never persisted (V2 §7).
  verificationUrl?: string;
  errors?: string[];
};

export type IssueContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type CourseSnapshotTaken = {
  takenAt: string;
  course: CourseRecord | null;
  modules: CourseModuleRecord[];
};

// V2 §25: Immutable snapshot envelope expanded to carry every field needed
// for a fully self-contained audit record. Fields marked "available at
// draft time" are populated in buildSnapshotEnvelope; the remaining fields
// (number, tokenHash, signatory snapshots) are folded in at commit time in
// issueCertificate because they are only available after the numbering +
// hashing + signatory resolution pipeline runs.
type SignatorySnapshot = {
  id: string | null;
  name: string;
  position: string;
  signatureStorageKey: string | null;
};

type CertificateDataSnapshotEnvelope = {
  schemaVersion: 1;
  courseSnapshot: CourseSnapshotTaken;
  certificateInput: CertificateCreateInput;
  certificateNumber: string | null;
  certificatePrefix: string;
  verificationTokenHash: string | null;
  studentId: string | null;
  grade: string | null;
  completionDate: string | null;
  issueDate: string;
  primarySignatory: SignatorySnapshot | null;
  secondarySignatory: SignatorySnapshot | null;
  templateId: string;
  templateVersion: string;
  rendererVersion: string;
  snapshotCreatedAt: string;
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
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    courseSnapshot: {
      takenAt: now,
      course,
      modules: courseModules,
    },
    certificateInput: input,
    certificateNumber: null,
    certificatePrefix: CERTIFICATE_PREFIX,
    verificationTokenHash: null,
    studentId: input.recipient.studentId || null,
    grade: input.grade || null,
    completionDate: input.completionDate || null,
    issueDate: input.issueDate,
    primarySignatory: null,
    secondarySignatory: null,
    templateId: (input as unknown as { certificateTemplateId?: string }).certificateTemplateId || TEMPLATE_ID,
    templateVersion: TEMPLATE_VERSION,
    rendererVersion: RENDERER_VERSION,
    snapshotCreatedAt: now,
  };
}

const buildRenderInput = (
  data: CertificateCreateInput,
  certificateNumber: string,
  verificationToken: string,
  secondarySignatory: SignatoryRecord | null
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
    // V2 §9: the secondary signatory identity is SERVER data. A client value is
    // honoured only as an `id` reference; names/positions/signatures always
    // come from the catalog. Absent a valid row, the field is omitted — never
    // invented from a hardcoded constant.
    secondarySignatory: secondarySignatory
      ? {
          name: secondarySignatory.name,
          position: secondarySignatory.position,
          signatureAsset: secondarySignatory.signature_storage_key || undefined,
        }
      : undefined,
    verificationUrl: getVerificationUrl(verificationToken),
  };
};

/**
 * V2 §9: resolve the secondary (Managing Director) signatory from the database.
 * - An explicit `id` is treated as a reference and validated against the
 *   catalog (must exist and be active).
 * - Otherwise the `is_default_secondary = true AND active = true` row is used.
 * - Production issuance is BLOCKED when no valid signatory resolves; the
 *   caller decides that with the returned null.
 */
export async function resolveSecondarySignatory(
  requestedId?: string | null
): Promise<{ signatory: SignatoryRecord | null; errors: string[] }> {
  const errors: string[] = [];
  const id = requestedId && requestedId.trim() ? requestedId.trim() : null;

  if (id) {
    const found = await db.signatories.findById(id);
    if (!found) {
      errors.push("Selected secondary signatory does not exist in the catalog.");
      return { signatory: null, errors };
    }
    if (found.active === false) {
      errors.push(
        `Secondary signatory "${found.name}" is inactive and cannot sign new certificates.`
      );
      return { signatory: null, errors };
    }
    return { signatory: found, errors };
  }

  const fallback = await db.signatories.findDefaultSecondary();
  return { signatory: fallback, errors };
}

export const createDraftCertificate = async (
  input: CertificateCreateInput,
  actorId?: string,
  ctx?: IssueContext
): Promise<CreateCertificateResult> => {
  const guardError = persistenceGuardError();
  if (guardError) {
    return { success: false, errors: [guardError] };
  }

  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  // V2 §7: no verification token is materialised or persisted for a draft. A
  // fresh token is generated at issuance time, used only for the rendered QR /
  // verification URL, and stored solely as a SHA-256 hash.
  const certificateNumber = input.manualCertificateNumber
    ? input.manualCertificateNumber
    : `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const snapshotEnvelope = await buildSnapshotEnvelope(input);

  const cert = await db.certificates.create({
    certificate_number: certificateNumber,
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
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
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

  // V2 §8/§9: preview uses the same server-resolved secondary signatory.
  const requestedSecondaryId =
    (input as unknown as { secondarySignatory?: { id?: string } }).secondarySignatory?.id || null;
  const { signatory: secondarySignatory, errors: secondaryErrors } =
    await resolveSecondarySignatory(requestedSecondaryId);
  if (secondaryErrors.length > 0) {
    return {
      success: false,
      contentType: "application/pdf",
      errors: secondaryErrors,
    };
  }

  const renderInput = buildRenderInput(input, tmpNumber, tmpToken, secondarySignatory);

  return certificateRenderer.renderPreview(renderInput, template);
};

export const issueCertificate = async (
  draftId: string,
  rawInput: CertificateCreateInput,
  actorId?: string,
  ctx?: IssueContext
): Promise<CreateCertificateResult> => {
  const guardError = persistenceGuardError();
  if (guardError) {
    return { success: false, errors: [guardError] };
  }

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

  // Issuance state machine (§14): a persisted record exists from the moment
  // issuance begins. Render/storage failures land as ISSUE_FAILED (recoverable
  // via retry) instead of an invisible orphan with a consumed number.

  // -------------------------------------------------------------------------
  // Server-resolves the authoritative course/signatory values for the record
  // being issued (spec §5.1). A malicious or stale admin client cannot mint a
  // certificate for a course or signatory it was not allowed to reference.
  const authorityErrors = await resolveAuthoritativeIssueInput(input);
  if (authorityErrors.length > 0) {
    return { success: false, errors: authorityErrors };
  }

  // V2 §8/§9: the secondary (Managing Director) signatory is SERVER data,
  // resolved from the catalog. Absent a valid row, production issuance is
  // blocked — a name is never invented from a hardcoded constant.
  const requestedSecondaryId =
    (rawInput as unknown as { secondarySignatory?: { id?: string } }).secondarySignatory?.id || null;
  const { signatory: secondarySignatory, errors: secondaryErrors } =
    await resolveSecondarySignatory(requestedSecondaryId);
  if (secondaryErrors.length > 0) {
    return { success: false, errors: secondaryErrors };
  }
  if (!secondarySignatory && process.env.NODE_ENV === "production") {
    return {
      success: false,
      errors: [
        "Issuance is blocked: no active default secondary signatory is configured. " +
          "Set exactly one active signatory with is_default_secondary = true, or select one explicitly.",
      ],
    };
  }

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
  const verificationTokenHash = sha256Hex(verificationToken);

  // V2 §25: Now that number, token-hash, and both signatories are all resolved,
  // patch the immutable snapshot envelope with the complete audit record. These
  // fields were not yet available when buildSnapshotEnvelope() ran (it was
  // the first to execute so it could include the input+course snapshot). Mutating
  // the envelope here is safe because the object is fresh and the
  // reference is only shared with baseRecordFields below.
  snapshotEnvelope.certificateNumber = certificateNumber;
  snapshotEnvelope.verificationTokenHash = verificationTokenHash;
  snapshotEnvelope.studentId = input.recipient.studentId || null;
  snapshotEnvelope.primarySignatory = {
    id: input.signatory.id || null,
    name: input.signatory.name,
    position: input.signatory.position,
    signatureStorageKey: (input.signatory.signatureImage as string | null) || null,
  };
  snapshotEnvelope.secondarySignatory = secondarySignatory
    ? {
        id: secondarySignatory.id,
        name: secondarySignatory.name,
        position: secondarySignatory.position,
        signatureStorageKey: secondarySignatory.signature_storage_key || null,
      }
    : null;
  const effectiveTemplateId =
    (input as unknown as { certificateTemplateId?: string }).certificateTemplateId || TEMPLATE_ID;
  snapshotEnvelope.templateId = effectiveTemplateId;

  // The bytes placed in storage are fingerprinted (§9).
  const baseRecordFields = {
    certificate_number: certificateNumber,
    // V2 §7: only the SHA-256 hash is persisted. The raw token above is used
    // solely for the rendered QR / verification URL and is returned once.
    verification_token_hash: verificationTokenHash,
    template_id: effectiveTemplateId,
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
    signatory_id: input.signatory.id || null,
    signatory_name_snapshot: input.signatory.name,
    signatory_position_snapshot: input.signatory.position,
    public_visibility: DEFAULT_PUBLIC_FIELDS_V2,
    data_snapshot: snapshotEnvelope as unknown as Record<string, unknown>,
  };

  // -------------------------------------------------------------------------
  // Phase 1: prepare. Create-or-transition an ISSUING row BEFORE any fallible
  // work (render, storage). A DRAFT or ISSUE_FAILED row (retry) is upgraded to
  // the freshly generated number/token.
  let issuing: CertificateRecord;
  let isNewRecord = false;
  const attemptStartedAt = new Date().toISOString();
  try {
    const existing = await db.certificates.findById(draftId);
    if (existing && (existing.status === "DRAFT" || existing.status === "ISSUING" || existing.status === "ISSUE_FAILED")) {
      const updated = await db.certificates.update(existing.id, {
        ...baseRecordFields,
        status: "ISSUING" as const,
        issuing_started_at: existing.issuing_started_at || attemptStartedAt,
        last_attempt_at: attemptStartedAt,
        attempt_count: (existing.attempt_count || 0) + 1,
        last_error: null,
      });
      if (!updated) {
        return {
          success: false,
          errors: [`Draft ${draftId} disappeared before issuance could begin. Nothing was generated — retry is safe.`],
        };
      }
      issuing = updated;
    } else {
      issuing = await db.certificates.create({
        ...baseRecordFields,
        status: "ISSUING",
        issuing_started_at: attemptStartedAt,
        last_attempt_at: attemptStartedAt,
        attempt_count: 1,
        last_error: null,
      });
      isNewRecord = true;
    }
  } catch (err) {
    console.error(`[issueCertificate] Could not prepare ISSUING record for ${certificateNumber}`, err);
    return {
      success: false,
      errors: [`Issuance could not begin: ${err instanceof Error ? err.message : String(err)}. No number was generated on the record.`],
    };
  }

  await logEvent(issuing.id, "ISSUING", actorId, {
    certificateNumber,
    recipientName: input.recipient.name,
    studentId: input.recipient.studentId,
    programTitle: input.program.title,
    verificationUrl,
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  // -------------------------------------------------------------------------
  // Phase 2: render + store. Failures mark the record ISSUE_FAILED so the
  // attempt is visible and retryable, restoring ISSUING on the retry.
  const template = getTemplateById(TEMPLATE_ID, TEMPLATE_VERSION);
  const renderInput = buildRenderInput(input, certificateNumber, verificationToken, secondarySignatory);

  const pdfResult = await certificateRenderer.renderPrintPdf(renderInput, template);
  if (!pdfResult.success || !pdfResult.data) {
    await markIssueFailed(issuing, pdfResult.errors?.join("; ") || "PDF rendering failed", actorId, ctx);
    return {
      success: false,
      errors: [...(pdfResult.errors || ["PDF rendering failed"]), `Issuance attempt recorded as ISSUE_FAILED (${issuing.id}).`],
    };
  }

  const pdfSha256 = crypto.createHash("sha256").update(pdfResult.data).digest("hex");
  const pdfSize = pdfResult.data.length;

  let pdfStorageKey: string | null = null;
  try {
    // V2 §6: immutable private object at issued/{id}/{number}-v1.pdf.
    pdfStorageKey = await storageService.savePdf(issuing.id, certificateNumber, pdfResult.data, 1);
  } catch (storageErr) {
    await markIssueFailed(issuing, `Storage failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`, actorId, ctx);
    return {
      success: false,
      errors: [
        `Storage failed: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}. ` +
          `Issuance attempt recorded as ISSUE_FAILED (${issuing.id}) — retry will re-attempt.`,
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Phase 3: commit. The PDF is in storage and the number is consumed, so a
  // DB failure here leaves a consistent ISSUING/ISSUE_FAILED record visible
  // for recovery — never an orphaned PDF with no record.
  const commitFields = {
    ...baseRecordFields,
    status: "ISSUED" as const,
    pdf_storage_key: pdfStorageKey,
    pdf_sha256: pdfSha256,
    pdf_size: pdfSize,
    issued_at: new Date().toISOString(),
    last_error: null,
  };

  let targetCert: CertificateRecord;
  try {
    const updated = await db.certificates.update(issuing.id, commitFields);
    if (!updated) {
      console.error(
        `[issueCertificate] Record ${issuing.id} (${certificateNumber}) vanished at commit; storage key ${pdfStorageKey}.`
      );
      return {
        success: false,
        errors: [
          `Certificate content was generated (number ${certificateNumber}) but the record could not be ` +
            `committed. Do not retry with the same data — contact an administrator to reconcile storage key ${pdfStorageKey}.`,
        ],
      };
    }
    targetCert = updated;
  } catch (err) {
    console.error(
      `[issueCertificate] DB commit failed for ${certificateNumber} (storage key ${pdfStorageKey}). Do NOT retry the same inputs until reconciled.`,
      err
    );
    return {
      success: false,
      errors: [
        `Certificate content was generated (number ${certificateNumber}) but could not be ` +
          `committed. Do not retry — contact an administrator to reconcile storage key ${pdfStorageKey}.`,
      ],
    };
  }

  let modules: CertificateModuleRecord[];
  if (isNewRecord) {
    modules = await db.certificateModules.bulkCreate(
      input.modules.map((m) => ({
        certificate_id: targetCert.id,
        sort_order: m.order,
        title: m.title,
        subtitle: m.subtitle || null,
      }))
    );
  } else {
    modules = await db.certificateModules.findByCertificateId(targetCert.id);
  }

  await logEvent(targetCert.id, "ISSUED", actorId, {
    certificateNumber,
    recipientName: input.recipient.name,
    studentId: input.recipient.studentId,
    programTitle: input.program.title,
    verificationUrl,
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  return { success: true, certificate: targetCert, modules, verificationUrl };
};

// Replaces client-supplied course/signatory names with the catalog's canonical
// values at issuance time (§5.1). Mutates `input` in place and returns errors.
async function resolveAuthoritativeIssueInput(input: CertificateCreateInput): Promise<string[]> {
  // AC-12.1 CLIENT-ALLOWLIST (maximum 6 fields accepted from client unverified):
  //   [1] student_name (recipient.name)
  //   [2] student_id   (recipient.studentId)
  //   [3] completion_date
  //   [4] grade
  //   [5] modules[].grade only (module titles come from catalog)
  //   [6] issue_date
  // All other fields rendered on the PDF come from server catalog lookups below.
  const errors: string[] = [];
  if (input.program.id) {
    const course = await db.courses.findById(input.program.id);
    if (!course) {
      errors.push("Selected course does not exist in the catalog.");
    } else if (course.active === false) {
      errors.push(`Course "${course.code}" is inactive and cannot be used for new certificates.`);
    } else {
      input.program.title = course.certificateTitle || course.title;
      input.program.duration = course.duration;
      input.program.code = course.code;
      if (course.certificateTemplateId) input.certificateTemplateId = course.certificateTemplateId;
      if (course.certificateTemplateVersion) input.certificateTemplateVersion = course.certificateTemplateVersion;
      if (course.providerName) input.providerName = course.providerName;
      if (course.completionStatement) input.completionStatement = course.completionStatement;
    }
  }
  if (input.signatory.id) {
    const signatory = await db.signatories.findById(input.signatory.id);
    if (!signatory) {
      errors.push("Selected signatory does not exist in the catalog.");
    } else if (signatory.active === false) {
      errors.push(`Signatory "${signatory.name}" is inactive and cannot sign new certificates.`);
    } else {
      input.signatory.name = signatory.name;
      input.signatory.position = signatory.position;
      if (signatory.signature_storage_key) input.signatory.signatureImage = signatory.signature_storage_key;
    }
  }
  const requestedSecondaryId =
    (input as unknown as { secondarySignatory?: { id?: string } }).secondarySignatory?.id || null;
  const { signatory: resolvedSecondary, errors: secondaryErrors } =
    await resolveSecondarySignatory(requestedSecondaryId);
  if (secondaryErrors.length > 0) {
    errors.push(...secondaryErrors);
  }
  if (resolvedSecondary) {
    if (!input.secondarySignatory) {
      (input as unknown as { secondarySignatory: CertificateCreateInput["secondarySignatory"] }).secondarySignatory = {};
    }
    if (input.secondarySignatory) {
      input.secondarySignatory.name = resolvedSecondary.name;
      input.secondarySignatory.position = resolvedSecondary.position;
      if (resolvedSecondary.signature_storage_key) input.secondarySignatory.signatureImage = resolvedSecondary.signature_storage_key;
    }
  }
  // AC-12.2: fail hard if any server-authoritative field resolved to empty
  if (!input.providerName || input.providerName.trim().length === 0) {
    throw new AuthoritativeInputError("provider_name could not be resolved server-side", "provider_name");
  }
  if (!input.completionStatement || input.completionStatement.trim().length === 0) {
    throw new AuthoritativeInputError("completion_statement could not be resolved server-side", "completion_statement");
  }
  if (!input.certificateTemplateId || input.certificateTemplateId.length === 0) {
    throw new AuthoritativeInputError("template_id not resolved", "template_id");
  }
  if (!input.signatory?.name || input.signatory.name.trim().length === 0) {
    throw new AuthoritativeInputError("primary signatory name not resolved", "signatory.name");
  }
  if (!input.secondarySignatory?.name || input.secondarySignatory.name.trim().length === 0) {
    throw new AuthoritativeInputError("secondary signatory name not resolved (default_secondary)", "secondarySignatory.name");
  }
  return errors;
}

// Marks a prepared record ISSUE_FAILED so the failed attempt is auditable and
// retryable. Never throws — all failures are logged loudly instead.
async function markIssueFailed(
  cert: CertificateRecord,
  cause: string,
  actorId?: string,
  ctx?: IssueContext
): Promise<void> {
  try {
    await db.certificates.update(cert.id, {
      status: "ISSUE_FAILED",
      last_error: cause.slice(0, 1000),
      last_attempt_at: new Date().toISOString(),
    });
    await logEvent(cert.id, "ISSUE_FAILED", actorId, { cause: cause.slice(0, 500) }, {
      requestId: ctx?.requestId,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
  } catch (err) {
    console.error(`[issueCertificate] Failed to mark record ${cert.id} ISSUE_FAILED`, err);
  }
}

export const revokeCertificate = async (
  certificateId: string,
  reason: string,
  actorId?: string,
  ctx?: IssueContext,
  category?: string
): Promise<{ success: boolean; certificate?: CertificateRecord | null; errors?: string[] }> => {
  const guardError = persistenceGuardError();
  if (guardError) {
    return { success: false, errors: [guardError] };
  }

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
    revocation_category: category || null,
  });

  await logEvent(certificateId, "REVOKED", actorId, {
    reason: reason.trim(),
    category: category || null,
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  return { success: true, certificate: updated };
};

// V2 §14: replay of a previously-seen Idempotency-Key. Returns the recorded
// outcome instead of starting a new operation.
async function resolveExistingReissueOperation(
  op: ReissueOperation
): Promise<CreateCertificateResult> {
  if (op.status === "COMPLETED" && op.replacement_certificate_id) {
    const replacement = await db.certificates.findById(op.replacement_certificate_id);
    if (replacement) {
      const modules = await db.certificateModules.findByCertificateId(replacement.id);
      return { success: true, certificate: replacement, modules };
    }
    return {
      success: false,
      errors: [
        `Reissue operation ${op.id} is marked COMPLETED but its replacement certificate is missing. Contact an administrator.`,
      ],
    };
  }
  if (op.status === "REISSUE_FAILED") {
    return {
      success: false,
      errors: [
        `A previous reissue attempt with this idempotency key failed (operation ${op.id}). Use a new key to retry.`,
      ],
    };
  }
  return {
    success: false,
    errors: [
      `A reissue with this idempotency key is already in progress (operation ${op.id}, status ${op.status}). Wait for it to finish rather than retrying.`,
    ],
  };
}

export const reissueCertificate = async (
  certificateId: string,
  reason: string,
  updatedInput: Partial<CertificateCreateInput>,
  actorId?: string,
  refreshCourseData?: boolean,
  ctx?: IssueContext,
  idempotencyKey?: string
): Promise<CreateCertificateResult> => {
  const guardError = persistenceGuardError();
  if (guardError) {
    return { success: false, errors: [guardError] };
  }

  // -------------------------------------------------------------------------
  // V2 §14: replay guard. A browser retry or double-click sends the same
  // Idempotency-Key; we return the recorded outcome instead of minting a second
  // replacement. A different key is a new legitimate operation.
  if (idempotencyKey) {
    const existingOp = await db.reissueOperations.findByIdempotencyKey(idempotencyKey);
    if (existingOp) {
      return resolveExistingReissueOperation(existingOp);
    }
  }

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

  // -------------------------------------------------------------------------
  // V2 §14: record the operation BEFORE any replacement is minted. If the same
  // key arrives concurrently, the UNIQUE(idempotency_key) constraint rejects the
  // duplicate insert and we replay the winner's outcome.
  let operation: ReissueOperation | null = null;
  if (idempotencyKey) {
    try {
      operation = await db.reissueOperations.create({
        idempotency_key: idempotencyKey,
        original_certificate_id: certificateId,
        requested_by: actorId || null,
        status: "REISSUING",
      });
    } catch (err) {
      const raced = await db.reissueOperations.findByIdempotencyKey(idempotencyKey);
      if (raced) return resolveExistingReissueOperation(raced);
      return {
        success: false,
        errors: [
          `Could not record reissue operation: ${err instanceof Error ? err.message : String(err)}`,
        ],
      };
    }
  }

  // Replacement-first reissue (§15): the replacement is minted BEFORE the
  // original is touched. If the replacement fails, the original stays ISSUED
  // and valid; issueCertificate has already recorded the attempt as
  // ISSUE_FAILED so a retry is safe.
  const issueResult = await issueCertificate(crypto.randomUUID(), mergedInput, actorId, ctx);
  if (!issueResult.success || !issueResult.certificate) {
    if (operation) {
      await db.reissueOperations.update(operation.id, {
        status: "REISSUE_FAILED",
        completed_at: new Date().toISOString(),
      });
    }
    return issueResult;
  }

  const replacement = issueResult.certificate;
  if (operation) {
    await db.reissueOperations.update(operation.id, {
      status: "REPLACEMENT_CREATED",
      replacement_certificate_id: replacement.id,
    });
  }

  // Replacement committed — now supersede the original and link both records in
  // ONE transaction (§13). A failure here leaves the original looking live, so
  // it must surface loudly (never as a generic error the admin would silently
  // retry into a duplicate).
  const finalize = await db.reissueOperations.finalize(
    operation?.id || null,
    certificateId,
    replacement.id
  );
  if (!finalize.success) {
    console.error(
      `[reissueCertificate] finalize failed for original ${certificateId} / replacement ${replacement.id}: ${finalize.error}`
    );
    if (operation) {
      await db.reissueOperations.update(operation.id, {
        status: "REISSUE_FAILED",
        completed_at: new Date().toISOString(),
      });
    }
    return {
      success: false,
      errors: [
        `Replacement ${replacement.certificate_number} was issued, but the original could not be ` +
          `marked superseded atomically. Do not retry with the same key — contact an administrator ` +
          `to reconcile original ${certificateId}.`,
      ],
    };
  }

  await logEvent(certificateId, "SUPERSEDED", actorId, {
    replacementCertificateId: replacement.id,
    replacementCertificateNumber: replacement.certificate_number,
    reason: reason.trim(),
    refreshCourseDataRequested: !!refreshCourseData,
    beforeCourseId,
    afterCourseId,
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  await logEvent(replacement.id, "REISSUED", actorId, {
    originalCertificateId: certificateId,
    reason: reason.trim(),
    refreshCourseDataRequested: !!refreshCourseData,
    beforeCourseId,
    afterCourseId,
    refreshedFromCanonical: !!refreshCourseData && !!beforeCourseId,
  }, {
    requestId: ctx?.requestId,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  return issueResult;
};

// ---------------------------------------------------------------------------
// V2 §12: stale-issuance recovery
// ---------------------------------------------------------------------------
// A process crash / timeout can leave a record stuck in ISSUING after the
// number was consumed. Recovery is idempotent and NEVER generates a new number:
// it inspects the deterministic artifact path; if the bytes landed, the record
// is finalized as ISSUED, otherwise it is re-rendered for the SAME number. After
// a configurable attempt budget the record is escalated to ADMIN_REVIEW.

export type IssuanceRecoveryReport = {
  scanned: number;
  finalized: number;
  retried: number;
  flaggedForReview: number;
  details: Array<{
    certificateId: string;
    certificateNumber: string;
    action: "finalized" | "retried" | "flagged_for_review" | "skipped";
    error?: string;
  }>;
};

const ISSUANCE_TIMEOUT_MS = (() => {
  const raw = Number(process.env.ISSUANCE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 10 * 60 * 1000;
})();

const ISSUANCE_MAX_ATTEMPTS = (() => {
  const raw = Number(process.env.ISSUANCE_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
})();

const recoverInputFromSnapshot = async (
  cert: CertificateRecord
): Promise<CertificateCreateInput | null> => {
  const raw = (cert.data_snapshot || {}) as unknown as
    | CertificateDataSnapshotEnvelope
    | CertificateCreateInput
    | Record<string, unknown>;

  const isEnvelope =
    typeof raw === "object" &&
    raw !== null &&
    (raw as CertificateDataSnapshotEnvelope).schemaVersion === 1 &&
    typeof (raw as CertificateDataSnapshotEnvelope).certificateInput === "object";

  const historic = isEnvelope
    ? (raw as CertificateDataSnapshotEnvelope).certificateInput
    : (raw as CertificateCreateInput);

  if (historic && historic.recipient && historic.program && Array.isArray(historic.modules)) {
    return { ...historic, issueDate: historic.issueDate || cert.issue_date } as CertificateCreateInput;
  }

  const mods = await db.certificateModules.findByCertificateId(cert.id);
  if (mods.length === 0) return null;

  return {
    recipient: { name: cert.recipient_name },
    program: {
      id: cert.program_id || undefined,
      title: cert.program_title,
      duration: cert.duration,
    },
    modules: mods.map((m) => ({
      order: m.sort_order,
      title: m.title,
      subtitle: m.subtitle || undefined,
    })),
    grade: cert.grade || undefined,
    completionDate: cert.completion_date || undefined,
    issueDate: cert.issue_date,
    signatory: {
      name: cert.signatory_name_snapshot,
      position: cert.signatory_position_snapshot,
    },
  } as CertificateCreateInput;
};

async function recoverOneStaleIssuance(
  cert: CertificateRecord,
  report: IssuanceRecoveryReport,
  actorId: string,
  ctx?: IssueContext
): Promise<void> {
  const record = (action: IssuanceRecoveryReport["details"][number]["action"], error?: string) => {
    report.details.push({
      certificateId: cert.id,
      certificateNumber: cert.certificate_number,
      action,
      error,
    });
  };

  // 1) Did the render actually land? Inspect the deterministic key first, then
  //    the recorded key (a partial attempt may have stored then crashed).
  const candidateKeys = [
    cert.pdf_storage_key,
    storageService.buildPdfKey(cert.id, cert.certificate_number, 1),
  ].filter((k): k is string => !!k);

  let existingArtifact: Buffer | null = null;
  let existingKey: string | null = null;
  for (const key of candidateKeys) {
    try {
      const buf = await storageService.getPdf(key);
      if (buf && buf.length > 0) {
        existingArtifact = buf;
        existingKey = key;
        break;
      }
    } catch {
      /* keep looking */
    }
  }

  if (existingArtifact && existingKey) {
    const sha = crypto.createHash("sha256").update(existingArtifact).digest("hex");
    await db.certificates.update(cert.id, {
      status: "ISSUED",
      pdf_storage_key: existingKey,
      pdf_sha256: sha,
      pdf_size: existingArtifact.length,
      issued_at: cert.issued_at || new Date().toISOString(),
      last_error: null,
      last_attempt_at: new Date().toISOString(),
    });
    await logEvent(cert.id, "RECOVERED", actorId, {
      mode: "artifact_finalize",
      certificateNumber: cert.certificate_number,
      storageKey: existingKey,
    }).catch(() => undefined);
    report.finalized++;
    record("finalized");
    return;
  }

  const attempts = cert.attempt_count || 0;
  const nextAttempt = attempts + 1;

  // 2) No artifact and the budget is spent — stop silently retrying and make a
  //    human look. The number is preserved; nothing is re-generated.
  if (attempts >= ISSUANCE_MAX_ATTEMPTS) {
    await db.certificates.update(cert.id, {
      status: "ADMIN_REVIEW",
      last_error:
        `Issuance did not complete after ${attempts} attempts and no valid artifact was found. ` +
        `Manual reconciliation required for ${cert.certificate_number}.`,
      last_attempt_at: new Date().toISOString(),
    });
    await logEvent(cert.id, "REVIEW_REQUIRED", actorId, {
      certificateNumber: cert.certificate_number,
      attempts,
    }).catch(() => undefined);
    report.flaggedForReview++;
    record("flagged_for_review");
    return;
  }

  const input = await recoverInputFromSnapshot(cert);
  if (!input) {
    await db.certificates.update(cert.id, {
      status: "ADMIN_REVIEW",
      last_error: "Issuance snapshot unavailable; cannot safely re-render.",
      last_attempt_at: new Date().toISOString(),
    });
    report.flaggedForReview++;
    record("flagged_for_review", "snapshot unavailable");
    return;
  }

  // 3) Re-render for the SAME certificate number. A fresh one-way verification
  //    token is minted (the previous raw token was never persisted and was
  //    never published, so no link is invalidated).
  const token = generateVerificationToken();
  const { signatory: secondarySignatory } = await resolveSecondarySignatory(null);
  const template = getTemplateById(TEMPLATE_ID, TEMPLATE_VERSION);
  const renderInput = buildRenderInput(input, cert.certificate_number, token, secondarySignatory);

  const pdfResult = await certificateRenderer.renderPrintPdf(renderInput, template);
  if (!pdfResult.success || !pdfResult.data) {
    const failed = nextAttempt >= ISSUANCE_MAX_ATTEMPTS;
    await db.certificates.update(cert.id, {
      status: failed ? "ADMIN_REVIEW" : "ISSUE_FAILED",
      attempt_count: nextAttempt,
      last_attempt_at: new Date().toISOString(),
      last_error: (pdfResult.errors || ["Recovery render failed"]).join("; ").slice(0, 1000),
    });
    if (failed) {
      report.flaggedForReview++;
      record("flagged_for_review", (pdfResult.errors || []).join("; "));
    } else {
      record("skipped", (pdfResult.errors || []).join("; "));
    }
    return;
  }

  const sha = crypto.createHash("sha256").update(pdfResult.data).digest("hex");
  const key = storageService.buildPdfKey(cert.id, cert.certificate_number, 1);

  let storageKey: string | null = null;
  try {
    storageKey = await storageService.savePdf(cert.id, cert.certificate_number, pdfResult.data, 1);
  } catch (err) {
    // A colliding object means a concurrent attempt already stored the bytes.
    // Treat that as success and finalize against the existing artifact.
    const after = await storageService.getPdf(key).catch(() => null);
    if (after && after.length > 0) {
      storageKey = key;
    } else {
      const failed = nextAttempt >= ISSUANCE_MAX_ATTEMPTS;
      await db.certificates.update(cert.id, {
        status: failed ? "ADMIN_REVIEW" : "ISSUE_FAILED",
        attempt_count: nextAttempt,
        last_attempt_at: new Date().toISOString(),
        last_error: `Recovery storage failed: ${
          err instanceof Error ? err.message : String(err)
        }`.slice(0, 1000),
      });
      if (failed) {
        report.flaggedForReview++;
        record("flagged_for_review", "storage failed");
      } else {
        record("skipped", "storage failed");
      }
      return;
    }
  }

  await db.certificates.update(cert.id, {
    status: "ISSUED",
    pdf_storage_key: storageKey,
    pdf_sha256: sha,
    pdf_size: pdfResult.data.length,
    issued_at: cert.issued_at || new Date().toISOString(),
    verification_token_hash: sha256Hex(token),
    attempt_count: nextAttempt,
    last_attempt_at: new Date().toISOString(),
    last_error: null,
  });

  await logEvent(cert.id, "RECOVERED", actorId, {
    mode: "re_render",
    certificateNumber: cert.certificate_number,
    attempt: nextAttempt,
  }).catch(() => undefined);

  report.retried++;
  record("retried");
}

export const recoverStaleIssuance = async (options?: {
  actorId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}): Promise<IssuanceRecoveryReport> => {
  const report: IssuanceRecoveryReport = {
    scanned: 0,
    finalized: 0,
    retried: 0,
    flaggedForReview: 0,
    details: [],
  };

  const guardError = persistenceGuardError();
  if (guardError) {
    report.details.push({
      certificateId: "",
      certificateNumber: "",
      action: "skipped",
      error: guardError,
    });
    return report;
  }

  const stale = await db.certificates.list({ status: "ISSUING", limit: 1000 });
  const cutoff = Date.now() - ISSUANCE_TIMEOUT_MS;
  const actorId = options?.actorId || "system";
  const ctx: IssueContext | undefined = options
    ? { requestId: options.requestId, ip: options.ip, userAgent: options.userAgent }
    : undefined;

  for (const cert of stale) {
    const startedAtRaw = cert.issuing_started_at || cert.created_at;
    const startedAt = startedAtRaw ? Date.parse(startedAtRaw) : NaN;
    if (Number.isFinite(startedAt) && startedAt >= cutoff) continue;

    report.scanned++;
    try {
      await recoverOneStaleIssuance(cert, report, actorId, ctx);
    } catch (err) {
      report.details.push({
        certificateId: cert.id,
        certificateNumber: cert.certificate_number,
        action: "skipped",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
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

// V2 §7: the raw verification token must never leave the issuance response or
// any admin read path (only its SHA-256 hash is stored). Legacy rows may still
// carry a raw token column, so every admin-facing record is stripped here.
const stripRawVerificationToken = (cert: CertificateRecord): CertificateRecord => {
  const copy = { ...cert };
  delete copy.verification_token;
  return copy;
};

export const getCertificateWithModules = async (
  certificateId: string
): Promise<{ certificate: CertificateRecord; modules: CertificateModuleRecord[] } | null> => {
  const cert = await db.certificates.findById(certificateId);
  if (!cert) return null;
  const modules = await db.certificateModules.findByCertificateId(certificateId);
  return { certificate: stripRawVerificationToken(cert), modules };
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

  const filename = `${cert.certificate_number}.pdf`;

  await logEvent(cert.id, "DOWNLOADED", undefined, { filename });

  return {
    success: true,
    buffer,
    contentType: "application/pdf",
    filename,
  };
};

export { ISSUER_NAME, TEMPLATE_ID, TEMPLATE_VERSION };
