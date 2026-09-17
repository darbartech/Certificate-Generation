import { z } from "zod";
import { PERMISSION_KEYS, type Permission } from "@/lib/types";
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

// ---------------------------------------------------------------------------
// Strict calendar-date validation (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING
// §29). A \d{4}-\d{2}-\d{2} regex proves FORMAT only — it accepts impossible
// dates like 2026-02-31 or 2026-99-99. These checks require a real calendar
// date via a UTC round-trip.
// ---------------------------------------------------------------------------
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidCalendarDate = (value: string): boolean => {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isoDateOrEmpty = z
  .string()
  .regex(DATE_RE, "Invalid date format. Use YYYY-MM-DD")
  .refine(isValidCalendarDate, "Date is not a real calendar date");

const isoDate = z
  .string()
  .regex(DATE_RE, "Invalid date format. Use YYYY-MM-DD")
  .refine(isValidCalendarDate, "Date is not a real calendar date");

const isoDateOptional = isoDateOrEmpty.optional().or(z.literal(""));

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

// V2 §34: strict business-rule enum. Only these five letter-grades are
// allowed on issued certificates (or empty / undefined for ungraded programs).
// D, PASS, FAIL, and any ad-hoc values are no longer accepted.
const GRADE_VALUES = ["A+", "A", "B+", "B", "C"] as const;
const GRADE_DISPLAY = GRADE_VALUES.join(", ");
const gradeSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (GRADE_VALUES as readonly string[]).includes(v),
    `Grade must be one of: ${GRADE_DISPLAY} (or empty for ungraded).`
  )
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
  completionDate: isoDateOptional,
  issueDate: isoDate,
  signatory: signatorySchema,
  secondarySignatory: signatorySchema.optional(),
  manualCertificateNumber: z.string().optional(),
  certificateTemplateId: z.string().trim().optional(),
  certificateTemplateVersion: z.string().trim().optional(),
  providerName: z.string().trim().optional(),
  completionStatement: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.completionDate && data.issueDate && data.completionDate > data.issueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completionDate"],
      message: "Completion date must not be after the issue date.",
    });
  }
});

export const certificatePreviewSchema = certificateCreateSchema;

export const certificateIssueSchema = z.object({
  draftId: z.string().uuid("Invalid draft ID"),
  forceOverride: z.boolean().optional(),
});

// V2 §30: standard six-category revocation taxonomy used across the
// reporting and analytics pipeline. Old values (DUPLICATE_ISSUANCE,
// IDENTITY_VERIFICATION_FAILURE, FRAUDULENT_DOCUMENTATION,
// COURSE_RECORD_CORRECTION) are collapsed into the names below for
// consistency with the spec; legacy DB rows with the old names are still
// valid and will be displayed/filtered as-is by the read paths.
export const REVOCATION_CATEGORIES = [
  "DATA_ERROR",
  "DUPLICATE",
  "FRAUD",
  "ADMINISTRATIVE_ERROR",
  "STUDENT_REQUEST",
  "OTHER",
] as const;

export const certificateRevokeSchema = z.object({
  id: z.string().uuid("Invalid certificate ID"),
  // Free-text reason is stored internally only — it must never appear on the
  // public verification API (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING §17).
  reason: z.string().trim().min(1, "Revocation reason is required").max(500, "Reason is too long"),
  // Stable category for internal reporting; not exposed publicly.
  category: z.enum(REVOCATION_CATEGORIES).optional(),
});

export const certificateReissueSchema = z.object({
  id: z.string().uuid("Invalid certificate ID"),
  reason: z.string().trim().min(1, "Reissue reason is required").max(500, "Reason is too long"),
  // certificateCreateSchema is a refined (superRefine) schema; partial() only
  // exists on the inner object shape, which is what we want to make optional.
  updates: certificateCreateSchema.innerType().partial().optional(),
  refreshCourseData: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().trim().min(1, "Password is required"),
  totp: z.string().trim().optional(),
});

// V2 §22: admin account management (MANAGE_ADMINS only).
const permissionShape = z.object(
  PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = z.boolean();
    return acc;
  }, {} as Record<Permission, z.ZodBoolean>)
);

export const adminUserCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, digits, dot, dash, underscore"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["super_admin", "admin", "staff"]).default("staff"),
  permissions: permissionShape.partial().optional(),
});

export const adminUserUpdateSchema = z
  .object({
    password: z.string().min(12, "Password must be at least 12 characters").optional(),
    role: z.enum(["super_admin", "admin", "staff"]).optional(),
    isActive: z.boolean().optional(),
    permissions: permissionShape.partial().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

export const mfaConfirmSchema = z.object({
  secret: z.string().trim().min(16, "Missing MFA secret"),
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
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
