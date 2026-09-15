const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "DRAFT": return "badge-draft";
    case "PREVIEW": return "badge-preview";
    case "ISSUED": return "badge-issued";
    case "REVOKED": return "badge-revoked";
    case "REISSUED": return "badge-reissued";
    case "CANCELLED": return "badge-cancelled";
    default: return "badge-draft";
  }
};

const formatStatus = (status: string): string => {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    PREVIEW: "Preview",
    ISSUED: "Issued",
    REVOKED: "Revoked",
    REISSUED: "Reissued",
    CANCELLED: "Cancelled",
  };
  return map[status] || status;
};

export { statusBadgeClass, formatStatus };
