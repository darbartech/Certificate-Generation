"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import { Button, Icon, PageHeader, StatTile, Card, CardHeader, Badge, type BadgeTone, Spinner, Alert } from "@/components/ui";

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

const eventTone: Record<string, BadgeTone> = {
  ISSUED: "issued",
  REISSUED: "amber",
  SUPERSEDED: "amber",
  REVOKED: "red",
  ISSUE_FAILED: "red",
  ISSUING: "cyan",
  VERIFIED: "cyan",
  DOWNLOADED: "slate",
  CREATED: "slate",
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

function IssuanceChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">No issuance data yet.</div>
    );
  }

  const W = 560;
  const H = 190;
  const padL = 26;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const max = Math.max(...trend.map((p) => p.count));
  const niceMax = Math.max(4, Math.ceil(max / 2) * 2);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = trend.length;
  const slot = innerW / n;
  const barW = Math.min(26, slot * 0.56);

  const yTick = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const gridVals = [0, niceMax / 2, niceMax];

  const tip = (point: TrendPoint) => {
    const d = new Date(point.weekStart + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + `: ${point.count} issued`;
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Certificate issuance trend — bar chart of the last 12 weeks"
        className="w-full min-w-[420px]"
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={yTick(v)}
              x2={W - padR}
              y2={yTick(v)}
              stroke="#e3e8f0"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={yTick(v) + 3.5}
              fontSize={9}
              fill="#8b93ab"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}
        {trend.map((point, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const y = yTick(point.count);
          const h = padT + innerH - y;
          const isLast = i === n - 1;
          return (
            <g key={point.weekStart}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={3}
                fill={isLast ? "#3e92cc" : "#0a2463"}
                opacity={isLast ? 1 : 0.82}
              >
                <title>{tip(point)}</title>
              </rect>
              <text
                x={padL + i * slot + slot / 2}
                y={H - 8}
                fontSize={8.5}
                fill="#8b93ab"
                textAnchor="middle"
              >
                {new Date(point.weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-gray-400">Latest week highlighted in cyan</p>
    </div>
  );
}

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

  const trendPct = summary
    ? summary.issuedPrev30d > 0
      ? Math.round(((summary.issuedLast30d - summary.issuedPrev30d) / summary.issuedPrev30d) * 100)
      : summary.issuedLast30d > 0
        ? 100
        : 0
    : 0;
  const trendUp = summary ? summary.issuedLast30d >= summary.issuedPrev30d : true;
  const maxCourseCount = Math.max(1, ...byCourse.map((c) => c.count));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Operational overview of certificate issuance and verification"
        actions={
          <>
            <Button variant="secondary" iconLeft="refresh" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Link href="/admin/certificates/new">
              <Button iconLeft="plus">New Certificate</Button>
            </Link>
          </>
        }
      />

      {error && (
        <Alert variant="error" title="Failed to load">
          {error}
        </Alert>
      )}

      {loading && !summary ? (
        <Spinner key="spinner" label="Loading dashboard..." />
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <StatTile
              icon="certificate"
              accent="navy"
              label="Issued (30d)"
              value={summary.issuedLast30d}
              delta={trendPct}
              deltaUp={trendUp}
            />
            <StatTile
              icon="edit"
              accent="amber"
              label="Drafts"
              value={summary.draftCount}
              hint="Pending certificates"
            />
            <StatTile
              icon="remove"
              accent="red"
              label="Revoked"
              value={summary.revokedCount}
              hint="All time"
            />
            <StatTile
              icon="verify"
              accent="cyan"
              label="Verified (7d)"
              value={summary.verifiedLast7d}
              hint="Public verifications"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Issuance trend</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Last 12 weeks</p>
                </div>
                <span className="text-xs text-gray-400">
                  {summary.issuedLast30d} in last 30 days
                </span>
              </CardHeader>
              <div className="card-body">
                <IssuanceChart trend={trend} />
              </div>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">By course</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Last 90 days, top 5</p>
                </div>
              </CardHeader>
              <div className="card-body">
                {byCourse.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No certificates issued in this window.</p>
                ) : (
                  <div className="space-y-4">
                    {byCourse.map((row) => (
                      <div key={row.courseId || "manual"} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate pr-3">{row.courseTitle}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{row.count}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-cyan"
                            style={{ width: `${Math.round((row.count / maxCourseCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Latest certificate events</p>
                </div>
              </CardHeader>
              <div className="card-body">
                {activity.length === 0 ? (
                  <p className="py-12 text-center text-gray-400 text-sm">No recent activity.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {activity.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/admin/certificates/${item.certificateId}`}
                          className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-muted transition-colors"
                        >
                          <span className="w-8 h-8 shrink-0 rounded-full bg-surface-subtle flex items-center justify-center">
                            <Icon
                              name={item.event_type === "REVOKED" ? "remove" : item.event_type === "VERIFIED" ? "shield" : "certificate"}
                              size={15}
                              className="text-brand-cyan"
                            />
                          </span>
                          <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                            {item.description}
                          </span>
                          <Badge tone={eventTone[item.event_type] || "slate"}>{item.event_type}</Badge>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {item.actorLabel} · {timeAgo(item.created_at)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card accent={summary.attention.staleDrafts.length + summary.attention.invalidModuleCourses.length > 0 ? "red" : "navy"}>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">Attention needed</h2>
                <p className="text-xs text-gray-500 mt-0.5">Items requiring review</p>
              </CardHeader>
              <div className="card-body space-y-4">
                {summary.attention.staleDrafts.length === 0 && summary.attention.invalidModuleCourses.length === 0 ? (
                  <Alert variant="success" className="bg-emerald-50/60">
                    <div className="flex items-center gap-2">
                      <Icon name="check" size={15} className="text-emerald-600" />
                      Nothing needs attention
                    </div>
                  </Alert>
                ) : (
                  <>
                    {summary.attention.staleDrafts.length > 0 && (
                      <div className="border-l-[3px] border-amber-400 pl-3">
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
                      <div className="border-l-[3px] border-red-400 pl-3">
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
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}