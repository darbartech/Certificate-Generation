import { db } from "@/lib/database";
import { getUsernameById } from "./authService";
import { DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";
import type { CertificateEvent, CertificateRecord } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const iso = (d: Date): string => d.toISOString();

export type ActivityItem = {
  id: string;
  event_type: CertificateEvent["event_type"];
  created_at: string;
  actorLabel: string;
  certificateId: string;
  certificate_number: string;
  description: string;
};

export type DashboardSummary = {
  issuedLast30d: number;
  issuedPrev30d: number;
  draftCount: number;
  revokedCount: number;
  verifiedLast7d: number;
  generatedAt: string;
attention: {
      staleDrafts: Array<{
        id: string;
        recipient_name: string;
        program_title: string;
        created_at: string;
      }>;
      invalidModuleCourses: Array<{
        id: string;
        code: string;
        title: string;
        moduleCount: number;
        requiredText: string;
      }>;
    };
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const now = Date.now();
  const since30 = iso(new Date(now - 30 * DAY_MS));
  const since60 = iso(new Date(now - 60 * DAY_MS));
  const since7 = iso(new Date(now - 7 * DAY_MS));
  const staleCutoff = iso(new Date(now - 7 * DAY_MS));

  const [issuedLast30d, issuedPrev30d, draftCount, revokedCount, recentEvents, staleDraftsRaw, courses] =
    await Promise.all([
      db.certificates.count({
        statuses: ["ISSUED", "REISSUED"],
        since: since30,
        dateField: "issued_at",
      }),
      db.certificates.count({
        statuses: ["ISSUED", "REISSUED"],
        since: since60,
        until: since30,
        dateField: "issued_at",
      }),
      db.certificates.count({ status: "DRAFT" }),
      db.certificates.count({ status: "REVOKED" }),
      db.certificateEvents.list({ since: since7 }),
      db.certificates.list({ status: "DRAFT", limit: 200 }),
      db.courses.list(false),
    ]);

  const verifiedLast7d = recentEvents.filter((e) => e.event_type === "VERIFIED").length;

  const staleDrafts = staleDraftsRaw
    .filter((c) => new Date(c.created_at).getTime() < new Date(staleCutoff).getTime())
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      recipient_name: c.recipient_name,
      program_title: c.program_title,
      created_at: c.created_at,
    }));

  // A course is only advertised as safe to issue when its active module count
  // satisfies the template's module constraints. Flagging just zero-module
  // courses hid courses whose count can't render (e.g. 3 or 5 modules against
  // a template that requires exactly 4), which only failed at issue time.
  const { minCount, maxCount } = DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints;
  const requiredText = minCount === maxCount ? String(minCount) : `${minCount}–${maxCount}`;
  const isModuleCountValid = (count: number): boolean =>
    minCount === maxCount
      ? count === minCount
      : count >= minCount && count <= maxCount;

  const invalidModuleCourses: Array<{
    id: string;
    code: string;
    title: string;
    moduleCount: number;
    requiredText: string;
  }> = [];
  for (const course of courses) {
    if (course.active === false) continue;
    const modules = await db.courseModules.findByCourseId(course.id, true);
    if (!isModuleCountValid(modules.length)) {
      invalidModuleCourses.push({
        id: course.id,
        code: course.code,
        title: course.title,
        moduleCount: modules.length,
        requiredText,
      });
    }
  }

  return {
    issuedLast30d,
    issuedPrev30d,
    draftCount,
    revokedCount,
    verifiedLast7d,
    generatedAt: new Date().toISOString(),
    attention: { staleDrafts, invalidModuleCourses },
  };
};

export const getIssuanceTrend = async (weeks = 12): Promise<Array<{ weekStart: string; count: number }>> => {
  const now = Date.now();
  const out: Array<{ weekStart: string; count: number }> = [];
  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now - i * 7 * DAY_MS);
    const weekStartDate = new Date(now - (i + 1) * 7 * DAY_MS);
    const count = await db.certificates.count({
      statuses: ["ISSUED", "REISSUED"],
      since: iso(weekStartDate),
      until: iso(weekEnd),
      dateField: "issued_at",
    });
    out.unshift({
      weekStart: weekStartDate.toISOString().slice(0, 10),
      count,
    });
  }
  return out;
};

export const getCertificatesByCourse = async (
  limit = 5,
  days = 90
): Promise<Array<{ courseId: string | null; courseTitle: string; count: number }>> => {
  const since = iso(new Date(Date.now() - days * DAY_MS));
  const certs = await db.certificates.list({
    limit: 5000,
    since,
    dateField: "issued_at",
  });

  const counts = new Map<string, { courseId: string | null; courseTitle: string; count: number }>();
  let manualCount = 0;
  for (const c of certs) {
    if (c.status !== "ISSUED" && c.status !== "REISSUED") continue;
    if (!c.program_id) {
      manualCount++;
      continue;
    }
    const key = c.program_id;
    const entry = counts.get(key) || {
      courseId: c.program_id,
      courseTitle: c.program_title,
      count: 0,
    };
    entry.courseTitle = entry.courseTitle || c.program_title;
    entry.count++;
    counts.set(key, entry);
  }

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, limit);
  if (manualCount > 0) {
    sorted.push({ courseId: null, courseTitle: "Manual / uncatalogued", count: manualCount });
  }
  return sorted;
};

const describeEvent = (event: CertificateEvent, cert: CertificateRecord | undefined): string => {
  const meta = (event.metadata || {}) as Record<string, unknown>;
  switch (event.event_type) {
    case "ISSUED":
      return `${(meta.recipientName as string) || cert?.recipient_name || "—"} — ${(meta.programTitle as string) || cert?.program_title || "—"}`;
    case "REISSUED":
      return `${cert?.certificate_number || "—"}${event.metadata?.reason ? ` — ${String(event.metadata.reason)}` : ""}`;
    case "REVOKED":
      return `${cert?.certificate_number || "—"}${event.metadata?.reason ? ` — ${String(event.metadata.reason)}` : ""}`;
    case "VERIFIED":
      return cert?.certificate_number || "—";
    case "DOWNLOADED":
      return cert?.certificate_number || "—";
    default:
      return `${cert?.recipient_name || "—"} — ${cert?.program_title || "—"}`;
  }
};

export const getRecentActivity = async (limit = 15): Promise<ActivityItem[]> => {
  const events = await db.certificateEvents.list({ limit });
  const certIds = Array.from(new Set(events.map((e) => e.certificate_id)));
  const certs = await Promise.all(certIds.map((id) => db.certificates.findById(id)));
  const certMap = new Map<string, CertificateRecord>(
    certs.filter((c): c is CertificateRecord => !!c).map((c) => [c.id, c])
  );

  return events.map((event) => {
    const cert = certMap.get(event.certificate_id);
    const user = getUsernameById(event.actor_id);
    return {
      id: event.id,
      event_type: event.event_type,
      created_at: event.created_at,
      actorLabel: event.actor_id ? (user ?? "admin") : "public",
      certificateId: event.certificate_id,
      certificate_number: cert?.certificate_number || "—",
      description: describeEvent(event, cert),
    };
  });
};