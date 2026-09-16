"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import type { CertificateRecord } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { formatStatus } from "@/lib/utils/certificateStatus";
import {
  Button,
  Icon,
  Badge,
  statusToTone,
  Card,
  PageHeader,
  EmptyState,
  Spinner,
  StatTile,
} from "@/components/ui";

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
      <PageHeader
        eyebrow="Registry"
        title="Certificates"
        description="Manage, issue, and verify certificates"
        actions={
          <Link href="/admin/certificates/new">
            <Button iconLeft="plus">New Certificate</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatTile icon="certificate" accent="navy" label="Total" value={stats.total} />
        <StatTile icon="award" accent="gold" label="Issued" value={stats.issued} />
        <StatTile icon="edit" accent="amber" label="Draft" value={stats.draft} />
        <StatTile icon="remove" accent="red" label="Revoked" value={stats.revoked} />
      </div>

      <Card className="overflow-hidden">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon name="search" size={16} />
            </span>
            <input
              className="input pl-9"
              placeholder="Search by name, certificate no., or student ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search certificates"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PREVIEW">Preview</option>
              <option value="ISSUED">Issued</option>
              <option value="REISSUED">Reissued</option>
              <option value="REVOKED">Revoked</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {totalCount} {totalCount === 1 ? "result" : "results"}
            </p>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading certificates..." />
        ) : certificates.length === 0 ? (
          <EmptyState
            icon="certificate"
            title={debouncedQuery || statusFilter ? "No certificates match your filters" : "No certificates found"}
            message="Create a certificate to start building a verifiable, print-ready record."
            actionLabel="New Certificate"
            actionHref="/admin/certificates/new"
          />
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
                      className="hover:bg-surface-muted cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/certificates/${cert.id}`)}
                    >
                      <td className="table-cell">
                        <span className="font-mono text-xs font-semibold text-brand-navy">
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
                          <span className="font-semibold text-brand-gold tabular-nums">
                            {cert.grade}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <Badge tone={statusToTone(cert.status)}>{formatStatus(cert.status)}</Badge>
                      </td>
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {(cert.status === "ISSUED" || cert.status === "REISSUED") && (
                            <Button
                              variant="secondary"
                              size="sm"
                              iconLeft="download"
                              onClick={(e) => handleDownload(cert.id, e as React.MouseEvent)}
                            >
                              Download
                            </Button>
                          )}
                          <Link
                            href={`/verify/${cert.verification_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="secondary" size="sm" iconLeft="eye">
                              Verify
                            </Button>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft="chevron-left"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="chevron-right"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}