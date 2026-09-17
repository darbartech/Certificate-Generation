export type CertificateStatus =
  | "DRAFT"
  | "PREVIEW"
  | "ISSUED"
  | "REVOKED"
  | "REISSUED"
  | "CANCELLED";

export type VerificationStatus = "VALID" | "REVOKED" | "NOT_FOUND";

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
  verification_token: string;
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

  issued_at?: string | null;
  created_at: string;
  updated_at: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;

  reissued_from_id?: string | null;
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
    | "ISSUED"
    | "DOWNLOADED"
    | "VERIFIED"
    | "REVOKED"
    | "REISSUED";
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type CourseRecord = {
  id: string;
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

export type AdminUser = {
  id: string;
  username: string;
  role: "super_admin" | "admin" | "staff";
  permissions: {
    create: boolean;
    preview: boolean;
    issue: boolean;
    revoke: boolean;
    download: boolean;
    manageTemplates: boolean;
  };
};

export type PublicVerificationResponse = {
  valid: boolean;
  status: VerificationStatus;
  verification_token?: string;
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
    revocationReason?: string;
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
