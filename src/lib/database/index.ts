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

// ---------------------------------------------------------------------------
// Scoped, self-healing circuit breaker
// ---------------------------------------------------------------------------
// Previous behaviour: the FIRST Supabase failure anywhere set a single global
// `SUPABASE_UNHEALTHY` flag that degraded EVERY table for the REST of the
// server process, silently, with no recovery and no indicator. That turned one
// transient error (cold start, network blip) into permanent in-memory-only data
// loss for the whole app.
//
// Now: circuits are keyed by operation-family (table name). A failure only
// affects that table; after `TRIP_THRESHOLD` consecutive failures the circuit
// opens for `COOLDOWN_MS`, then goes half-open (the next call is attempted
// again). Any success resets the failure count. State is surfaced to the admin
// UI via `getDatabaseHealth()` (see /api/admin/health + AdminLayout banner) so
// degraded mode is visible and actionable instead of silent.

type CircuitState = { failedAt: number; failureCount: number };

const COOLDOWN_MS = 30_000;
const TRIP_THRESHOLD = 3;
const circuits = new Map<string, CircuitState>();

const isOpen = (table: string): boolean => {
  const c = circuits.get(table);
  if (!c) return false;
  if (c.failureCount < TRIP_THRESHOLD) return false;
  return Date.now() - c.failedAt < COOLDOWN_MS;
};

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

const recordFailure = (table: string, err: unknown): void => {
  const prev = circuits.get(table) || { failedAt: 0, failureCount: 0 };
  const failureCount = prev.failureCount + 1;
  circuits.set(table, { failedAt: Date.now(), failureCount });
  console.warn(
    `[db:${table}] Supabase call failed (${formatSupabaseError(err)}). ` +
      (failureCount >= TRIP_THRESHOLD
        ? `Circuit OPEN for "${table}" — falling back to in-memory for ~${COOLDOWN_MS}ms.`
        : `Failure ${failureCount}/${TRIP_THRESHOLD} for "${table}" (opening after the next ${TRIP_THRESHOLD - failureCount}).`)
  );
};

const recordSuccess = (table: string): void => {
  circuits.delete(table);
};

/**
 * Decides whether a Supabase-backed operation should be attempted.
 * - Returns `false` when Supabase is disabled or the table's circuit is open.
 * - When called with an `err`, records the failure; returns `false` when this
 *   failure pushed the circuit open (caller should surface the error instead
 *   of silently writing to in-memory), `true` when in-memory fallback is still
 *   allowed for this operation family.
 */
const usingSupabase = (table: string, err?: unknown): boolean => {
  if (!USE_SUPABASE) return false;
  if (isOpen(table)) return false;
  if (err) {
    recordFailure(table, err);
    return !isOpen(table);
  }
  return true;
};

export type CircuitHealthEntry = {
  table: string;
  open: boolean;
  failureCount: number;
  retryAfterMs: number | null;
};

export const getDatabaseHealth = (): {
  useSupabase: boolean;
  degraded: boolean;
  circuits: CircuitHealthEntry[];
  catalogMode?: "memory" | "supabase";
} => {
  const info = Array.from(circuits.entries()).map(([table, c]) => {
    const open = isOpen(table);
    return {
      table,
      open,
      failureCount: c.failureCount,
      retryAfterMs: open ? Math.max(0, COOLDOWN_MS - (Date.now() - c.failedAt)) : null,
    };
  });
  const degraded =
    info.some((c) => c.open || c.failureCount > 0) || courseCatalogMemoryMode === true;
  return {
    useSupabase: USE_SUPABASE,
    degraded,
    circuits: info,
    catalogMode: courseCatalogMemoryMode === true ? "memory" : "supabase",
  };
};

/**
 * Decides where the canonical course catalog actually lives:
 * - `true`  → in-memory (Supabase not configured, or the `courses` table is
 *   missing the schema-migrated columns; checked by probing for
 *   `certificate_template_id`)
 * - `false` → Supabase
 *
 * The READ paths (courses.list, courseModules.findByCourseId, ...) MUST follow
 * the same decision as SEEDING. If seeding was forced to in-memory because a
 * column is missing, a later `select("*")` against the real (but broken)
 * table returns an EMPTY, "successful" result — which used to be taken as a
 * genuine empty catalog, silently hiding every course in the admin UI.
 * Result is cached for the process; fixing the schema requires a restart.
 */
let courseCatalogMemoryMode: boolean | null = null;

const courseCatalogInMemory = async (): Promise<boolean> => {
  if (courseCatalogMemoryMode !== null) return courseCatalogMemoryMode;
  let memory = !USE_SUPABASE;
  if (USE_SUPABASE) {
    try {
      const { error } = await supabaseAdmin!.from("courses").select("certificate_template_id").limit(1);
      memory = !!error;
    } catch {
      memory = true;
    }
  }
  courseCatalogMemoryMode = memory;
  if (memory) {
    console.warn(
      "[db:courses] Supabase `courses` table is missing required column(s) (certificate_template_id). " +
        "The course catalog will run from in-memory until the schema is migrated."
    );
  }
  return memory;
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
  // See courseCatalogInMemory(): the catalog must land in the SAME store the
  // read paths will use, or writes and reads diverge (e.g. in-memory courses
  // whose MODULES then try to hit the real `course_modules` table, or an
  // "empty" Supabase table masking a mis-configured schema).
  if (await courseCatalogInMemory()) {
    // In-memory catalog is already seeded by seedDefaultData(); nothing to do.
    return;
  }

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
      if (USE_SUPABASE) {
        try {
          await ensureCanonicalCourses();
        } catch (err) {
          console.warn(
            "[seedDatabase] Cannot seed Supabase course catalog (will use in-memory fallback):",
            formatSupabaseError(err)
          );
          recordFailure("seed", err);
        }
      }
      _seedDone = true;
    } finally {
      _seedPromise = null;
    }
  })();
  await _seedPromise;
};

let _seedDone = false;
let _seedPromise: Promise<void> | null = null;

export const db = {
  certificates: {
    create: async (
      data: Omit<CertificateRecord, "id" | "created_at" | "updated_at">
    ): Promise<CertificateRecord> => {
      if (usingSupabase("certificates")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("certificates")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("certificates");
          return result as CertificateRecord;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.create(data);
    },

    update: async (id: string, data: Partial<CertificateRecord>): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("certificates")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          // PGRST116 = zero rows matched, i.e. genuinely not found. That is
          // the ONLY case that maps to null. Any other error is a real failure
          // and must throw so the circuit breaker engages and callers do not
          // silently treat "connection reset" as "certificate doesn't exist".
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("certificates");
          return result as CertificateRecord;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.update(id, data);
    },

    findById: async (id: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("id", id)
            .single();
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("certificates");
          return data as CertificateRecord;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.findById(id);
    },

    findByNumber: async (certificateNumber: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("certificate_number", certificateNumber)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("certificates");
          return data as CertificateRecord | null;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.findByNumber(certificateNumber);
    },

    findByToken: async (verificationToken: string): Promise<CertificateRecord | null> => {
      if (usingSupabase("certificates")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("verification_token", verificationToken)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("certificates");
          return data as CertificateRecord | null;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.findByToken(verificationToken);
    },

    list: async (options: {
      limit?: number;
      offset?: number;
      status?: string;
      q?: string;
      since?: string;
      until?: string;
      dateField?: "created_at" | "issued_at";
    } = {}): Promise<CertificateRecord[]> => {
      if (usingSupabase("certificates")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*");
          if (options.status) query = query.eq("status", options.status);
          if (options.q) {
            query = query.or(
              `recipient_name.ilike.%${options.q}%,certificate_number.ilike.%${options.q}%,student_id.ilike.%${options.q}%`
            );
          }
          const dateField = options.dateField || "created_at";
          if (options.since) query = query.gte(dateField, options.since);
          if (options.until) query = query.lt(dateField, options.until);
          query = query.order("created_at", { ascending: false });
          const limit = options.limit || 50;
          if (options.offset) query = query.range(options.offset, options.offset + limit - 1);
          else if (options.limit) query = query.limit(limit);
          const { data, error } = await query;
          if (error) throw error;
          recordSuccess("certificates");
          return (data || []) as CertificateRecord[];
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.list(options);
    },

    count: async (options: {
      status?: string;
      statuses?: string[];
      since?: string;
      until?: string;
      dateField?: "created_at" | "issued_at";
      q?: string;
    } = {}): Promise<number> => {
      if (usingSupabase("certificates")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*", { count: "exact", head: true });
          if (options.status) query = query.eq("status", options.status);
          if (options.statuses && options.statuses.length > 0) {
            query = query.in("status", options.statuses);
          }
          if (options.q) {
            query = query.or(
              `recipient_name.ilike.%${options.q}%,certificate_number.ilike.%${options.q}%,student_id.ilike.%${options.q}%`
            );
          }
          const dateField = options.dateField || "created_at";
          if (options.since) query = query.gte(dateField, options.since);
          if (options.until) query = query.lt(dateField, options.until);
          const { count, error } = await query;
          if (error) throw error;
          recordSuccess("certificates");
          return count || 0;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return inMemoryDb.certificates.count(options);
    },
  },

  certificateModules: {
    bulkCreate: async (
      modules: Omit<CertificateModuleRecord, "id">[]
    ): Promise<CertificateModuleRecord[]> => {
      if (usingSupabase("certificateModules")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_modules")
            .insert(modules)
            .select();
          if (error) throw error;
          recordSuccess("certificateModules");
          return (data || []) as CertificateModuleRecord[];
        } catch (err) {
          if (!usingSupabase("certificateModules", err)) throw err;
        }
      }
      return inMemoryDb.certificateModules.bulkCreate(modules);
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateModuleRecord[]> => {
      if (usingSupabase("certificateModules")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_modules")
            .select("*")
            .eq("certificate_id", certificateId)
            .order("sort_order", { ascending: true });
          if (error) throw error;
          recordSuccess("certificateModules");
          return (data || []) as CertificateModuleRecord[];
        } catch (err) {
          if (!usingSupabase("certificateModules", err)) throw err;
        }
      }
      return inMemoryDb.certificateModules.findByCertificateId(certificateId);
    },
  },

  certificateEvents: {
    create: async (
      event: Omit<CertificateEvent, "id" | "created_at">
    ): Promise<CertificateEvent> => {
      if (usingSupabase("certificateEvents")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_events")
            .insert(event)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("certificateEvents");
          return data as CertificateEvent;
        } catch (err) {
          if (!usingSupabase("certificateEvents", err)) throw err;
        }
      }
      return inMemoryDb.certificateEvents.create(event);
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateEvent[]> => {
      if (usingSupabase("certificateEvents")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_events")
            .select("*")
            .eq("certificate_id", certificateId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          recordSuccess("certificateEvents");
          return (data || []) as CertificateEvent[];
        } catch (err) {
          if (!usingSupabase("certificateEvents", err)) throw err;
        }
      }
      return inMemoryDb.certificateEvents.findByCertificateId(certificateId);
    },

    list: async (options: { limit?: number; since?: string } = {}): Promise<CertificateEvent[]> => {
      if (usingSupabase("certificateEvents")) {
        try {
          let query = supabaseAdmin!.from("certificate_events")
            .select("*")
            .order("created_at", { ascending: false });
          if (options.since) query = query.gte("created_at", options.since);
          if (options.limit) query = query.limit(options.limit);
          const { data, error } = await query;
          if (error) throw error;
          recordSuccess("certificateEvents");
          return (data || []) as CertificateEvent[];
        } catch (err) {
          if (!usingSupabase("certificateEvents", err)) throw err;
        }
      }
      return inMemoryDb.certificateEvents.list(options);
    },
  },

  courses: {
    create: async (data: Omit<CourseRecord, "id">): Promise<CourseRecord> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courses")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("courses")
            .insert(courseToSupabase(data as unknown as Record<string, unknown>))
            .select()
            .single();
          if (error) throw error;
          recordSuccess("courses");
          return courseFromSupabase(result as unknown as Record<string, unknown>)!;
        } catch (err) {
          if (!usingSupabase("courses", err)) throw err;
        }
      }
      return inMemoryDb.courses.create(data);
    },

    findById: async (id: string): Promise<CourseRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courses")) {
        try {
          const { data, error } = await supabaseAdmin!.from("courses")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (data) {
            recordSuccess("courses");
            return courseFromSupabase(data as unknown as Record<string, unknown>);
          }
        } catch (err) {
          if (!usingSupabase("courses", err)) throw err;
        }
      }
      return inMemoryDb.courses.findById(id);
    },

    list: async (activeOnly = true): Promise<CourseRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courses")) {
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
          recordSuccess("courses");
          return (data || []).map(
            (row: unknown) => courseFromSupabase(row as Record<string, unknown>)!
          );
        } catch (err) {
          if (!usingSupabase("courses", err)) throw err;
        }
      }
      return inMemoryDb.courses.list(activeOnly);
    },

    update: async (id: string, data: Partial<CourseRecord>): Promise<CourseRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courses")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("courses")
            .update(courseToSupabase(data as unknown as Record<string, unknown>))
            .eq("id", id)
            .select()
            .single();
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("courses");
          return courseFromSupabase(result as unknown as Record<string, unknown>);
        } catch (err) {
          if (!usingSupabase("courses", err)) throw err;
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
      if (!(await courseCatalogInMemory()) && usingSupabase("courseModules")) {
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
          recordSuccess("courseModules");
          return (data || []) as CourseModuleRecord[];
        } catch (err) {
          if (!usingSupabase("courseModules", err)) throw err;
        }
      }
      return inMemoryDb.courseModules.findByCourseId(courseId, activeOnly);
    },

    create: async (data: Omit<CourseModuleRecord, "id">): Promise<CourseModuleRecord> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courseModules")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("course_modules")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("courseModules");
          return result as CourseModuleRecord;
        } catch (err) {
          if (!usingSupabase("courseModules", err)) throw err;
        }
      }
      return inMemoryDb.courseModules.create(data);
    },

    update: async (id: string, data: Partial<CourseModuleRecord>): Promise<CourseModuleRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courseModules")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("course_modules")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("courseModules");
          return result as CourseModuleRecord;
        } catch (err) {
          if (!usingSupabase("courseModules", err)) throw err;
        }
      }
      return inMemoryDb.courseModules.update(id, data);
    },

    deleteByCourseId: async (courseId: string): Promise<void> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("courseModules")) {
        try {
          const { error } = await supabaseAdmin!.from("course_modules")
            .delete()
            .eq("course_id", courseId);
          if (error) throw error;
          recordSuccess("courseModules");
          return;
        } catch (err) {
          if (!usingSupabase("courseModules", err)) throw err;
        }
      }
      return inMemoryDb.courseModules.deleteByCourseId(courseId);
    },
  },

  signatories: {
    create: async (data: Omit<SignatoryRecord, "id">): Promise<SignatoryRecord> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("signatories")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("signatories")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("signatories");
          return result as SignatoryRecord;
        } catch (err) {
          if (!usingSupabase("signatories", err)) throw err;
        }
      }
      return inMemoryDb.signatories.create(data);
    },

    findById: async (id: string): Promise<SignatoryRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("signatories")) {
        try {
          const { data, error } = await supabaseAdmin!.from("signatories")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (data) {
            recordSuccess("signatories");
            return data as SignatoryRecord;
          }
        } catch (err) {
          if (!usingSupabase("signatories", err)) throw err;
        }
      }
      return inMemoryDb.signatories.findById(id);
    },

    list: async (activeOnly = true): Promise<SignatoryRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("signatories")) {
        try {
          let query = supabaseAdmin!.from("signatories").select("*");
          if (activeOnly) query = query.eq("active", true);
          const { data, error } = await query;
          if (error) throw error;
          // Same fix as courses.list — an empty (but successful) result
          // is valid and must not fall back to the in-memory seed data,
          // which was making the signatory picker show/select the wrong
          // records.
          recordSuccess("signatories");
          return (data || []) as SignatoryRecord[];
        } catch (err) {
          if (!usingSupabase("signatories", err)) throw err;
        }
      }
      return inMemoryDb.signatories.list(activeOnly);
    },

    update: async (id: string, data: Partial<SignatoryRecord>): Promise<SignatoryRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("signatories")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("signatories")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("signatories");
          return result as SignatoryRecord;
        } catch (err) {
          if (!usingSupabase("signatories", err)) throw err;
        }
      }
      return inMemoryDb.signatories.update(id, data);
    },
  },

  numbering: {
    nextNumber: async (prefix: string, year: number): Promise<number> => {
      if (usingSupabase("numbering")) {
        // Fail CLOSED, not open. Number uniqueness is a correctness property
        // with legal/compliance weight — a duplicate surfaced months later
        // during an audit is far worse than a visible, retryable error now.
        // (Previously the fallback was a non-atomic count()+1 read that could
        // mint duplicate numbers under concurrent issuance.)
        try {
          const { data, error } = await supabaseAdmin!.rpc("next_certificate_number", {
            p_prefix: prefix,
            p_year: year,
          });
          if (error) throw error;
          recordSuccess("numbering");
          return (data as number) || 1;
        } catch (err) {
          recordFailure("numbering", err);
          throw new Error(
            "Certificate/student numbering is temporarily unavailable. Please try again shortly — the number has not been consumed."
          );
        }
      }
      return inMemoryDb.numbering.nextNumber(prefix, year);
    },
  },
};