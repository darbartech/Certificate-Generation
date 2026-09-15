import type {
  AdminUser,
  CertificateRecord,
  CertificateModuleRecord,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
  PublicVerificationResponse,
} from "@/lib/types";
import type { CertificateCreateInput } from "@/lib/validation/schemas";

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  errors?: string[];
  error?: string;
  message?: string;
  user?: AdminUser;
  certificate?: CertificateRecord;
  modules?: CertificateModuleRecord[];
  preview?: string;
  warnings?: string[];
  events?: unknown[];
  pagination?: { limit: number; offset: number; total: number };
  stats?: { total: number; issued: number; draft: number; revoked: number };
};

const handleResponse = async <T>(res: Response): Promise<ApiResponse<T>> => {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/pdf")) {
    const buffer = await res.arrayBuffer();
    const blob = new Blob([buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    return { success: true, preview: url } as unknown as ApiResponse<T>;
  }

  let data: ApiResponse<T>;
  try {
    data = await res.json();
  } catch {
    data = { success: res.ok, error: res.statusText };
  }

  if (!res.ok && res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dt_admin");
      window.dispatchEvent(new CustomEvent("dt-auth-expired"));
    }
  }

  return data;
};

const getHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
});

export const apiClient = {
  async login(username: string, password: string): Promise<ApiResponse<AdminUser>> {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    return handleResponse<AdminUser>(res);
  },

  async logout(): Promise<ApiResponse> {
    const res = await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    return handleResponse(res);
  },

  async me(): Promise<ApiResponse<AdminUser>> {
    const res = await fetch("/api/admin/me", { credentials: "include" });
    return handleResponse<AdminUser>(res);
  },

  async health(): Promise<ApiResponse<{ useSupabase: boolean; degraded: boolean; circuits: { table: string; open: boolean; failureCount: number; retryAfterMs: number | null }[] }>> {
    const res = await fetch("/api/admin/health", { credentials: "include", cache: "no-store" });
    return handleResponse(res);
  },

  async listCertificates(params: { limit?: number; offset?: number; status?: string; q?: string } = {}): Promise<ApiResponse<CertificateRecord[]>> {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    const res = await fetch(`/api/admin/certificates?${qs.toString()}`, { credentials: "include" });
    return handleResponse<CertificateRecord[]>(res);
  },

  async getCertificate(id: string): Promise<ApiResponse> {
    const res = await fetch(`/api/admin/certificates/${id}`, { credentials: "include" });
    return handleResponse(res);
  },

  async createDraftCertificate(data: CertificateCreateInput): Promise<ApiResponse> {
    const res = await fetch("/api/admin/certificates", {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async generatePreview(data: CertificateCreateInput): Promise<ApiResponse<string>> {
    const res = await fetch("/api/admin/certificates/preview", {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse<string>(res);
  },

  async issueCertificate(draftId: string, certificateData: CertificateCreateInput): Promise<ApiResponse> {
    const res = await fetch(`/api/admin/certificates/${draftId}/issue`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify({ certificateData }),
    });
    return handleResponse(res);
  },

  async revokeCertificate(id: string, reason: string): Promise<ApiResponse> {
    const res = await fetch(`/api/admin/certificates/${id}/revoke`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  async reissueCertificate(
    id: string,
    reason: string,
    updates?: Partial<CertificateCreateInput>,
    refreshCourseData?: boolean
  ): Promise<ApiResponse> {
    const body: Record<string, unknown> = { reason };
    if (updates !== undefined) body.updates = updates;
    if (refreshCourseData !== undefined) body.refreshCourseData = refreshCourseData;
    const res = await fetch(`/api/admin/certificates/${id}/reissue`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async downloadCertificate(id: string): Promise<void> {
    const res = await fetch(`/api/admin/certificates/${id}/download`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Download failed");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `certificate-${id}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  async listCourses(): Promise<ApiResponse<(CourseRecord & { modules: CourseModuleRecord[] })[]>> {
    const res = await fetch("/api/admin/courses", { credentials: "include" });
    return handleResponse<(CourseRecord & { modules: CourseModuleRecord[] })[]>(res);
  },

  async createCourse(
    data: { code: string; title: string; duration: string; modules: Array<{ order: number; title: string; subtitle?: string }> }
  ): Promise<ApiResponse> {
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateCourse(
    id: string,
    data: {
      code?: string;
      title?: string;
      duration?: string;
      active?: boolean;
      modules?: Array<{ order: number; title: string; subtitle?: string }>;
    }
  ): Promise<ApiResponse> {
    const res = await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async listSignatories(): Promise<ApiResponse<SignatoryRecord[]>> {
    const res = await fetch("/api/admin/signatories", { credentials: "include" });
    return handleResponse<SignatoryRecord[]>(res);
  },

  async createSignatory(data: { name: string; position: string; signatureImage?: string; active?: boolean }): Promise<ApiResponse> {
    const res = await fetch("/api/admin/signatories", {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateSignatory(
    id: string,
    data: { name?: string; position?: string; active?: boolean }
  ): Promise<ApiResponse> {
    const res = await fetch(`/api/admin/signatories/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getDashboardSummary(): Promise<ApiResponse<unknown>> {
    const res = await fetch("/api/admin/dashboard/summary", { credentials: "include", cache: "no-store" });
    return handleResponse(res);
  },

  async getIssuanceTrend(weeks = 12): Promise<ApiResponse<unknown>> {
    const res = await fetch(`/api/admin/dashboard/issuance-trend?weeks=${weeks}`, {
      credentials: "include",
      cache: "no-store",
    });
    return handleResponse(res);
  },

  async getCertificatesByCourse(limit = 5, days = 90): Promise<ApiResponse<unknown>> {
    const res = await fetch(`/api/admin/dashboard/by-course?limit=${limit}&days=${days}`, {
      credentials: "include",
      cache: "no-store",
    });
    return handleResponse(res);
  },

  async getRecentActivity(limit = 15): Promise<ApiResponse<unknown>> {
    const res = await fetch(`/api/admin/dashboard/activity?limit=${limit}`, {
      credentials: "include",
      cache: "no-store",
    });
    return handleResponse(res);
  },

  async verifyToken(token: string): Promise<PublicVerificationResponse> {
    const res = await fetch(`/api/public/verify/${token}`);
    return (await res.json()) as PublicVerificationResponse;
  },

  async manualVerify(certificateNumber: string): Promise<PublicVerificationResponse> {
    const res = await fetch("/api/public/verify/manual", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ certificateNumber }),
    });
    return (await res.json()) as PublicVerificationResponse;
  },
};

export default apiClient;
