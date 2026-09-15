import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateEvent,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
} from "@/lib/types";
import { loadCanonicalCourseCatalog } from "./courseCatalogSeed";

const db = {
  certificates: new Map<string, CertificateRecord>(),
  certificate_modules: new Map<string, CertificateModuleRecord[]>(),
  certificate_events: new Map<string, CertificateEvent[]>(),
  courses: new Map<string, CourseRecord>(),
  course_modules: new Map<string, CourseModuleRecord[]>(),
  signatories: new Map<string, SignatoryRecord>(),
  numberSequence: new Map<string, number>(),
};

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
      for (const cert of db.certificates.values()) {
        if (cert.verification_token === verificationToken) return cert;
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
    async create(event: Omit<CertificateEvent, "id" | "created_at">): Promise<CertificateEvent> {
      const record: CertificateEvent = {
        ...event,
        id: generateId(),
        created_at: new Date().toISOString(),
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

    async list(options: { limit?: number; since?: string } = {}): Promise<CertificateEvent[]> {
      const sinceMs = options.since ? new Date(options.since).getTime() : null;
      const events = Array.from(db.certificate_events.values())
        .flat()
        .filter((e) => (sinceMs === null ? true : new Date(e.created_at).getTime() >= sinceMs))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return options.limit ? events.slice(0, options.limit) : events;
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

  numbering: {
    async nextNumber(prefix: string, year: number): Promise<number> {
      const key = `${prefix}-${year}`;
      const current = db.numberSequence.get(key) || 0;
      const next = current + 1;
      db.numberSequence.set(key, next);
      return next;
    },
  },
};

export const seedDefaultData = async () => {
  const existingSignatories = await inMemoryDb.signatories.list(false);
  if (existingSignatories.length === 0) {
    await inMemoryDb.signatories.create({
      name: "Rajesh Darbar",
      position: "Director, DarbarTech Group of Technology",
      active: true,
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
