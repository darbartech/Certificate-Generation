"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import type { CertificateRecord } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { statusBadgeClass, formatStatus } from "@/lib/utils/certificateStatus";

const PAGE_SIZE = 15;

type Stats = { total: number; issued: number; draft: number; revoked: number };

export default function CertificatesListPage() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, issued: 0, draft: 0, revoked: 0 });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.listCertificates({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter || undefined,
        q: debouncedQuery || undefined,
      });
      if (result.success && result.data) {
        setCertificates(result.data as unknown as CertificateRecord[]);
        setTotalCount(result.pagination?.total || result.data.length);
        if (result.stats) setStats(result.stats);
      }
    } catch (err) {
      console.error("Failed to load certificates", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiClient.downloadCertificate(id);
    } catch (err) {
      alert("Download failed. Certificate may not yet be issued.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage, issue, and verify certificates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="REISSUED">Reissued</option>
            <option value="REVOKED">Revoked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Link href="/admin/certificates/new" className="btn-primary">
            <span className="mr-2">+</span> New Certificate
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Issued</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.issued}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Draft</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{stats.draft}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Revoked</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.revoked}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
            <input
              className="input pl-8"
              placeholder="Search by name, certificate no., or student ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            {totalCount} {totalCount === 1 ? "result" : "results"}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <span className="spinner w-6 h-6 border-brand-navy border-t-transparent"></span>
            <p className="mt-3 text-sm">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-500 mb-4">No certificates found.</p>
            <Link href="/admin/certificates/new" className="btn-primary">
              Create your first certificate
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="table-header">Certificate No.</th>
                    <th className="table-header">Recipient</th>
                    <th className="table-header">Program</th>
                    <th className="table-header">Issue Date</th>
                    <th className="table-header">Grade</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {certificates.map((cert) => (
                    <tr
                      key={cert.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/certificates/${cert.id}`)}
                    >
                      <td className="table-cell">
                        <span className="font-mono text-xs font-medium text-brand-navy">
                          {cert.certificate_number}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-gray-900">{cert.recipient_name}</p>
                          <p className="text-xs text-gray-500">{cert.duration}</p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm max-w-xs truncate block">{cert.program_title}</span>
                      </td>
                      <td className="table-cell text-sm text-gray-500">
                        {formatDateForDisplay(cert.issue_date, "MMM dd, yyyy")}
                      </td>
                      <td className="table-cell">
                        {cert.grade ? (
                          <span className="font-semibold text-brand-gold">
                            {cert.grade}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${statusBadgeClass(cert.status)}`}>
                          {formatStatus(cert.status)}
                        </span>
                      </td>
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {(cert.status === "ISSUED" || cert.status === "REISSUED") && (
                            <button
                              onClick={(e) => handleDownload(cert.id, e)}
                              className="btn-secondary px-2.5 py-1 text-xs"
                              title="Download PDF"
                            >
                              Download
                            </button>
                          )}
                          <Link
                            href={`/verify/${cert.verification_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-2.5 py-1 text-xs"
                            title="View verification page"
                          >
                            Verify
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary px-2.5 py-1 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    className="btn-secondary px-2.5 py-1 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}