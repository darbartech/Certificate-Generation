"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";

type DashboardSummary = {
  issuedLast30d: number;
  issuedPrev30d: number;
  draftCount: number;
  revokedCount: number;
  verifiedLast7d: number;
  generatedAt: string;
  attention: {
    staleDrafts: Array<{ id: string; recipient_name: string; program_title: string; created_at: string }>;
    invalidModuleCourses: Array<{ id: string; code: string; title: string; moduleCount: number; requiredText: string }>;
  };
};

type TrendPoint = { weekStart: string; count: number };
type ByCourse = { courseId: string | null; courseTitle: string; count: number };
type ActivityItem = {
  id: string;
  event_type: string;
  created_at: string;
  actorLabel: string;
  certificateId: string;
  certificate_number: string;
  description: string;
};

const eventBadge: Record<string, string> = {
  ISSUED: "badge-issued",
  REISSUED: "badge-reissued",
  REVOKED: "badge-revoked",
  VERIFIED: "badge-preview",
  DOWNLOADED: "badge-draft",
  CREATED: "badge-draft",
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [byCourse, setByCourse] = useState<ByCourse[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, c, a] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.getIssuanceTrend(12),
        apiClient.getCertificatesByCourse(5, 90),
        apiClient.getRecentActivity(15),
      ]);
      if (s.success && s.data) setSummary(s.data as DashboardSummary);
      if (t.success && t.data) setTrend(t.data as TrendPoint[]);
      if (c.success && c.data) setByCourse(c.data as ByCourse[]);
      if (a.success && a.data) setActivity(a.data as ActivityItem[]);
      if (!s.success || !t.success || !c.success || !a.success) {
        setError("One or more dashboard sections failed to load.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trendLabel = (point: TrendPoint) => {
    const d = new Date(point.weekStart + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const trendMax = Math.max(1, ...trend.map((p) => p.count));
  const maxCourseCount = Math.max(1, ...byCourse.map((c) => c.count));

  const trendPct = summary
    ? summary.issuedPrev30d > 0
      ? Math.round(((summary.issuedLast30d - summary.issuedPrev30d) / summary.issuedPrev30d) * 100)
      : summary.issuedLast30d > 0
        ? 100
        : 0
    : 0;
  const trendDelta = summary ? (summary.issuedLast30d >= summary.issuedPrev30d ? "up" : "down") : "flat";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Operational overview of certificate issuance and verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void load()} className="btn-secondary text-sm" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link href="/admin/certificates/new" className="btn-primary">
            <span className="mr-2">+</span> New Certificate
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {loading && !summary ? (
        <div className="card card-body py-20 text-center text-gray-500">
          <span className="spinner w-6 h-6 border-brand-navy border-t-transparent"></span>
          <p className="mt-3 text-sm">Loading dashboard...</p>
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card card-body">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Issued (30d)</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="text-2xl font-bold text-gray-900">{summary.issuedLast30d}</p>
                {summary.issuedPrev30d > 0 ? (
                  <span
                    className={`text-xs font-semibold mb-1 ${
                      trendDelta === "up" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {trendDelta === "up" ? "▲" : "▼"}
                    {Math.abs(trendPct)}%
                  </span>
                ) : null}
              </div>
            </div>
            <div className="card card-body">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Draft</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{summary.draftCount}</p>
            </div>
            <div className="card card-body">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Revoked</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{summary.revokedCount}</p>
            </div>
            <div className="card card-body">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Verified (7d)</p>
              <p className="text-2xl font-bold text-brand-navy mt-1">{summary.verifiedLast7d}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Issuance trend (last 12 weeks)</h2>
              </div>
              {trend.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No issuance data yet.</p>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {trend.map((point, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[10px] text-gray-500">{point.count}</span>
                      <div
                        className="w-full max-w-[22px] rounded-t bg-brand-navy/80 hover:bg-brand-navy transition-colors"
                        style={{ height: `${Math.max(4, Math.round((point.count / trendMax) * 120))}px` }}
                        title={`${trendLabel(point)}: ${point.count} issued`}
                      />
                      <span className="text-[9px] text-gray-400 truncate w-full text-center" title={trendLabel(point)}>
                        {trendLabel(point)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card card-body">
              <h2 className="font-semibold text-gray-900 mb-4">By course (last 90d)</h2>
              {byCourse.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No certificates issued in this window.</p>
              ) : (
                <div className="space-y-3">
                  {byCourse.map((row) => (
                    <div key={row.courseId || "manual"} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate">{row.courseTitle}</span>
                        <span className="font-semibold text-gray-900">{row.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-gold"
                          style={{ width: `${Math.round((row.count / maxCourseCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card overflow-hidden">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Recent activity</h2>
              </div>
              {activity.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No recent activity.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {activity.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/admin/certificates/${item.certificateId}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className={`badge ${eventBadge[item.event_type] || "badge-draft"}`}>
                          {item.event_type}
                        </span>
                        <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                          {item.description}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {item.actorLabel} · {timeAgo(item.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Attention needed</h2>
              </div>
              <div className="card-body space-y-4">
                {summary.attention.staleDrafts.length === 0 && summary.attention.invalidModuleCourses.length === 0 ? (
                  <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-[10px]">✓</span>
                    Nothing needs attention
                  </p>
                ) : (
                  <>
                    {summary.attention.staleDrafts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {summary.attention.staleDrafts.length} stale draft{summary.attention.staleDrafts.length > 1 ? "s" : ""} (&gt;7 days)
                        </p>
                        <ul className="space-y-1.5">
                          {summary.attention.staleDrafts.map((d) => (
                            <li key={d.id} className="text-sm flex items-center justify-between gap-2">
                              <span className="text-gray-700 truncate">{d.recipient_name}</span>
                              <Link href={`/admin/certificates/${d.id}`} className="text-xs text-brand-navy hover:underline whitespace-nowrap">
                                Review
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summary.attention.invalidModuleCourses.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          {summary.attention.invalidModuleCourses.length} course{summary.attention.invalidModuleCourses.length > 1 ? "s" : ""} with module count that can&apos;t render
                        </p>
                        <ul className="space-y-1.5">
                          {summary.attention.invalidModuleCourses.map((c) => (
                            <li key={c.id} className="text-sm flex items-center justify-between gap-2">
                              <span className="text-gray-700 truncate">
                                <span className="font-mono text-xs text-gray-500">{c.code}</span> — {c.title}{" "}
                                <span className="text-xs text-gray-400">
                                  ({c.moduleCount}/{c.requiredText} modules)
                                </span>
                              </span>
                              <Link href="/admin/courses" className="text-xs text-brand-navy hover:underline whitespace-nowrap">
                                Fix
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}