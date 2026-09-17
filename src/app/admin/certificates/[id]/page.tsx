"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import type { CertificateRecord, CertificateModuleRecord, CertificateEvent, AdminUser } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { formatStatus } from "@/lib/utils/certificateStatus";
import {
  Alert,
  Badge,
  statusToTone,
  Button,
  Icon,
  Modal,
  EmptyState,
  PageHeader,
  Card,
  CardBody,
  SkeletonRows,
} from "@/components/ui";

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

const formatStatusForEvent = (eventType: string): string => {
  const map: Record<string, string> = {
    CREATED: "Certificate Created",
    PREVIEW_GENERATED: "Preview Generated",
    ISSUING: "Issuance Started",
    ISSUED: "Certificate Issued",
    ISSUE_FAILED: "Issuance Failed",
    DOWNLOADED: "Certificate Downloaded",
    VERIFIED: "Certificate Verified",
    REVOKED: "Certificate Revoked",
    REISSUED: "Certificate Reissued",
    SUPERSEDED: "Certificate Superseded",
  };
  return map[eventType] || eventType;
};

const eventBadgeTone = (eventType: string): "slate" | "cyan" | "issued" | "red" | "amber" => {
  switch (eventType) {
    case "ISSUED":
      return "issued";
    case "REISSUED":
      return "amber";
    case "SUPERSEDED":
      return "amber";
    case "REVOKED":
      return "red";
    case "ISSUE_FAILED":
      return "red";
    case "VERIFIED":
      return "cyan";
    case "ISSUING":
      return "cyan";
    default:
      return "slate";
  }
};

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);

  const [showRevoke, setShowRevoke] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [showReissue, setShowReissue] = useState(false);
  const [reissueReason, setReissueReason] = useState("");
  const [refreshCourseData, setRefreshCourseData] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [reissueError, setReissueError] = useState<string | null>(null);
  const [reissuedCert, setReissuedCert] = useState<CertificateRecord | null>(null);
  const reissueKeyRef = useRef<string | null>(null);
  const reissueInFlightRef = useRef(false);

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
  const canRevoke = (user?.permissions.REVOKE_CERTIFICATE || user?.role === "super_admin") && isIssued;
  const canReissue = (user?.permissions.REISSUE_CERTIFICATE || user?.role === "super_admin") && isIssued;

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
    if (!cert || reissueInFlightRef.current) return;
    reissueInFlightRef.current = true;
    setReissuing(true);
    setReissueError(null);
    // V2 §14: one idempotency key per logical operation. Kept across network
    // retries so a retried request replays instead of minting a second cert.
    if (!reissueKeyRef.current) {
      reissueKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    try {
      const res = await apiClient.reissueCertificate(
        cert.id,
        reissueReason.trim(),
        undefined,
        refreshCourseData,
        reissueKeyRef.current
      );
      if (res.success && res.certificate) {
        const newCert = res.certificate as CertificateRecord;
        reissueKeyRef.current = null;
        setReissuedCert(newCert);
        setShowReissue(false);
        await load();
      } else {
        // Definitive application-level outcome — allow a fresh attempt.
        reissueKeyRef.current = null;
        setReissueError(res.errors?.join(", ") || res.error || "Reissue failed");
      }
    } catch (err) {
      // Network/timeout — retain the key so a retry is replay-safe.
      setReissueError(err instanceof Error ? err.message : "Reissue failed");
    } finally {
      reissueInFlightRef.current = false;
      setReissuing(false);
    }
  };

  if (notFound) {
    return (
      <div className="card max-w-lg mx-auto">
        <EmptyState
          icon="search"
          title="Certificate not found"
          message="This certificate may have been deleted or the link is incorrect."
          actionLabel="Back to Certificates"
          actionHref="/admin/certificates"
        />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="card">
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="card max-w-lg mx-auto">
        <EmptyState
          icon="alert"
          title="Unable to load certificate"
          message={error || undefined}
          actionLabel="Back to Certificates"
          actionHref="/admin/certificates"
        />
      </div>
    );
  }

  const verificationBase = typeof window !== "undefined" ? window.location.origin : "";

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Student ID", value: cert.student_id || "—" },
    { label: "Duration", value: cert.duration || "—" },
    { label: "Issue Date", value: formatDateForDisplay(cert.issue_date, "MMM dd, yyyy") },
    { label: "Issued At", value: cert.issued_at ? formatEventTime(cert.issued_at) : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Certificates"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-display text-2xl tracking-tight text-brand-navy">{cert.certificate_number}</span>
            <Badge tone={statusToTone(cert.status)} dot>{formatStatus(cert.status)}</Badge>
          </span>
        }
        description={`${cert.recipient_name} — ${cert.program_title}`}
        actions={
          <>
            {isIssued && (
              <Button iconLeft="download" onClick={() => apiClient.downloadCertificate(cert.id)}>
                Download PDF
              </Button>
            )}
            {canReissue && (
              <Button variant="secondary" iconLeft="refresh" onClick={() => { reissueKeyRef.current = null; setShowReissue(true); }}>
                Reissue
              </Button>
            )}
            {canRevoke && cert.status !== "REVOKED" && (
              <Button variant="danger" iconLeft="remove" onClick={() => setShowRevoke(true)}>
                Revoke
              </Button>
            )}
          </>
        }
      />

      {revokeError && (
        <Alert variant="error" title={revokeError} />
      )}

      {reissuedCert && (
        <Alert variant="success" title={`Reissued as ${reissuedCert.certificate_number}`}>
          <Link href={`/admin/certificates/${reissuedCert.id}`} className="underline underline-offset-2 text-emerald-700">
            View new certificate
          </Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">Certificate record and metadata</p>
          </div>
          <CardBody>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {detailRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">{row.label}</dt>
                  <dd className={`mt-0.5 ${row.label === "Student ID" ? "font-mono" : ""}`}>{row.value}</dd>
                </div>
              ))}
              {cert.completion_date && (
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Completion Date</dt>
                  <dd className="mt-0.5">{formatDateForDisplay(cert.completion_date, "MMM dd, yyyy")}</dd>
                </div>
              )}
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
            </dl>

            <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-muted p-4 text-sm">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-gray-500 text-xs uppercase tracking-wide">Grade</p>
                <p className="mt-0.5 font-display text-xl text-brand-gold font-bold">{cert.grade || "—"}</p>
              </div>
              <div className="col-span-1">
                <p className="text-gray-500 text-xs uppercase tracking-wide">Signatory</p>
                <p className="mt-0.5 font-medium">{cert.signatory_name_snapshot}</p>
                <p className="text-xs text-gray-400">{cert.signatory_position_snapshot}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-xs uppercase tracking-wide">Template</p>
                <p className="mt-0.5 font-mono text-xs">{cert.template_id} v{cert.template_version}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Modules ({data?.modules.length || 0})</p>
              <ol className="space-y-1.5">
                {(data?.modules || []).map((m) => (
                  <li key={m.id} className="text-sm border border-gray-100 rounded-md px-3 py-2 bg-surface-muted/60 flex items-start gap-2">
                    <Icon name="courses" size={15} className="mt-1 text-brand-cyan shrink-0" />
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-800">{m.sort_order}. {m.title}</span>
                      {m.subtitle && <span className="block text-xs text-gray-500 mt-0.5">{m.subtitle}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {isIssued && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">Verification link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs bg-surface-muted border border-gray-200 rounded px-2 py-1.5">
                    {verificationBase}/verify?number={encodeURIComponent(cert.certificate_number)}
                  </code>
                  <a
                    href={`/verify?number=${encodeURIComponent(cert.certificate_number)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 btn-gold px-3 py-1.5 text-xs"
                  >
                    Open
                    <Icon name="external" size={13} />
                  </a>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Public verification uses the certificate number. The QR code printed on the
                  certificate carries a one-way verification token that is never stored in raw form.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-gray-900">Audit Trail</h2>
            <p className="text-xs text-gray-500 mt-0.5">Immutable event history</p>
          </div>
          {(data?.events || []).length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No audit events recorded.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(data?.events || []).map((event) => (
                <li key={event.id} className="px-6 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-surface-subtle flex items-center justify-center">
                        <Icon
                          name={event.event_type === "REVOKED" ? "remove" : event.event_type === "VERIFIED" ? "shield" : "certificate"}
                          size={12}
                          className="text-brand-cyan"
                        />
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {formatStatusForEvent(event.event_type)}
                      </span>
                    </span>
                    <span className="text-xs text-gray-400 text-right">
                      {actorLabel(event.actor_id)} · {formatEventTime(event.created_at)}
                    </span>
                  </div>
                  <div className="mt-1.5 pl-8">
                    <Badge tone={eventBadgeTone(event.event_type)}>
                      {event.event_type}
                    </Badge>
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <pre className="mt-2 ml-8 text-[11px] text-gray-500 bg-surface-muted rounded px-2.5 py-1.5 whitespace-pre-wrap">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={showRevoke}
        onClose={() => { setShowRevoke(false); setRevokeError(null); }}
        title={`Revoke ${cert.certificate_number}?`}
        subtitle="This action is permanent and immediately stops verification."
        maxWidth="max-w-md"
        closeDisabled={revoking}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowRevoke(false); setRevokeError(null); }} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft="remove" onClick={() => void handleRevoke()} disabled={revoking || !revokeReason.trim()}>
              {revoking ? "Revoking..." : "Revoke Certificate"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            This certificate will immediately stop verifying as valid. The recipient would
            need a reissued certificate.
          </p>
          <div>
            <label className="label" htmlFor="revoke-reason">Reason (required, visible in audit log)</label>
            <textarea
              id="revoke-reason"
              className="input min-h-[84px]"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              maxLength={500}
              placeholder="Why is this certificate being revoked?"
              autoFocus
            />
          </div>
          {revokeError && <Alert variant="error" title={revokeError} />}
        </div>
      </Modal>

      <Modal
        open={showReissue}
        onClose={() => { setShowReissue(false); setReissueError(null); reissueKeyRef.current = null; }}
        title={`Reissue ${cert.certificate_number}`}
        subtitle="A new certificate number will be generated from this record."
        closeDisabled={reissuing}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowReissue(false); setReissueError(null); }} disabled={reissuing}>
              Cancel
            </Button>
            <Button variant="success" iconLeft="refresh" onClick={() => void handleReissue()} disabled={reissuing || !reissueReason.trim()}>
              {reissuing ? "Reissuing..." : "Reissue Certificate"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="reissue-reason">Reason (required)</label>
            <textarea
              id="reissue-reason"
              className="input min-h-[84px]"
              value={reissueReason}
              onChange={(e) => setReissueReason(e.target.value)}
              maxLength={500}
              placeholder="Why is this certificate being reissued?"
              autoFocus
            />
          </div>
          <fieldset>
            <legend className="label mb-2">Course data for the new certificate</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`cursor-pointer rounded-lg border-2 p-3.5 transition-colors ${!refreshCourseData ? "border-brand-navy bg-brand-navy/5" : "border-gray-200 hover:border-gray-300"}`}>
                <input
                  type="radio"
                  name="refreshCourseData"
                  checked={!refreshCourseData}
                  onChange={() => setRefreshCourseData(false)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!refreshCourseData ? "border-brand-navy" : "border-gray-300"}`}>
                    {!refreshCourseData && <span className="w-2 h-2 rounded-full bg-brand-navy" />}
                  </span>
                  Keep original
                </span>
                <span className="block text-xs text-gray-500 mt-1.5 pl-6">
                  Keep the program/module data as originally issued.
                </span>
              </label>
              <label className={`cursor-pointer rounded-lg border-2 p-3.5 transition-colors ${refreshCourseData ? "border-brand-navy bg-brand-navy/5" : "border-gray-200 hover:border-gray-300"}`}>
                <input
                  type="radio"
                  name="refreshCourseData"
                  checked={refreshCourseData}
                  onChange={() => setRefreshCourseData(true)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${refreshCourseData ? "border-brand-navy" : "border-gray-300"}`}>
                    {refreshCourseData && <span className="w-2 h-2 rounded-full bg-brand-navy" />}
                  </span>
                  Refresh from catalog
                </span>
                <span className="block text-xs text-gray-500 mt-1.5 pl-6">
                  Use the current course catalog data, if the content has changed.
                </span>
              </label>
            </div>
          </fieldset>
          {reissueError && <Alert variant="error" title={reissueError} />}
        </div>
      </Modal>
    </div>
  );
}