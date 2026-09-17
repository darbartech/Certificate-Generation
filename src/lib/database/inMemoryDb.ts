import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateEvent,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
  ReissueOperation,
  AdminUserRecord,
  AdminSessionRecord,
  AdminLoginEventRecord,
} from "@/lib/types";
import { loadCanonicalCourseCatalog } from "./courseCatalogSeed";
import crypto from "crypto";

const sha256Hex = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

type OutboxRow = {
  id: string;
  certificate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
  attempt_count: number;
  last_error: string | null;
};

type InMemoryStore = {
  certificates: Map<string, CertificateRecord>;
  certificate_modules: Map<string, CertificateModuleRecord[]>;
  certificate_events: Map<string, CertificateEvent[]>;
  event_outbox: Map<string, OutboxRow>;
  courses: Map<string, CourseRecord>;
  course_modules: Map<string, CourseModuleRecord[]>;
  signatories: Map<string, SignatoryRecord>;
  reissue_operations: Map<string, ReissueOperation>;
  admin_users: Map<string, AdminUserRecord>;
  admin_sessions: Map<string, AdminSessionRecord>;
  admin_login_events: Map<string, AdminLoginEventRecord>;
  numberSequence: Map<string, number>;
};

// The fallback store must be shared across every route bundle in a running
// process. Next.js dev compiles each route entry separately, so a module-local
// `Map` would give the login route and the session-resolution route different
// stores — a session created by one is invisible to the other (login succeeds,
// then /api/admin/me returns 401). Pin it to globalThis so all bundles share
// the same process-wide store; in production the in-memory path is never used.
const globalForInMemoryDb = globalThis as unknown as {
  __darbartechInMemoryDb?: InMemoryStore;
};

const db: InMemoryStore =
  globalForInMemoryDb.__darbartechInMemoryDb ?? {
    certificates: new Map<string, CertificateRecord>(),
    certificate_modules: new Map<string, CertificateModuleRecord[]>(),
    certificate_events: new Map<string, CertificateEvent[]>(),
    event_outbox: new Map<string, OutboxRow>(),
    courses: new Map<string, CourseRecord>(),
    course_modules: new Map<string, CourseModuleRecord[]>(),
    signatories: new Map<string, SignatoryRecord>(),
    reissue_operations: new Map<string, ReissueOperation>(),
    admin_users: new Map<string, AdminUserRecord>(),
    admin_sessions: new Map<string, AdminSessionRecord>(),
    admin_login_events: new Map<string, AdminLoginEventRecord>(),
    numberSequence: new Map<string, number>(),
  };

globalForInMemoryDb.__darbartechInMemoryDb = db;

const generateId = (): string => {
  return crypto.randomUUID();
};

export const inMemoryDb = {
  certificates: {
    async create(data: Omit<CertificateRecord, "id" | "created_at" | "updated_at">): Promise<CertificateRecord> {
      const id = generateId();
      const now = new Date().toISOString();
      const record: CertificateRecord = {
        ...data,
        id,
        created_at: now,
        updated_at: now,
      };
      db.certificates.set(id, record);
      return record;
    },

    async update(id: string, data: Partial<CertificateRecord>): Promise<CertificateRecord | null> {
      const existing = db.certificates.get(id);
      if (!existing) return null;
      const updated: CertificateRecord = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      db.certificates.set(id, updated);
      return updated;
    },

    async findById(id: string): Promise<CertificateRecord | null> {
      return db.certificates.get(id) || null;
    },

    async findByNumber(certificateNumber: string): Promise<CertificateRecord | null> {
      for (const cert of db.certificates.values()) {
        if (cert.certificate_number === certificateNumber) return cert;
      }
      return null;
    },

    async findByToken(verificationToken: string): Promise<CertificateRecord | null> {
      const tokenHash = sha256Hex(verificationToken);
      for (const cert of db.certificates.values()) {
        if (cert.verification_token_hash) {
          if (cert.verification_token_hash === tokenHash) return cert;
        }
        // DEV-ONLY LEGACY FALLBACK — never reachable after devOnlyInMemory() production gate
        else if (cert.verification_token === verificationToken) {
          return cert;
        }
      }
      return null;
    },

    async list(options: { limit?: number; offset?: number; status?: string; q?: string; since?: string; until?: string; dateField?: "created_at" | "issued_at" } = {}): Promise<CertificateRecord[]> {
      const results = Array.from(db.certificates.values());
      let filtered = results;
      const q = options.q?.trim().toLowerCase();
      if (q) {
        const matches = (value: string | null | undefined): boolean =>
          !!value && value.toLowerCase().includes(q);
        filtered = results.filter(
          (c) =>
            matches(c.recipient_name) ||
            matches(c.certificate_number) ||
            matches(c.student_id)
        );
      }
      if (options.status) {
        filtered = filtered.filter((c) => c.status === options.status);
      }
      const dateField = options.dateField || "created_at";
      const sinceMs = options.since ? new Date(options.since).getTime() : null;
      const untilMs = options.until ? new Date(options.until).getTime() : null;
      if (sinceMs !== null || untilMs !== null) {
        filtered = filtered.filter((c) => {
          const ts = new Date((c as unknown as Record<string, string>)[dateField] || c.created_at).getTime();
          if (sinceMs !== null && ts < sinceMs) return false;
          if (untilMs !== null && ts >= untilMs) return false;
          return true;
        });
      }
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (options.offset) filtered = filtered.slice(options.offset);
      if (options.limit) filtered = filtered.slice(0, options.limit);
      return filtered;
    },

    async count(options: {
      status?: string;
      statuses?: string[];
      since?: string;
      until?: string;
      dateField?: "created_at" | "issued_at";
      q?: string;
    } = {}): Promise<number> {
      const results = Array.from(db.certificates.values());
      const dateField = options.dateField || "created_at";
      const sinceMs = options.since ? new Date(options.since).getTime() : null;
      const untilMs = options.until ? new Date(options.until).getTime() : null;
      const q = options.q?.trim().toLowerCase();
      return results.filter((c) => {
        if (q) {
          const matches = (value: string | null | undefined): boolean =>
            !!value && value.toLowerCase().includes(q);
          if (
            !matches(c.recipient_name) &&
            !matches(c.certificate_number) &&
            !matches(c.student_id)
          ) {
            return false;
          }
        }
        if (options.status && c.status !== options.status) return false;
        if (options.statuses && options.statuses.length > 0 && !options.statuses.includes(c.status)) return false;
        const ts = new Date((c as unknown as Record<string, string>)[dateField] || c.created_at).getTime();
        if (sinceMs !== null && ts < sinceMs) return false;
        if (untilMs !== null && ts >= untilMs) return false;
        return true;
      }).length;
    },
  },

  certificateModules: {
    async bulkCreate(modules: Omit<CertificateModuleRecord, "id">[]): Promise<CertificateModuleRecord[]> {
      const created: CertificateModuleRecord[] = [];
      for (const m of modules) {
        const record: CertificateModuleRecord = {
          ...m,
          id: generateId(),
        };
        created.push(record);
        const existing = db.certificate_modules.get(record.certificate_id) || [];
        existing.push(record);
        db.certificate_modules.set(record.certificate_id, existing);
      }
      return created;
    },

    async findByCertificateId(certificateId: string): Promise<CertificateModuleRecord[]> {
      const modules = db.certificate_modules.get(certificateId) || [];
      return [...modules].sort((a, b) => a.sort_order - b.sort_order);
    },
  },

  certificateEvents: {
    async create(
      event: Partial<CertificateEvent> & { certificate_id: string; event_type: string } & { id: string }
    ): Promise<CertificateEvent> {
      const record: CertificateEvent = {
        ...(event as CertificateEvent),
        id: event.id || generateId(),
        created_at: (event as CertificateEvent).created_at || new Date().toISOString(),
      };
      const existing = db.certificate_events.get(record.certificate_id) || [];
      existing.push(record);
      db.certificate_events.set(record.certificate_id, existing);
      return record;
    },

    async findByCertificateId(certificateId: string): Promise<CertificateEvent[]> {
      const events = db.certificate_events.get(certificateId) || [];
      return [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    async appendWithHead(
      event: CertificateEvent
    ): Promise<{ ok: boolean; previousEventHash: string | null; version: number }> {
      const existing = db.certificate_events.get(event.certificate_id) || [];
      const latest = [...existing].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const actualPrevious = latest?.event_hash ?? null;
      if ((actualPrevious || "") !== (event.previous_event_hash || "")) {
        return { ok: false, previousEventHash: actualPrevious, version: existing.length };
      }
      await inMemoryDb.certificateEvents.create(event);
      return { ok: true, previousEventHash: actualPrevious, version: existing.length + 1 };
    },

    async list(options: { limit?: number; since?: string } = {}): Promise<CertificateEvent[]> {
      const sinceMs = options.since ? new Date(options.since).getTime() : null;
      const events = Array.from(db.certificate_events.values())
        .flat()
        .filter((e) => (sinceMs === null ? true : new Date(e.created_at).getTime() >= sinceMs))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return options.limit ? events.slice(0, options.limit) : events;
    },
  },

  auditOutbox: {
    async enqueue(data: {
      id: string;
      certificate_id: string;
      event_type: string;
      payload: Record<string, unknown>;
    }): Promise<void> {
      if (db.event_outbox.has(data.id)) return;
      db.event_outbox.set(data.id, {
        ...data,
        created_at: new Date().toISOString(),
        processed_at: null,
        attempt_count: 0,
        last_error: null,
      });
    },

    async listPending(limit = 50): Promise<OutboxRow[]> {
      return Array.from(db.event_outbox.values())
        .filter((row) => !row.processed_at)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, limit);
    },

    async markProcessed(id: string): Promise<void> {
      const row = db.event_outbox.get(id);
      if (row) row.processed_at = new Date().toISOString();
    },

    async markFailed(id: string, error: string): Promise<void> {
      const row = db.event_outbox.get(id);
      if (!row) return;
      row.attempt_count += 1;
      row.last_error = error.slice(0, 1000);
    },
  },

  courses: {
    async create(data: Omit<CourseRecord, "id">): Promise<CourseRecord> {
      const record: CourseRecord = {
        ...data,
        id: generateId(),
      };
      db.courses.set(record.id, record);
      return record;
    },

    async findById(id: string): Promise<CourseRecord | null> {
      return db.courses.get(id) || null;
    },

    async list(activeOnly = true): Promise<CourseRecord[]> {
      const courses = Array.from(db.courses.values());
      return activeOnly ? courses.filter((c) => c.active) : courses;
    },

    async update(id: string, data: Partial<CourseRecord>): Promise<CourseRecord | null> {
      const existing = db.courses.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      db.courses.set(id, updated);
      return updated;
    },
  },

  courseModules: {
    async findByCourseId(courseId: string, activeOnly = true): Promise<CourseModuleRecord[]> {
      const modules = db.course_modules.get(courseId) || [];
      let filtered = [...modules].sort((a, b) => a.sort_order - b.sort_order);
      if (activeOnly) filtered = filtered.filter((m) => m.active);
      return filtered;
    },

    async create(data: Omit<CourseModuleRecord, "id">): Promise<CourseModuleRecord> {
      const record: CourseModuleRecord = {
        ...data,
        id: generateId(),
      };
      const existing = db.course_modules.get(record.course_id) || [];
      existing.push(record);
      db.course_modules.set(record.course_id, existing);
      return record;
    },

    async update(id: string, data: Partial<CourseModuleRecord>): Promise<CourseModuleRecord | null> {
      for (const [courseId, modules] of db.course_modules.entries()) {
        const idx = modules.findIndex((m) => m.id === id);
        if (idx !== -1) {
          const updated = { ...modules[idx], ...data };
          modules[idx] = updated;
          db.course_modules.set(courseId, modules);
          return updated;
        }
      }
      return null;
    },

    async deleteByCourseId(courseId: string): Promise<void> {
      db.course_modules.delete(courseId);
    },
  },

  signatories: {
    async create(data: Omit<SignatoryRecord, "id">): Promise<SignatoryRecord> {
      const record: SignatoryRecord = {
        ...data,
        id: generateId(),
      };
      db.signatories.set(record.id, record);
      return record;
    },

    async findById(id: string): Promise<SignatoryRecord | null> {
      return db.signatories.get(id) || null;
    },

    async list(activeOnly = true): Promise<SignatoryRecord[]> {
      const signatories = Array.from(db.signatories.values());
      return activeOnly ? signatories.filter((s) => s.active) : signatories;
    },

    async update(id: string, data: Partial<SignatoryRecord>): Promise<SignatoryRecord | null> {
      const existing = db.signatories.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      db.signatories.set(id, updated);
      return updated;
    },
  },

  reissueOperations: {
    async findByIdempotencyKey(key: string): Promise<ReissueOperation | null> {
      for (const op of db.reissue_operations.values()) {
        if (op.idempotency_key === key) return op;
      }
      return null;
    },

    async create(
      data: Omit<ReissueOperation, "id" | "created_at">
    ): Promise<ReissueOperation> {
      const record: ReissueOperation = {
        ...data,
        id: generateId(),
        created_at: new Date().toISOString(),
      };
      db.reissue_operations.set(record.id, record);
      return record;
    },

    async update(id: string, data: Partial<ReissueOperation>): Promise<ReissueOperation | null> {
      const existing = db.reissue_operations.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      db.reissue_operations.set(id, updated);
      return updated;
    },
  },

  numbering: {
    async nextNumber(prefix: string, year: number): Promise<number> {
      const key = `${prefix}-${year}`;
      const current = db.numberSequence.get(key) || 0;
      const next = current + 1;
      db.numberSequence.set(key, next);
      return next;
    },
  },

  adminUsers: {
    async findByUsername(username: string): Promise<AdminUserRecord | null> {
      for (const user of db.admin_users.values()) {
        if (user.username.toLowerCase() === username.trim().toLowerCase()) return user;
      }
      return null;
    },
    async findById(id: string): Promise<AdminUserRecord | null> {
      return db.admin_users.get(id) || null;
    },
    async list(): Promise<AdminUserRecord[]> {
      return Array.from(db.admin_users.values());
    },
    async create(data: AdminUserRecord): Promise<AdminUserRecord> {
      db.admin_users.set(data.id, data);
      return data;
    },
    async update(id: string, data: Partial<AdminUserRecord>): Promise<AdminUserRecord | null> {
      const existing = db.admin_users.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      db.admin_users.set(id, updated);
      return updated;
    },
  },

  adminSessions: {
    async create(data: AdminSessionRecord): Promise<AdminSessionRecord> {
      db.admin_sessions.set(data.id, data);
      return data;
    },
    async findByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null> {
      for (const session of db.admin_sessions.values()) {
        if (session.token_hash === tokenHash) return session;
      }
      return null;
    },
    async touch(id: string): Promise<void> {
      const existing = db.admin_sessions.get(id);
      if (existing) {
        db.admin_sessions.set(id, { ...existing, last_seen_at: new Date().toISOString() });
      }
    },
    async revoke(tokenHash: string): Promise<void> {
      for (const [id, session] of db.admin_sessions) {
        if (session.token_hash === tokenHash && !session.revoked_at) {
          db.admin_sessions.set(id, { ...session, revoked_at: new Date().toISOString() });
        }
      }
    },
    async revokeAllForUser(adminUserId: string): Promise<number> {
      let count = 0;
      for (const [id, session] of db.admin_sessions) {
        if (session.admin_user_id === adminUserId && !session.revoked_at) {
          db.admin_sessions.set(id, { ...session, revoked_at: new Date().toISOString() });
          count++;
        }
      }
      return count;
    },
    async listActiveForUser(adminUserId: string): Promise<AdminSessionRecord[]> {
      const now = Date.now();
      return Array.from(db.admin_sessions.values()).filter(
        (s) =>
          s.admin_user_id === adminUserId &&
          !s.revoked_at &&
          new Date(s.expires_at).getTime() > now
      );
    },
  },

  adminLoginEvents: {
    async record(data: AdminLoginEventRecord): Promise<AdminLoginEventRecord> {
      db.admin_login_events.set(data.id, data);
      return data;
    },
    async listRecent(limit = 50): Promise<AdminLoginEventRecord[]> {
      return Array.from(db.admin_login_events.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    },
  },
};

export const seedDefaultData = async () => {
  const existingSignatories = await inMemoryDb.signatories.list(false);
  if (existingSignatories.length === 0) {
    await inMemoryDb.signatories.create({
      name: "Mohan Shahi",
      position: "Director, DarbarTech Group of Technology",
      active: true,
      is_default_secondary: true,
    });
    await inMemoryDb.signatories.create({
      name: "Admin",
      position: "Administrator",
      active: true,
    });
  }

  const existingCourses = await inMemoryDb.courses.list(false);
  if (existingCourses.length === 0) {
    const catalog = await loadCanonicalCourseCatalog();
    for (const courseSeed of catalog) {
      const { modules, ...courseFields } = courseSeed;
      const course = await inMemoryDb.courses.create(courseFields);
      for (const mod of modules) {
        await inMemoryDb.courseModules.create({
          course_id: course.id,
          sort_order: mod.sort_order,
          title: mod.title,
          subtitle: mod.subtitle || null,
          active: mod.active,
        });
      }
    }
  }
};
