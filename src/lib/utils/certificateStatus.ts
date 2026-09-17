import type { CertificateStatus } from "@/lib/types";
import { InvalidStateTransitionError } from "@/lib/errors";

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "DRAFT": return "badge-draft";
    case "PREVIEW": return "badge-preview";
    case "ISSUING": return "badge-preview";
    case "ISSUED": return "badge-issued";
    case "REVOKED": return "badge-revoked";
    case "ISSUE_FAILED": return "badge-revoked";
    case "REISSUED": return "badge-reissued";
    case "SUPERSEDED": return "badge-reissued";
    case "CANCELLED": return "badge-cancelled";
    default: return "badge-draft";
  }
};

const formatStatus = (status: string): string => {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    PREVIEW: "Preview",
    ISSUING: "Issuing",
    ISSUED: "Issued",
    REVOKED: "Revoked",
    ISSUE_FAILED: "Issue Failed",
    REISSUED: "Reissued",
    SUPERSEDED: "Superseded",
    CANCELLED: "Cancelled",
  };
  return map[status] || status;
};

export type TransitionOptions = {
  isSystemRecovery?: boolean;
  isReissueSupersede?: boolean;
};

export const canTransition = (
  current: CertificateStatus,
  next: CertificateStatus,
  opts: TransitionOptions = {}
): boolean => {
  if (next === "PREVIEW") return true;

  switch (current) {
    case "DRAFT":
      return next === "ISSUING" || next === "CANCELLED";
    case "ISSUING":
      return next === "ISSUED" || next === "ISSUE_FAILED";
    case "ISSUE_FAILED":
      if (next === "ADMIN_REVIEW") return true;
      if (opts.isSystemRecovery && next === "ISSUING") return true;
      return false;
    case "ADMIN_REVIEW":
      return next === "ISSUING" || next === "CANCELLED";
    case "ISSUED":
      return next === "REVOKED" || next === "SUPERSEDED";
    case "SUPERSEDED":
      return next === "REVOKED";
    case "REISSUED":
      return next === "SUPERSEDED" || next === "REVOKED";
    case "REVOKED":
    case "CANCELLED":
      return false;
    case "PREVIEW":
      return next === "ISSUING";
    default:
      return false;
  }
};

export const assertValidTransition = (
  current: CertificateStatus,
  next: CertificateStatus,
  opts: TransitionOptions = {},
  requestId?: string
): void => {
  if (!canTransition(current, next, opts)) {
    throw new InvalidStateTransitionError(
      `Invalid certificate state transition: ${current} → ${next}`,
      current,
      next,
      requestId
    );
  }
};

export { statusBadgeClass, formatStatus };
