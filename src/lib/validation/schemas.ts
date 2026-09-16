import { z } from "zod";
// IMPORTANT: certificateService.ts always renders with TEMPLATE_VERSION = "2.0.0"
// (darbartech-certificate-v2.ts). That template's course-module grid is a hand-tuned,
// fixed-position 4-column layout (see `shapes` divider lines in the v2 template) — it is
// NOT a flexible 3–6 module layout like v1 was. Validating against v1's moduleConstraints
// (min 3 / max 6) let certificates with the wrong module count reach the renderer, which
// then has to fall back to an improvised even-spread layout that doesn't line up with the
// fixed divider shapes — producing a visibly different, broken-looking course-modules
// section. Always validate against the template version that actually renders the PDF.
import { DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";

// Manual-verification certificate-number format. Derived from the same env
// var the numbering service uses (CERTIFICATE_PREFIX, default "DT-CERT") so
// this schema can never drift out of sync with the numbers the system actually
// mints. Normalized to uppercase to match the manual-verify route, which
// uppercases the input before the DB lookup.
import { CERTIFICATE_PREFIX } from "@/lib/services/numberingService";

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CERTIFICATE_NUMBER_PREFIX = CERTIFICATE_PREFIX.toUpperCase();
const CERTIFICATE_NUMBER_RE = new RegExp(
  `^${escapeRegExp(CERTIFICATE_NUMBER_PREFIX)}-\\d{4}-\\d{5}$`
);

export const moduleSchema = z.object({
  order: z.number().int().min(1),
  title: z
    .string()
    .trim()
    .min(1, "Module title is required")
    .max(
      DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxTitleLength,
      `Module title must be at most ${DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxTitleLength} characters`
    ),
  subtitle: z
    .string()
    .trim()
    .max(
      DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxSubtitleLength,
      `Module subtitle must be at most ${DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxSubtitleLength} characters`
    )
    .optional()
    .or(z.literal("")),
});

const signatorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Signatory name is required"),
  position: z.string().trim().min(1, "Signatory position is required"),
  signatureImage: z.string().optional(),
  active: z.boolean().optional(),
  isDefaultSecondary: z.boolean().optional(),
});

const recipientSchema = z.object({
  name: z.string().trim().min(1, "Recipient name is required").max(100, "Recipient name is too long"),
  studentId: z.string().trim().optional(),
});

const programSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Program title is required").max(200, "Program title is too long"),
  duration: z.string().trim().min(1, "Duration is required").max(50, "Duration is too long"),
  code: z.string().optional(),
});

const gradeSchema = z
  .string()
  .trim()
  .regex(/^[A-D][+-]?$|^PASS$|^FAIL$|^$/, "Invalid grade format")
  .optional();

export const certificateCreateSchema = z.object({
  recipient: recipientSchema,
  program: programSchema,
  modules: z
    .array(moduleSchema)
    .min(
      DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.minCount,
      `At least ${DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.minCount} modules are required`
    )
    .max(
      DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxCount,
      `At most ${DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxCount} modules are allowed`
    ),
  grade: gradeSchema,
  completionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  signatory: signatorySchema,
  secondarySignatory: signatorySchema.optional(),
  manualCertificateNumber: z.string().optional(),
  certificateTemplateId: z.string().trim().optional(),
  certificateTemplateVersion: z.string().trim().optional(),
  providerName: z.string().trim().optional(),
  completionStatement: z.string().trim().optional(),
});

export const certificatePreviewSchema = certificateCreateSchema;

export const certificateIssueSchema = z.object({
  draftId: z.string().uuid("Invalid draft ID"),
  forceOverride: z.boolean().optional(),
});

export const certificateRevokeSchema = z.object({
  id: z.string().uuid("Invalid certificate ID"),
  reason: z.string().trim().min(1, "Revocation reason is required").max(500, "Reason is too long"),
});

export const certificateReissueSchema = z.object({
  id: z.string().uuid("Invalid certificate ID"),
  reason: z.string().trim().min(1, "Reissue reason is required").max(500, "Reason is too long"),
  updates: certificateCreateSchema.partial().optional(),
  refreshCourseData: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().trim().min(1, "Password is required"),
});

export const certificateNumberManualSchema = z.object({
  certificateNumber: z
    .string()
    .trim()
    .regex(CERTIFICATE_NUMBER_RE, "Invalid certificate number format"),
});

export const publicVerificationSchema = z.object({
  token: z.string().trim().min(16, "Invalid verification token").max(64, "Invalid verification token"),
});

export const signatoryCreateSchema = signatorySchema;

export const courseCreateSchema = z.object({
  code: z.string().trim().min(1, "Course code is required").max(32, "Code is too long"),
  title: z.string().trim().min(1, "Course title is required").max(200, "Title is too long"),
  duration: z.string().trim().min(1, "Duration is required").max(50, "Duration is too long"),
  modules: z
    .array(moduleSchema)
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined) return;
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
    }),
});

export type CertificateCreateInput = z.infer<typeof certificateCreateSchema>;
export type CertificatePreviewInput = z.infer<typeof certificatePreviewSchema>;
export type CertificateIssueInput = z.infer<typeof certificateIssueSchema>;
export type CertificateRevokeInput = z.infer<typeof certificateRevokeSchema>;
export type CertificateReissueInput = z.infer<typeof certificateReissueSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type SignatoryCreateInput = z.infer<typeof signatoryCreateSchema>;
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
