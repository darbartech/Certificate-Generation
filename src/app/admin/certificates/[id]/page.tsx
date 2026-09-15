"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import type { CertificateRecord, CertificateModuleRecord, CertificateEvent, AdminUser } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { statusBadgeClass, formatStatus } from "@/lib/utils/certificateStatus";

type DetailResult = {
  certificate: CertificateRecord;
  modules: CertificateModuleRecord[];
  events: CertificateEvent[];
};

const actorLabel = (actorId: string | null | undefined): string => {
  if (!actorId) return "public";
  return actorId === "user-super-admin" ? "admin" : actorId === "user-admin" ? "staff" : actorId;
};

const formatEventTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);

  // Revoke dialog state
  const [showRevoke, setShowRevoke] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Reissue dialog state
  const [showReissue, setShowReissue] = useState(false);
  const [reissueReason, setReissueReason] = useState("");
  const [refreshCourseData, setRefreshCourseData] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [reissueError, setReissueError] = useState<string | null>(null);
  const [reissuedCert, setReissuedCert] = useState<CertificateRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const res = await apiClient.getCertificate(params.id);
      if (res.success && res.certificate) {
        setData({
          certificate: res.certificate as CertificateRecord,
          modules: (res.modules || []) as CertificateModuleRecord[],
          events: (res.events || []) as CertificateEvent[],
        });
      } else if (res.error?.toLowerCase().includes("not found") || res.errors?.some((e) => e.toLowerCase().includes("not found"))) {
        setNotFound(true);
      } else {
        setError(res.error || res.errors?.join(", ") || "Failed to load certificate");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load certificate");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const stored = localStorage.getItem("dt_admin");
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AdminUser);
      } catch {}
    }
    void load();
  }, [load]);

  const cert = data?.certificate;
  const isIssued = cert?.status === "ISSUED" || cert?.status === "REISSUED";
  const canRevoke = (user?.permissions.revoke || user?.role === "super_admin") && isIssued;
  const canReissue = (user?.permissions.issue || user?.role === "super_admin") && isIssued;

  const handleRevoke = async () => {
    if (!cert) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await apiClient.revokeCertificate(cert.id, revokeReason.trim());
      if (res.success) {
        setShowRevoke(false);
        setRevokeReason("");
        await load();
      } else {
        setRevokeError(res.errors?.join(", ") || res.error || "Revocation failed");
      }
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Revocation failed");
    } finally {
      setRevoking(false);
    }
  };

  const handleReissue = async () => {
    if (!cert) return;
    setReissuing(true);
    setReissueError(null);
    try {
      const res = await apiClient.reissueCertificate(
        cert.id,
        reissueReason.trim(),
        undefined,
        refreshCourseData
      );
      if (res.success && res.certificate) {
        const newCert = res.certificate as CertificateRecord;
        setReissuedCert(newCert);
        setShowReissue(false);
        await load();
      } else {
        setReissueError(res.errors?.join(", ") || res.error || "Reissue failed");
      }
    } catch (err) {
      setReissueError(err instanceof Error ? err.message : "Reissue failed");
    } finally {
      setReissuing(false);
    }
  };

  if (notFound) {
    return (
      <div className="card card-body py-20 text-center max-w-lg mx-auto">
        <p className="text-2xl mb-2">🔍</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Certificate not found</h1>
        <p className="text-sm text-gray-500 mb-6">This certificate may have been deleted or the link is incorrect.</p>
        <Link href="/admin/certificates" className="btn-primary">← Back to Certificates</Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="card card-body py-20 text-center text-gray-500">
        <span className="spinner w-6 h-6 border-brand-navy border-t-transparent"></span>
        <p className="mt-3 text-sm">Loading certificate...</p>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="card card-body py-20 text-center max-w-lg mx-auto">
        {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
        <Link href="/admin/certificates" className="btn-primary">← Back to Certificates</Link>
      </div>
    );
  }

  const verificationBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/certificates" className="text-sm text-gray-500 hover:text-gray-800">← Back</Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{cert.certificate_number}</h1>
              <span className={`badge ${statusBadgeClass(cert.status)}`}>{formatStatus(cert.status)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {cert.recipient_name} — {cert.program_title}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isIssued && (
            <button type="button" onClick={() => apiClient.downloadCertificate(cert.id)} className="btn-primary text-sm">
              Download PDF
            </button>
          )}
          {canReissue && (
            <button type="button" onClick={() => setShowReissue(true)} className="btn-secondary text-sm">
              Reissue
            </button>
          )}
          {canRevoke && cert.status !== "REVOKED" && (
            <button type="button" onClick={() => setShowRevoke(true)} className="btn-danger text-sm">
              Revoke
            </button>
          )}
        </div>
      </div>

      {revokeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{revokeError}</p>
        </div>
      )}

      {reissuedCert && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-emerald-800 font-medium">
            Reissued as <span className="font-mono">{reissuedCert.certificate_number}</span>
          </p>
          <Link href={`/admin/certificates/${reissuedCert.id}`} className="text-xs font-medium text-emerald-700 underline underline-offset-2">
            View new certificate →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Details</h2>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Student ID</dt>
                <dd className="font-mono mt-0.5">{cert.student_id || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Duration</dt>
                <dd className="mt-0.5">{cert.duration || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Grade</dt>
                <dd className="mt-0.5 text-brand-gold font-semibold">{cert.grade || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Issue Date</dt>
                <dd className="mt-0.5">{formatDateForDisplay(cert.issue_date, "MMM dd, yyyy")}</dd>
              </div>
              {cert.completion_date && (
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Completion Date</dt>
                  <dd className="mt-0.5">{formatDateForDisplay(cert.completion_date, "MMM dd, yyyy")}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Issued At</dt>
                <dd className="mt-0.5">{cert.issued_at ? formatEventTime(cert.issued_at) : "—"}</dd>
              </div>
              {cert.revoked_at && (
                <>
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wide">Revoked At</dt>
                    <dd className="mt-0.5">{formatEventTime(cert.revoked_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wide">Revocation Reason</dt>
                    <dd className="mt-0.5 text-red-700">{cert.revocation_reason || "—"}</dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Signatory</dt>
                <dd className="mt-0.5">{cert.signatory_name_snapshot}</dd>
                <dd className="text-xs text-gray-400">{cert.signatory_position_snapshot}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Template</dt>
                <dd className="mt-0.5 font-mono text-xs">{cert.template_id} v{cert.template_version}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Modules ({data?.modules.length || 0})</p>
              <ol className="space-y-1.5">
                {(data?.modules || []).map((m) => (
                  <li key={m.id} className="text-sm border border-gray-100 rounded-md px-3 py-2 bg-gray-50">
                    <span className="font-semibold text-gray-800">{m.sort_order}. {m.title}</span>
                    {m.subtitle && <span className="block text-xs text-gray-500 mt-0.5">{m.subtitle}</span>}
                  </li>
                ))}
              </ol>
            </div>

            {isIssued && cert.verification_token && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">Verification link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                    {verificationBase}/verify/{cert.verification_token}
                  </code>
                  <a
                    href={`/verify/${cert.verification_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold text-xs px-3 py-1.5"
                  >
                    Open
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Audit Trail</h2>
          </div>
          {(data?.events || []).length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No audit events recorded.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(data?.events || []).map((event) => (
                <li key={event.id} className="px-6 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">{formatStatusForEvent(event.event_type)}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {actorLabel(event.actor_id)} · {formatEventTime(event.created_at)}
                    </span>
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <pre className="mt-1.5 text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showRevoke && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 id="revoke-title" className="text-lg font-bold text-gray-900">Revoke {cert.certificate_number}?</h2>
            <p className="text-sm text-gray-500 mt-2">
              This certificate will immediately stop verifying as valid. This cannot be undone
              directly — the recipient would need a reissued certificate.
            </p>
            <label className="label mt-4">Reason (required, visible in audit log)</label>
            <textarea
              className="input min-h-[72px]"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              maxLength={500}
              placeholder="Why is this certificate being revoked?"
            />
            {revokeError && <p className="text-xs text-red-600 mt-2">{revokeError}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" className="btn-secondary" onClick={() => { setShowRevoke(false); setRevokeError(null); }} disabled={revoking}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleRevoke()}
                disabled={revoking || !revokeReason.trim()}
              >
                {revoking ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReissue && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="reissue-title">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 id="reissue-title" className="text-lg font-bold text-gray-900">Reissue {cert.certificate_number}</h2>
            <label className="label mt-4">Reason (required)</label>
            <textarea
              className="input min-h-[72px]"
              value={reissueReason}
              onChange={(e) => setReissueReason(e.target.value)}
              maxLength={500}
              placeholder="Why is this certificate being reissued?"
            />
            <fieldset className="mt-4">
              <legend className="label mb-2">Course data for the new certificate</legend>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="refreshCourseData"
                    checked={!refreshCourseData}
                    onChange={() => setRefreshCourseData(false)}
                    className="mt-0.5"
                  />
                  <span>
                    Keep the original program/module data as originally issued
                    <span className="block text-xs text-gray-400">Use this if the certificate content is correct as issued.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="refreshCourseData"
                    checked={refreshCourseData}
                    onChange={() => setRefreshCourseData(true)}
                    className="mt-0.5"
                  />
                  <span>
                    Refresh program/module data from the current course catalog
                    <span className="block text-xs text-gray-400">Use this if the course content has changed since first issued.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            {reissueError && <p className="text-xs text-red-600 mt-2">{reissueError}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" className="btn-secondary" onClick={() => { setShowReissue(false); setReissueError(null); }} disabled={reissuing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => void handleReissue()}
                disabled={reissuing || !reissueReason.trim()}
              >
                {reissuing ? "Reissuing..." : "Reissue Certificate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const formatStatusForEvent = (eventType: string): string => {
  const map: Record<string, string> = {
    CREATED: "Certificate Created",
    PREVIEW_GENERATED: "Preview Generated",
    ISSUED: "Certificate Issued",
    DOWNLOADED: "Certificate Downloaded",
    VERIFIED: "Certificate Verified",
    REVOKED: "Certificate Revoked",
    REISSUED: "Certificate Reissued",
  };
  return map[eventType] || eventType;
};