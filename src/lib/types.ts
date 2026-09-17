// V2 §28: Fundamental status model. REISSUED is kept as a legacy alias
// for existing DB rows only — new reissued certificates carry status ISSUED
// with reissued_from_id populated (the original becomes SUPERSEDED with
// superseded_by_id populated). Use `isIssuedLike` / the `ISSUED || REISSUED`
// pattern for guards so legacy and new records are both accepted.
export type CertificateStatus =
  | "DRAFT"
  | "ISSUING"
  | "PREVIEW"
  | "ISSUE_FAILED"
  | "ADMIN_REVIEW"
  | "ISSUED"
  | "SUPERSEDED"
  | "REVOKED"
  | "REISSUED"
  | "CANCELLED";

export type VerificationStatus = "VALID" | "REVOKED" | "SUPERSEDED" | "NOT_FOUND";

export type CertificateModule = {
  order: number;
  title: string;
  subtitle?: string;
};

export type Recipient = {
  name: string;
  studentId?: string;
};

export type Program = {
  id?: string;
  title: string;
  duration: string;
  code?: string;
};

export type Signatory = {
  id?: string;
  name: string;
  position: string;
  signatureImage?: string;
  active?: boolean;
  isDefaultSecondary?: boolean;
};

export type Grade = {
  value: string;
  score?: number;
  distinction?: string;
};

export type CertificateData = {
  recipient: Recipient;
  program: Program;
  modules: CertificateModule[];
  grade?: string;
  completionDate?: string;
  issueDate: string;
  signatory: Signatory;
  secondarySignatory?: Signatory;
};

export type CertificateRecord = {
  id: string;
  certificate_number: string;
  // V2 §7: raw tokens are no longer persisted. The column is dropped by
  // migration 007; only `verification_token_hash` survives.
  verification_token?: string;
  verification_token_hash?: string | null;
  template_id: string;
  template_version: string;
  renderer_version: string;

  recipient_name: string;
  student_id?: string | null;

  program_id?: string | null;
  program_title: string;
  duration: string;

  completion_date?: string | null;
  issue_date: string;

  grade?: string | null;

  status: CertificateStatus;

  signatory_id?: string | null;
  signatory_name_snapshot: string;
  signatory_position_snapshot: string;

  public_visibility: Record<string, boolean>;

  pdf_storage_key?: string | null;
  preview_storage_key?: string | null;

  // Artifact integrity (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING §25)
  pdf_sha256?: string | null;
  pdf_size?: number | null;

  // Issuance recovery (V2 §12). `ISSUING` rows carry enough state for a
  // periodic recovery job to decide finalize-vs-retry without minting a new
  // certificate number.
  issuing_started_at?: string | null;
  last_attempt_at?: string | null;
  attempt_count?: number | null;
  last_error?: string | null;

  issued_at?: string | null;
  created_at: string;
  updated_at: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  revocation_category?: string | null;

  reissued_from_id?: string | null;
  superseded_by_id?: string | null;
  superseded_at?: string | null;
  data_snapshot?: Record<string, unknown>;
};

export type CertificateModuleRecord = {
  id: string;
  certificate_id: string;
  sort_order: number;
  title: string;
  subtitle?: string | null;
};

export type CertificateEvent = {
  id: string;
  certificate_id: string;
  event_type:
    | "CREATED"
    | "PREVIEW_GENERATED"
    | "ISSUING"
    | "ISSUE_FAILED"
    | "ISSUED"
    | "RECOVERED"
    | "REVIEW_REQUIRED"
    | "DOWNLOADED"
    | "VERIFIED"
    | "REVOKED"
    | "SUPERSEDED"
    | "REISSUED";
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  // Tamper-evident chain (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING §50-51)
  previous_event_hash?: string | null;
  event_hash?: string | null;
  request_id?: string | null;
  // V2 §10: exact metadata serialization that was hashed. JSONB does not
  // preserve key order, so the hash must be verified against the original text
  // rather than a re-serialization of the parsed object.
  metadata_canonical?: string | null;
};

// V2 §11: durable outbox row for a critical audit event awaiting append.
export type AuditOutboxRecord = {
  id: string;
  certificate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at?: string | null;
  attempt_count?: number;
  last_error?: string | null;
};

export type CourseRecord = {  id: string;
  code: string;
  title: string;
  duration: string;
  active: boolean;
  certificateTitle?: string;
  certificateTemplateId?: string;
  certificateTemplateVersion?: string;
  providerName?: string;
  completionStatement?: string;
};

export type CourseModuleRecord = {
  id: string;
  course_id: string;
  sort_order: number;
  title: string;
  subtitle?: string | null;
  active: boolean;
};

export type SignatoryRecord = {
  id: string;
  name: string;
  position: string;
  signature_storage_key?: string | null;
  active: boolean;
  is_default_secondary?: boolean;
};

// V2 §13/§14: one row per reissue attempt, keyed by an idempotency key so a
// browser retry/double-click cannot mint a second replacement certificate.
export type ReissueOperationStatus =
  | "REISSUE_REQUESTED"
  | "REISSUING"
  | "REPLACEMENT_CREATED"
  | "ORIGINAL_SUPERSEDED"
  | "COMPLETED"
  | "REISSUE_FAILED";

export type ReissueOperation = {
  id: string;
  idempotency_key: string;
  original_certificate_id: string;
  replacement_certificate_id?: string | null;
  requested_by?: string | null;
  status: ReissueOperationStatus;
  created_at: string;
  completed_at?: string | null;
};

export type TextRun = {
  text: string;
  font: string;
  fontSize: number;
  color: string;
};

export type TemplateField = {
  field: string;
  type: "text" | "date" | "module_list" | "qr" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  capHeightMm?: number;
  font: string;
  fontSize: number;
  weight: string | number;
  color: string;
  alignment: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  maxLines: number;
  minFontSize: number;
  overflowPolicy: "shrink_then_reject" | "wrap_then_shrink" | "reject";
  required: boolean;
  runs?: TextRun[];
  transformUppercase?: boolean;
};

export type ShapeConfig =
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: string;
      stroke?: string;
      strokeWidthMm?: number;
      rotationDeg?: number;
      cornerRadiusMm?: number;
      layer?: number;
    }
  | {
      kind: "triangle";
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: string;
      stroke?: string;
      strokeWidthMm?: number;
      rotationDeg?: number;
      layer?: number;
    }
  | {
      kind: "line";
      x: number;
      y: number;
      width: number;
      height: number;
      stroke?: string;
      strokeWidthMm?: number;
      rotationDeg?: number;
      orientation?: "horizontal" | "vertical";
      layer?: number;
    }
  | {
      kind: "polygon";
      points: Array<{ x: number; y: number }>;
      fill?: string;
      stroke?: string;
      strokeWidthMm?: number;
      rotationDeg?: number;
      layer?: number;
    };

export type TemplateConfig = {
  templateId: string;
  version: string;
  rendererVersion: string;
  page: {
    width: number;
    height: number;
    unit: "mm" | "in" | "px";
    dpi: number;
    orientation: "portrait" | "landscape";
    colorMode: "CMYK" | "RGB";
  };
  safeArea: {
    topMm: number;
    rightMm: number;
    bottomMm: number;
    leftMm: number;
  };
  moduleConstraints: {
    minCount: number;
    maxCount: number;
    maxTitleLength: number;
    maxSubtitleLength: number;
    area: {
      x: number;
      y: number;
      width: number;
      height: number;
      gap: number;
    };
    item: {
      titleFont: string;
      titleSize: number;
      titleWeight: string | number;
      titleColor: string;
      subtitleFont: string;
      subtitleSize: number;
      subtitleWeight: string | number;
      subtitleColor: string;
      alignment: "left" | "center" | "right";
    };
  };
  fields: Record<string, TemplateField>;
  shapes?: ShapeConfig[];
  staticAssets: {
    logo?: string;
    background?: string;
    border?: string;
    watermarkLogo?: string;
  };
  qrConfig: {
    x: number;
    y: number;
    size: number;
    errorCorrection: "L" | "M" | "Q" | "H";
    margin: number;
    borderMm?: number;
    borderColor?: string;
  };
  signatureConfig: {
    x: number;
    y: number;
    width: number;
    height: number;
    nameFont: string;
    nameSize: number;
    nameWeight: string | number;
    positionFont: string;
    positionSize: number;
  };
  colors: Record<string, { cmyk?: string; hex: string; hexSrgb?: string }>;
};

export type CertificateRenderInput = {
  templateId: string;
  templateVersion: string;
  rendererVersion: string;

  certificateNumber: string;

  recipient: {
    name: string;
  };

  program: {
    title: string;
    duration: string;
  };

  trainingProvider?: string;

  modules: CertificateModule[];

  grade?: string;

  completionDate?: string;
  issueDate: string;

  signatory: {
    name: string;
    position: string;
    signatureAsset?: string;
  };

  secondarySignatory?: {
    name: string;
    position: string;
    signatureAsset?: string;
  };

  verificationUrl: string;
};

export type RenderResult = {
  success: boolean;
  data?: Buffer;
  contentType: "application/pdf" | "image/png" | "image/jpeg";
  errors?: string[];
  warnings?: string[];
};

// V2 §22: explicit, granular permissions replace the former broad booleans.
// Every API enforces these server-side; UI hiding is never the control.
export const PERMISSION_KEYS = [
  "VIEW_CERTIFICATES",
  "CREATE_CERTIFICATE",
  "PREVIEW_CERTIFICATE",
  "ISSUE_CERTIFICATE",
  "REISSUE_CERTIFICATE",
  "REVOKE_CERTIFICATE",
  "DOWNLOAD_CERTIFICATE",
  "VIEW_AUDIT",
  "EXPORT_REPORTS",
  "MANAGE_COURSES",
  "MANAGE_SIGNATORIES",
  "MANAGE_TEMPLATES",
  "MANAGE_ADMINS",
  "MANAGE_SETTINGS",
  "VIEW_HEALTH",
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

export type AdminUser = {
  id: string;
  username: string;
  role: "super_admin" | "admin" | "staff";
  permissions: Record<Permission, boolean>;
  mfaEnabled?: boolean;
  sessionInfo?: {
    mfa_verified: boolean;
    scope?: string;
  };
};

// V2 §15: the persistence shape of an admin account (never leaves the server
// with password_hash / mfa_secret attached).
export type AdminUserRecord = AdminUser & {
  password_hash: string;
  is_active: boolean;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminSessionRecord = {
  id: string;
  admin_user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
  ip_address: string | null;
  user_agent: string | null;
  mfa_verified?: boolean;
  scope?: string;
};

export type AdminLoginEventRecord = {
  id: string;
  admin_user_id: string | null;
  username: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type PublicVerificationResponse = {
  valid: boolean;
  status: VerificationStatus;
  certificate?: {
    certificateNumber: string;
    recipientName: string;
    programTitle: string;
    duration: string;
    trainingProvider?: string;
    modules?: Array<{ order: number; title: string; subtitle?: string | null }>;
    completionDate?: string;
    issueDate: string;
    grade?: string;
    issuer: string;
    status: VerificationStatus;
    revokedAt?: string;
    supersededAt?: string;
  };
  message?: string;
};

export type {
  CertificateCreateInput,
  CertificatePreviewInput,
  CertificateIssueInput,
  CertificateRevokeInput,
  CertificateReissueInput,
  AdminLoginInput,
  SignatoryCreateInput,
  CourseCreateInput,
} from "@/lib/validation/schemas";
