import { supabaseAdmin } from "./supabase";
import { inMemoryDb, seedDefaultData } from "./inMemoryDb";
import { loadCanonicalCourseCatalog } from "./courseCatalogSeed";
import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateEvent,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
} from "@/lib/types";

export const USE_SUPABASE = !!supabaseAdmin;

let SUPABASE_UNHEALTHY = false;
const REPORTED_ERRORS = new Set<string>();
let _seedDone = false;
let _seedPromise: Promise<void> | null = null;

const formatSupabaseError = (err: unknown): string => {
  if (err == null) return "unknown null/undefined error";
  if (err instanceof Error) return err.message;
  try {
    const s = JSON.stringify(err, null, 0);
    if (s && s !== "{}") return s;
  } catch {
    /* noop */
  }
  return String(err);
};

const tripCircuit = (operation: string, err: unknown) => {
  const key = operation;
  if (!REPORTED_ERRORS.has(key)) {
    REPORTED_ERRORS.add(key);
    console.warn(
      `[db:${operation}] Supabase unavailable (${formatSupabaseError(err)}). ` +
        "Falling ALL subsequent DB operations for this server session to in-memory storage."
    );
  }
  SUPABASE_UNHEALTHY = true;
  void seedDefaultData().catch(() => undefined);
};

const usingSupabase = (operation: string, err?: unknown): boolean => {
  if (!USE_SUPABASE) return false;
  if (SUPABASE_UNHEALTHY) return false;
  if (err) tripCircuit(operation, err);
  return true;
};

const courseToSupabase = (data: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...data };
  const camelFields = [
    ["certificateTitle", "certificate_title"],
    ["certificateTemplateId", "certificate_template_id"],
    ["certificateTemplateVersion", "certificate_template_version"],
    ["providerName", "provider_name"],
    ["completionStatement", "completion_statement"],
  ] as const;
  for (const [camel, snake] of camelFields) {
    if (out[camel] !== undefined) {
      out[snake] = out[camel];
      delete out[camel];
    }
  }
  return out;
};

const courseFromSupabase = (data: Record<string, unknown> | null): CourseRecord | null => {
  if (!data) return null;
  const snakeToCamel: Array<[keyof CourseRecord, string]> = [
    ["certificateTitle", "certificate_title"],
    ["certificateTemplateId", "certificate_template_id"],
    ["certificateTemplateVersion", "certificate_template_version"],
    ["providerName", "provider_name"],
    ["completionStatement", "completion_statement"],
  ];
  const result: Record<string, unknown> = { ...data };
  for (const [camelKey, snakeKey] of snakeToCamel) {
    if (result[camelKey as string] === undefined || result[camelKey as string] === null) {
      result[camelKey as string] = (data as Record<string, unknown>)[snakeKey];
    }
  }
  return result as CourseRecord;
};

async function ensureCanonicalCourses() {
  const allCourses = await db.courses.list(false);
  if (allCourses.length > 0) return;

  const allSignatories = await db.signatories.list(false);
  if (allSignatories.length === 0) {
    await db.signatories.create({
      name: "Rajesh Darbar",
      position: "Director, DarbarTech Group of Technology",
      active: true,
    });
    await db.signatories.create({
      name: "Admin",
      position: "Administrator",
      active: true,
    });
  }

  const catalog = await loadCanonicalCourseCatalog();
  for (const courseSeed of catalog) {
    const { modules, ...courseFields } = courseSeed;
    const course = await db.courses.create(courseFields);
    for (const mod of modules) {
      await db.courseModules.create({
        course_id: course.id,
        sort_order: mod.sort_order,
        title: mod.title,
        subtitle: mod.subtitle || null,
        active: mod.active,
      });
    }
  }
}

export const seedDatabase = async () => {
  if (_seedPromise) {
    await _seedPromise;
    return;
  }
  if (_seedDone) return;
  _seedPromise = (async () => {
    try {
      await seedDefaultData();
      if (USE_SUPABASE && !SUPABASE_UNHEALTHY) {
        try {
          await ensureCanonicalCourses();
        } catch (err) {
          console.warn(
            "[seedDatabase] Cannot seed Supabase course catalog (will use in-memory fallback):",
            formatSupabaseError(err)
          );
          tripCircuit("seedDatabase", err);
        }
      }
      _seedDone = true;
    } finally {
      _seedPromise = null;
    }
  })();
  await _seedPromise;
};

export const db = {
  certificates: {
    create: async (
      data: Omit<CertificateRecord, "id" | "created_at" | "updated_at">
    ): Promise<CertificateRecord> => {
      if (usingSupabase("certificates.create")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("certificates")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          return result as CertificateRecord;
        } catch (err) {
          usingSupabase("certificates.create", err);
        }
      }
      return inMemoryDb.certificates.create(data);
    },

    update: async (id: string, data: Partial<CertificateRecord>): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates.update")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("certificates")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          if (error) return null;
          return result as CertificateRecord;
        } catch (err) {
          usingSupabase("certificates.update", err);
        }
      }
      return inMemoryDb.certificates.update(id, data);
    },

    findById: async (id: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates.findById")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("id", id)
            .single();
          if (error) return null;
          return data as CertificateRecord;
        } catch (err) {
          usingSupabase("certificates.findById", err);
        }
      }
      return inMemoryDb.certificates.findById(id);
    },

    findByNumber: async (certificateNumber: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates.findByNumber")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("certificate_number", certificateNumber)
            .maybeSingle();
          if (error) return null;
          return data as CertificateRecord | null;
        } catch (err) {
          usingSupabase("certificates.findByNumber", err);
        }
      }
      return inMemoryDb.certificates.findByNumber(certificateNumber);
    },

    findByToken: async (verificationToken: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates.findByToken")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("verification_token", verificationToken)
            .maybeSingle();
          if (error) return null;
          return data as CertificateRecord | null;
        } catch (err) {
          usingSupabase("certificates.findByToken", err);
        }
      }
      return inMemoryDb.certificates.findByToken(verificationToken);
    },

    list: async (options: { limit?: number; offset?: number; status?: string } = {}): Promise<CertificateRecord[]> => {
      if (usingSupabase("certificates.list")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*");
          if (options.status) query = query.eq("status", options.status);
          query = query.order("created_at", { ascending: false });
          if (options.offset) query = query.range(options.offset, (options.offset || 0) + (options.limit || 50) - 1);
          else if (options.limit) query = query.limit(options.limit);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []) as CertificateRecord[];
        } catch (err) {
          usingSupabase("certificates.list", err);
        }
      }
      return inMemoryDb.certificates.list(options);
    },

    count: async (options: { status?: string } = {}): Promise<number> => {
      if (usingSupabase("certificates.count")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*", { count: "exact", head: true });
          if (options.status) query = query.eq("status", options.status);
          const { count, error } = await query;
          if (error) return 0;
          return count || 0;
        } catch (err) {
          usingSupabase("certificates.count", err);
        }
      }
      return inMemoryDb.certificates.count(options);
    },
  },

  certificateModules: {
    bulkCreate: async (
      modules: Omit<CertificateModuleRecord, "id">[]
    ): Promise<CertificateModuleRecord[]> => {
      if (usingSupabase("certificateModules.bulkCreate")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_modules")
            .insert(modules)
            .select();
          if (error) throw error;
          return (data || []) as CertificateModuleRecord[];
        } catch (err) {
          usingSupabase("certificateModules.bulkCreate", err);
        }
      }
      return inMemoryDb.certificateModules.bulkCreate(modules);
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateModuleRecord[]> => {
      if (usingSupabase("certificateModules.findByCertificateId")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_modules")
            .select("*")
            .eq("certificate_id", certificateId)
            .order("sort_order", { ascending: true });
          if (error) return [];
          return (data || []) as CertificateModuleRecord[];
        } catch (err) {
          usingSupabase("certificateModules.findByCertificateId", err);
        }
      }
      return inMemoryDb.certificateModules.findByCertificateId(certificateId);
    },
  },

  certificateEvents: {
    create: async (
      event: Omit<CertificateEvent, "id" | "created_at">
    ): Promise<CertificateEvent> => {
      if (usingSupabase("certificateEvents.create")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_events")
            .insert(event)
            .select()
            .single();
          if (error) throw error;
          return data as CertificateEvent;
        } catch (err) {
          usingSupabase("certificateEvents.create", err);
        }
      }
      return inMemoryDb.certificateEvents.create(event);
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateEvent[]> => {
      if (usingSupabase("certificateEvents.findByCertificateId")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_events")
            .select("*")
            .eq("certificate_id", certificateId)
            .order("created_at", { ascending: false });
          if (error) return [];
          return (data || []) as CertificateEvent[];
        } catch (err) {
          usingSupabase("certificateEvents.findByCertificateId", err);
        }
      }
      return inMemoryDb.certificateEvents.findByCertificateId(certificateId);
    },
  },

  courses: {
    create: async (data: Omit<CourseRecord, "id">): Promise<CourseRecord> => {
      if (usingSupabase("courses.create")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("courses")
            .insert(courseToSupabase(data as unknown as Record<string, unknown>))
            .select()
            .single();
          if (error) throw error;
          return courseFromSupabase(result as unknown as Record<string, unknown>)!;
        } catch (err) {
          usingSupabase("courses.create", err);
        }
      }
      return inMemoryDb.courses.create(data);
    },

    findById: async (id: string): Promise<CourseRecord | null> => {
      if (usingSupabase("courses.findById")) {
        try {
          const { data, error } = await supabaseAdmin!.from("courses")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (!error && data) {
            return courseFromSupabase(data as unknown as Record<string, unknown>);
          }
        } catch (err) {
          usingSupabase("courses.findById", err);
        }
      }
      return inMemoryDb.courses.findById(id);
    },

    list: async (activeOnly = true): Promise<CourseRecord[]> => {
      if (usingSupabase("courses.list")) {
        try {
          let query = supabaseAdmin!.from("courses").select("*");
          if (activeOnly) query = query.eq("active", true);
          const { data, error } = await query;
          if (error) throw error;
          // NOTE: an empty array is a legitimate result (e.g. no active
          // courses yet) and must NOT fall through to the in-memory
          // fallback below — that store uses unrelated seeded UUIDs and
          // silently returning it here caused real courses selected in
          // the admin UI to resolve to the wrong (or empty) catalog data.
          return (data || []).map(
            (row: unknown) => courseFromSupabase(row as Record<string, unknown>)!
          );
        } catch (err) {
          usingSupabase("courses.list", err);
        }
      }
      return inMemoryDb.courses.list(activeOnly);
    },

    update: async (id: string, data: Partial<CourseRecord>): Promise<CourseRecord | null> => {
      if (usingSupabase("courses.update")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("courses")
            .update(courseToSupabase(data as unknown as Record<string, unknown>))
            .eq("id", id)
            .select()
            .single();
          if (error) return null;
          return courseFromSupabase(result as unknown as Record<string, unknown>);
        } catch (err) {
          usingSupabase("courses.update", err);
        }
      }
      return inMemoryDb.courses.update(id, data);
    },
  },

  courseModules: {
    findByCourseId: async (
      courseId: string,
      activeOnly = true
    ): Promise<CourseModuleRecord[]> => {
      if (usingSupabase("courseModules.findByCourseId")) {
        try {
          let query = supabaseAdmin!.from("course_modules")
            .select("*")
            .eq("course_id", courseId)
            .order("sort_order", { ascending: true });
          if (activeOnly) query = query.eq("active", true);
          const { data, error } = await query;
          if (error) throw error;
          // Same fix as courses.list: a course with zero active modules
          // right now is a valid state, not a signal to fall back to the
          // disconnected in-memory catalog (which was wiping out real
          // modules/descriptions in the certificate creation form).
          return (data || []) as CourseModuleRecord[];
        } catch (err) {
          usingSupabase("courseModules.findByCourseId", err);
        }
      }
      return inMemoryDb.courseModules.findByCourseId(courseId, activeOnly);
    },

    create: async (data: Omit<CourseModuleRecord, "id">): Promise<CourseModuleRecord> => {
      if (usingSupabase("courseModules.create")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("course_modules")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          return result as CourseModuleRecord;
        } catch (err) {
          usingSupabase("courseModules.create", err);
        }
      }
      return inMemoryDb.courseModules.create(data);
    },
  },

  signatories: {
    create: async (data: Omit<SignatoryRecord, "id">): Promise<SignatoryRecord> => {
      if (usingSupabase("signatories.create")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("signatories")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          return result as SignatoryRecord;
        } catch (err) {
          usingSupabase("signatories.create", err);
        }
      }
      return inMemoryDb.signatories.create(data);
    },

    findById: async (id: string): Promise<SignatoryRecord | null> => {
      if (usingSupabase("signatories.findById")) {
        try {
          const { data, error } = await supabaseAdmin!.from("signatories")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (!error && data) return data as SignatoryRecord;
        } catch (err) {
          usingSupabase("signatories.findById", err);
        }
      }
      return inMemoryDb.signatories.findById(id);
    },

    list: async (activeOnly = true): Promise<SignatoryRecord[]> => {
      if (usingSupabase("signatories.list")) {
        try {
          let query = supabaseAdmin!.from("signatories").select("*");
          if (activeOnly) query = query.eq("active", true);
          const { data, error } = await query;
          if (error) throw error;
          // Same fix as courses.list — an empty (but successful) result
          // is valid and must not fall back to the in-memory seed data,
          // which was making the signatory picker show/select the wrong
          // records.
          return (data || []) as SignatoryRecord[];
        } catch (err) {
          usingSupabase("signatories.list", err);
        }
      }
      return inMemoryDb.signatories.list(activeOnly);
    },

    update: async (id: string, data: Partial<SignatoryRecord>): Promise<SignatoryRecord | null> => {
      if (usingSupabase("signatories.update")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("signatories")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          if (error) return null;
          return result as SignatoryRecord;
        } catch (err) {
          usingSupabase("signatories.update", err);
        }
      }
      return inMemoryDb.signatories.update(id, data);
    },
  },

  numbering: {
    nextNumber: async (prefix: string, year: number): Promise<number> => {
      if (usingSupabase("numbering.nextNumber")) {
        try {
          const key = `${prefix}-${year}`;
          const { data, error } = await supabaseAdmin!.rpc("next_certificate_number", {
            p_prefix: prefix,
            p_year: year,
          });
          if (error) {
            const { count } = await supabaseAdmin!.from("certificates")
              .select("certificate_number", { count: "exact", head: true })
              .like("certificate_number", `${key}-%`);
            return (count || 0) + 1;
          }
          return (data as number) || 1;
        } catch (err) {
          usingSupabase("numbering.nextNumber", err);
        }
      }
      return inMemoryDb.numbering.nextNumber(prefix, year);
    },
  },
};
