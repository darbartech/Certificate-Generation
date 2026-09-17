import { supabaseAdmin } from "./supabase";
import { inMemoryDb, seedDefaultData } from "./inMemoryDb";
import { loadCanonicalCourseCatalog } from "./courseCatalogSeed";
import crypto from "crypto";
import type {
  CertificateRecord,
  CertificateModuleRecord,
  CertificateEvent,
  CourseRecord,
  CourseModuleRecord,
  SignatoryRecord,
  ReissueOperation,
  AuditOutboxRecord,
  AdminUserRecord,
  AdminSessionRecord,
  AdminLoginEventRecord,
} from "@/lib/types";

const _appendLocks = new Map<string, Promise<unknown>>();

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
  const classified = classifyPersistenceError(err);
  console.warn(
    `[db:${table}] Supabase call failed (${formatSupabaseError(err)}; classified=${classified}). ` +
      (failureCount >= TRIP_THRESHOLD
        ? `Circuit OPEN for "${table}" for ~${COOLDOWN_MS}ms${process.env.NODE_ENV === "production" ? " — failing closed (no in-memory fallback in production)." : " — falling back to in-memory in development."}`
        : `Failure ${failureCount}/${TRIP_THRESHOLD} for "${table}" (opening after the next ${TRIP_THRESHOLD - failureCount}).`)
  );
};

const recordSuccess = (table: string): void => {
  circuits.delete(table);
};

// ---------------------------------------------------------------------------
// Production hardening helpers
// ---------------------------------------------------------------------------
// (1) Safe search (P0-12): user input is interpolated into PostgREST filter
// strings (query.or(...)). Unlike SQL, PostgREST filters are not parameterized,
// so operators like `*`, `%`, `_`, `(`,`)`,`,` could break out of the intended
// expression. Keep letters (including Unicode names like राम बहादुर थापा),
// digits, spaces and a small allowlist; strip everything that PostgREST treats
// as filter syntax.
const stripPostgrestSpecials = (term: string): string =>
  term
    .replace(/[*%_().,;"'\\[\]{}!|&^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

// (2) Issuance persistence gate (P0-03): the in-memory DB is a local-dev tool
// only. When the persistent database (Supabase) is unavailable in production,
// NO official certificate may be written — the read-only degraded mode keeps
// browsing working while issuance is disabled.
export const isPersistentStorageAvailable = (): boolean => {
  if (!USE_SUPABASE) return false;
  return !isOpen("certificates") && !isOpen("numbering");
};

export const persistenceGuardError = (): string | null => {
  if (process.env.NODE_ENV !== "production") return null;
  if (isPersistentStorageAvailable()) return null;
  return (
    "Issuance is disabled because the persistent database is currently " +
    "unavailable. The dashboard is in read-only mode — no certificate can be " +
    "created, issued, reissued or revoked until the database recovers."
  );
};

// Verification-token hashing (§12).
export const sha256Hex = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

// ---------------------------------------------------------------------------
// Persistence error classification (V2 §4)
// ---------------------------------------------------------------------------
// A failed Supabase call means MANY different things, and only one of them
// (missing schema) may ever activate the development compatibility path. Any
// other failure — network, permission, timeout, outage — must remain what it
// is and surface to the caller, never be masked as "schema missing → use
// memory" (which silently returned stale/partial data in production).
export type PersistenceState =
  | "AVAILABLE"
  | "SCHEMA_MISSING"
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

const SCHEMA_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "PGRST205", // requested column does not exist
  "PGRST102", // relation does not exist
]);
const UNAUTHORIZED_CODES = new Set([
  "42501", // insufficient_privilege
  "28P01", // invalid_password
  "28000", // invalid_authorization_specification
  "PGRST300",
  "PGRST301", // JWT authentication issue
  "PGRST302", // permission denied
]);

export const classifyPersistenceError = (err: unknown): PersistenceState => {
  if (err == null) return "UNKNOWN_ERROR";
  const raw = err as { code?: unknown; message?: unknown };
  const code = typeof raw.code === "string" ? raw.code.toUpperCase() : "";
  const message =
    typeof raw.message === "string" ? raw.message : String(err);
  const lower = message.toLowerCase();

  if (code) {
    if (SCHEMA_CODES.has(code) || code.startsWith("42")) return "SCHEMA_MISSING";
    if (UNAUTHORIZED_CODES.has(code)) return "UNAUTHORIZED";
    if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EPIPE" || code === "UND_ERR_CONNECT_TIMEOUT" || lower.includes("timeout")) return "TIMEOUT";
  }
  if (lower.includes("timeout") || lower.includes("etimedout")) return "TIMEOUT";
  if (
    lower.includes("permission denied") ||
    lower.includes("insufficient privilege") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized") ||
    lower.includes("row-level security")
  ) {
    return "UNAUTHORIZED";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("socket hang up") ||
    lower.includes("42101") // relation does not exist when connection dropped
  ) {
    return "UNAVAILABLE";
  }
  if (
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("does not exist") ||
    lower.includes("missing field")
  ) {
    return "SCHEMA_MISSING";
  }
  return "UNKNOWN_ERROR";
};

// ---------------------------------------------------------------------------
// Fail-closed persistence errors (V2 §3, §43)
// ---------------------------------------------------------------------------
// ONE error type represents "the authoritative store cannot be reached or
// trusted right now". API handlers map it to HTTP 503; nothing in production
// ever substitutes in-memory data for it.
export class PersistenceUnavailableError extends Error {
  readonly code = "PERSISTENCE_UNAVAILABLE" as const;
  readonly statusCode = 503;
  readonly table?: string;
  readonly state?: PersistenceState;

  constructor(message: string, opts?: { table?: string; state?: PersistenceState }) {
    super(message);
    this.name = "PersistenceUnavailableError";
    this.table = opts?.table;
    this.state = opts?.state;
  }
}

export const isPersistenceUnavailableError = (
  err: unknown
): err is PersistenceUnavailableError => err instanceof PersistenceUnavailableError;

// Development-only bridge: in production ANY reach here is a fail-closed
// situation (no Supabase configured, circuit open, or a probe failure) and must
// throw instead of silently reading/writing the process-local store.
export const devOnlyInMemory = <T>(table: string, memoryFn: () => T): T => {
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[db:${table}] In-memory fallback was reached in production — failing closed.`
    );
    throw new PersistenceUnavailableError(
      `Persistent database is unavailable (operation family "${table}"). ` +
        "In-memory storage is disabled in production.",
      { table }
    );
  }
  return memoryFn();
};

// Throws for mutating operations that must never silently target the process-local
// in-memory store in production (courses, signatories, modules).
export const assertPersistentWrite = (): void => {
  if (process.env.NODE_ENV !== "production") return;
  if (isPersistentStorageAvailable()) return;
  throw new PersistenceUnavailableError(
    "Persistent database is unavailable — write operations are disabled in production.",
    { table: "write" }
  );
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
  persistenceState?: PersistenceState;
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
  const memoryCatalog = courseCatalogState?.mode === true;
  const degraded =
    info.some((c) => c.open || c.failureCount > 0) || memoryCatalog;
  return {
    useSupabase: USE_SUPABASE,
    degraded,
    circuits: info,
    catalogMode: memoryCatalog ? "memory" : "supabase",
    persistenceState: courseCatalogState?.state,
  };
};

/**
 * V2 §38: a live, minimal round-trip probe for readiness checks. Unlike
 * getDatabaseHealth (cached circuit state) this actually contacts the database
 * so an orchestrator gets an honest answer before routing traffic.
 */
export const pingDatabase = async (): Promise<"ok" | "unavailable" | "memory"> => {
  if (!supabaseAdmin) return "memory";
  try {
    const { error } = await supabaseAdmin
      .from("certificates")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw error;
    return "ok";
  } catch (err) {
    console.error("[health] database ping failed:", err);
    return "unavailable";
  }
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
 *
 * Classification (V2 §4): the probe distinguishes WHY Supabase is unusable.
 * ONLY a genuine SCHEMA_MISSING may ever activate the compatibility path, and
 * even then never in production (production fails closed until migrations are
 * applied). Network/permission/timeout errors stay what they are — they are
 * recorded on the circuit and rethrown so callers surface a 503 instead of
 * stale in-memory data.
 */
let courseCatalogState: { mode: boolean; state: PersistenceState } | null = null;

const courseCatalogStateError = (state: PersistenceState): PersistenceUnavailableError =>
  new PersistenceUnavailableError(
    state === "SCHEMA_MISSING"
      ? "The production database schema is not migrated: the `courses` table is missing " +
        "`certificate_template_id`. Apply migrations 001-014 before enabling issuance."
      : `The course catalog cannot be read from the persistent database (${state}). ` +
        "No in-memory fallback exists in production.",
    { table: "courses", state }
  );

const courseCatalogInMemory = async (): Promise<boolean> => {
  if (courseCatalogState) return courseCatalogState.mode;

  if (!USE_SUPABASE) {
    courseCatalogState = { mode: true, state: "SCHEMA_MISSING" };
    return true;
  }

  try {
    const { error } = await supabaseAdmin!
      .from("courses")
      .select("certificate_template_id")
      .limit(1);
    if (error) {
      const state = classifyPersistenceError(error);
      if (state === "SCHEMA_MISSING") {
        recordFailure("courses", error);
        if (process.env.NODE_ENV === "production") {
          throw courseCatalogStateError("SCHEMA_MISSING");
        }
        courseCatalogState = { mode: true, state };
        console.warn(
          "[db:courses] Supabase `courses` table is missing required column(s) (certificate_template_id). " +
            "The course catalog will run from in-memory (development only) until the schema is migrated."
        );
        return true;
      }
      if (state === "UNAUTHORIZED") {
        recordFailure("courses", error);
        throw courseCatalogStateError("UNAUTHORIZED");
      }
      recordFailure("courses", error);
      throw courseCatalogStateError(state === "TIMEOUT" ? "TIMEOUT" : "UNKNOWN_ERROR");
    }
    courseCatalogState = { mode: false, state: "AVAILABLE" };
    return false;
  } catch (err) {
    if (err instanceof PersistenceUnavailableError) throw err;
    recordFailure("courses", err);
    if (process.env.NODE_ENV === "production") {
      throw courseCatalogStateError(classifyPersistenceError(err));
    }
    throw err;
  }
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
      name: "Mohan Shahi",
      position: "Director, DarbarTech Group of Technology",
      active: true,
      is_default_secondary: true,
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
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
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
      assertPersistentWrite();
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.create(data));
    },

    update: async (id: string, data: Partial<CertificateRecord>): Promise<CertificateRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
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
      assertPersistentWrite();
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.update(id, data));
    },

    findById: async (id: string): Promise<CertificateRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
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
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.findById(id));
    },

    findByNumber: async (certificateNumber: string): Promise<CertificateRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
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
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.findByNumber(certificateNumber));
    },

    findByToken: async (verificationToken: string): Promise<CertificateRecord | null> => {
      // Lookup by SHA-256 of the raw token (production hardening §12): the
      // verification link carries the raw token, the DB stores only its hash,
      // so a leaked database does not contain usable verification links.
      const tokenHash = sha256Hex(verificationToken);
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificates")
            .select("*")
            .eq("verification_token_hash", tokenHash)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("certificates");
          return data as CertificateRecord | null;
        } catch (err) {
          if (!usingSupabase("certificates", err)) throw err;
        }
      }
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.findByToken(verificationToken));
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
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*");
          if (options.status) query = query.eq("status", options.status);
          const safeQ = options.q ? stripPostgrestSpecials(options.q) : "";
          if (safeQ) {
            query = query.or(
              `recipient_name.ilike.*${safeQ}*,certificate_number.ilike.*${safeQ}*,student_id.ilike.*${safeQ}*`
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
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.list(options));
    },

    count: async (options: {
      status?: string;
      statuses?: string[];
      since?: string;
      until?: string;
      dateField?: "created_at" | "issued_at";
      q?: string;
    } = {}): Promise<number> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificates")) {
        try {
          let query = supabaseAdmin!.from("certificates").select("*", { count: "exact", head: true });
          if (options.status) query = query.eq("status", options.status);
          if (options.statuses && options.statuses.length > 0) {
            query = query.in("status", options.statuses);
          }
          const safeQ = options.q ? stripPostgrestSpecials(options.q) : "";
          if (safeQ) {
            query = query.or(
              `recipient_name.ilike.*${safeQ}*,certificate_number.ilike.*${safeQ}*,student_id.ilike.*${safeQ}*`
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
      return devOnlyInMemory("certificates", () => inMemoryDb.certificates.count(options));
    },
  },

  certificateModules: {
    bulkCreate: async (
      modules: Omit<CertificateModuleRecord, "id">[]
    ): Promise<CertificateModuleRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificateModules")) {
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
      assertPersistentWrite();
      return devOnlyInMemory("certificateModules", () => inMemoryDb.certificateModules.bulkCreate(modules));
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateModuleRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificateModules")) {
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
      return devOnlyInMemory("certificateModules", () => inMemoryDb.certificateModules.findByCertificateId(certificateId));
    },
  },

  certificateEvents: {
    create: async (
      event: Partial<CertificateEvent> & {
        certificate_id: string;
        event_type: CertificateEvent["event_type"];
      } & { id: string }
    ): Promise<CertificateEvent> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificateEvents")) {
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
      assertPersistentWrite();
      return devOnlyInMemory("certificateEvents", () => inMemoryDb.certificateEvents.create(event));
    },

    // V2 §10: head-locked, transactionally-chained append. The caller computes
    // the hash (single hashing source of truth) and the expected predecessor;
    // the RPC serializes on the head row. On conflict it returns the real
    // predecessor so the caller can re-chain and retry.
    appendWithHead: async (
      event: CertificateEvent & { certificate_id: string; event_type: CertificateEvent["event_type"] }
    ): Promise<{ ok: boolean; previousEventHash: string | null; version: number }> => {
      const metadata = (event.metadata || {}) as Record<string, unknown>;
      // T-B7: serialize concurrent appends per certificate (single-process mutex).
      // Multi-instance deployments must use the PostgreSQL RPC with SELECT FOR UPDATE
      // or SERIALIZABLE isolation — see PRODUCTION_SECURITY_MODEL.md §Audit.
      const lockKey = `cert:${event.certificate_id}`;
      const prevLock = _appendLocks.get(lockKey) ?? Promise.resolve();
      let unlock: () => void = () => {};
      const myLock = new Promise<void>((resolve) => { unlock = resolve; });
      _appendLocks.set(lockKey, prevLock.finally(() => myLock));
      try {
        await prevLock;
        if (!(await courseCatalogInMemory()) && usingSupabase("certificateEvents")) {
          try {
            const { data, error } = await supabaseAdmin!.rpc("append_audit_event", {
              p_id: event.id,
              p_certificate_id: event.certificate_id,
              p_event_type: event.event_type,
              p_actor_id: event.actor_id ?? null,
              p_created_at: event.created_at,
              p_metadata: metadata,
              p_metadata_canonical: event.metadata_canonical ?? JSON.stringify(metadata),
              p_expected_previous: event.previous_event_hash ?? null,
              p_event_hash: event.event_hash ?? null,
              p_request_id: event.request_id ?? null,
              p_ip: typeof metadata.ip === "string" ? metadata.ip : null,
              p_user_agent: typeof metadata.userAgent === "string" ? metadata.userAgent : null,
            });
            if (error) throw error;
            recordSuccess("certificateEvents");
            const row = (data || {}) as {
              ok?: boolean;
              previous_event_hash?: string | null;
              version?: number;
            };
            return {
              ok: !!row.ok,
              previousEventHash: row.previous_event_hash ?? null,
              version: row.version ?? 0,
            };
          } catch (err) {
            if (!usingSupabase("certificateEvents", err)) throw err;
          }
        }
        return devOnlyInMemory("certificateEvents", () =>
          inMemoryDb.certificateEvents.appendWithHead(event)
        );
      } finally {
        unlock();
        if (_appendLocks.get(lockKey) === myLock) _appendLocks.delete(lockKey);
      }
    },

    findByCertificateId: async (certificateId: string): Promise<CertificateEvent[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificateEvents")) {
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
      return devOnlyInMemory("certificateEvents", () => inMemoryDb.certificateEvents.findByCertificateId(certificateId));
    },

    list: async (options: { limit?: number; since?: string } = {}): Promise<CertificateEvent[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("certificateEvents")) {
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
      return devOnlyInMemory("certificateEvents", () => inMemoryDb.certificateEvents.list(options));
    },
  },

  // V2 §11: durable outbox for critical audit events when the head-locked append
  // cannot complete. Rows are drained by the background processor.
  auditOutbox: {
    enqueue: async (data: {
      id: string;
      certificate_id: string;
      event_type: string;
      payload: Record<string, unknown>;
    }): Promise<void> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("auditOutbox")) {
        try {
          const { error } = await supabaseAdmin!.from("certificate_event_outbox").insert({
            id: data.id,
            certificate_id: data.certificate_id,
            event_type: data.event_type,
            payload: data.payload,
          });
          // 23505 = duplicate id: an earlier retry already enqueued it.
          if (error && error.code !== "23505") throw error;
          recordSuccess("auditOutbox");
          return;
        } catch (err) {
          if (!usingSupabase("auditOutbox", err)) throw err;
        }
      }
      return devOnlyInMemory("auditOutbox", () => inMemoryDb.auditOutbox.enqueue(data));
    },

    listPending: async (limit = 50): Promise<AuditOutboxRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("auditOutbox")) {
        try {
          const { data, error } = await supabaseAdmin!.from("certificate_event_outbox")
            .select("*")
            .is("processed_at", null)
            .order("created_at", { ascending: true })
            .limit(limit);
          if (error) throw error;
          recordSuccess("auditOutbox");
          return (data || []) as AuditOutboxRecord[];
        } catch (err) {
          if (!usingSupabase("auditOutbox", err)) throw err;
        }
      }
      return devOnlyInMemory("auditOutbox", () => inMemoryDb.auditOutbox.listPending(limit));
    },

    markProcessed: async (id: string): Promise<void> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("auditOutbox")) {
        try {
          const { error } = await supabaseAdmin!.from("certificate_event_outbox")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          recordSuccess("auditOutbox");
          return;
        } catch (err) {
          if (!usingSupabase("auditOutbox", err)) throw err;
        }
      }
      return devOnlyInMemory("auditOutbox", () => inMemoryDb.auditOutbox.markProcessed(id));
    },

    markFailed: async (id: string, error: string): Promise<void> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("auditOutbox")) {
        try {
          const { data } = await supabaseAdmin!.from("certificate_event_outbox")
            .select("attempt_count")
            .eq("id", id)
            .maybeSingle();
          const next = ((data as { attempt_count?: number } | null)?.attempt_count || 0) + 1;
          const { error: updErr } = await supabaseAdmin!.from("certificate_event_outbox")
            .update({ attempt_count: next, last_error: error.slice(0, 1000) })
            .eq("id", id);
          if (updErr) throw updErr;
          recordSuccess("auditOutbox");
          return;
        } catch (err) {
          if (!usingSupabase("auditOutbox", err)) throw err;
        }
      }
      return devOnlyInMemory("auditOutbox", () => inMemoryDb.auditOutbox.markFailed(id, error));
    },
  },

  courses: {
    create: async (data: Omit<CourseRecord, "id">): Promise<CourseRecord> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("courses", () => inMemoryDb.courses.create(data));
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
      return devOnlyInMemory("courses", () => inMemoryDb.courses.findById(id));
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
      return devOnlyInMemory("courses", () => inMemoryDb.courses.list(activeOnly));
    },

    update: async (id: string, data: Partial<CourseRecord>): Promise<CourseRecord | null> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("courses", () => inMemoryDb.courses.update(id, data));
    },

    // Transactional course save (production hardening §18): course fields AND
    // the module grid are replaced inside a single PostgreSQL transaction via
    // the update_course_with_modules RPC, so a mid-way failure cannot leave the
    // course with new fields but a wiped/partial module set.
    updateWithModules: async (
      id: string,
      fields: Omit<Partial<CourseRecord>, "id" | "created_at" | "updated_at">,
      modules: Omit<CourseModuleRecord, "id" | "course_id">[]
    ): Promise<{ course: CourseRecord | null; modules: CourseModuleRecord[] }> => {
      assertPersistentWrite();
      if (!(await courseCatalogInMemory()) && usingSupabase("courses")) {
        try {
          const { data, error } = await supabaseAdmin!.rpc("update_course_with_modules", {
            p_course_id: id,
            p_fields: courseToSupabase(fields as unknown as Record<string, unknown>),
            p_modules: modules.map((m) => ({
              order: m.sort_order,
              title: m.title,
              subtitle: m.subtitle || null,
              active: m.active ?? true,
            })),
          });
          if (error) throw error;
          if (data === false) {
            return { course: null, modules: [] };
          }
          const course = await db.courses.findById(id);
          const updatedModules = await db.courseModules.findByCourseId(id, false);
          recordSuccess("courses");
          return { course, modules: updatedModules };
        } catch (err) {
          if (!usingSupabase("courses", err)) throw err;
        }
      }
      // In-memory fallback mirrors the same atomic intent (single synchronous
      // replacement — nothing can partially fail in a single-threaded store).
      return devOnlyInMemory("courses", async () => {
        const course = await inMemoryDb.courses.update(id, fields);
        await inMemoryDb.courseModules.deleteByCourseId(id);
        const created: CourseModuleRecord[] = [];
        for (const m of modules) {
          created.push(
            await inMemoryDb.courseModules.create({
              course_id: id,
              sort_order: m.sort_order,
              title: m.title,
              subtitle: m.subtitle || null,
              active: m.active ?? true,
            })
          );
        }
        return { course, modules: created };
      });
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
      return devOnlyInMemory("courseModules", () => inMemoryDb.courseModules.findByCourseId(courseId, activeOnly));
    },

    create: async (data: Omit<CourseModuleRecord, "id">): Promise<CourseModuleRecord> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("courseModules", () => inMemoryDb.courseModules.create(data));
    },

    update: async (id: string, data: Partial<CourseModuleRecord>): Promise<CourseModuleRecord | null> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("courseModules", () => inMemoryDb.courseModules.update(id, data));
    },

    deleteByCourseId: async (courseId: string): Promise<void> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("courseModules", () => inMemoryDb.courseModules.deleteByCourseId(courseId));
    },
  },

  signatories: {
    create: async (data: Omit<SignatoryRecord, "id">): Promise<SignatoryRecord> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("signatories", () => inMemoryDb.signatories.create(data));
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
      return devOnlyInMemory("signatories", () => inMemoryDb.signatories.findById(id));
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
      return devOnlyInMemory("signatories", () => inMemoryDb.signatories.list(activeOnly));
    },

    // V2 §9: the default secondary (Managing Director) signatory is DATA, not
    // code. Resolution is `is_default_secondary = true AND active = true`; the
    // database enforces at most one such row (migration 011).
    findDefaultSecondary: async (): Promise<SignatoryRecord | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("signatories")) {
        try {
          const { data, error } = await supabaseAdmin!.from("signatories")
            .select("*")
            .eq("is_default_secondary", true)
            .eq("active", true)
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("signatories");
          return (data as SignatoryRecord) || null;
        } catch (err) {
          if (!usingSupabase("signatories", err)) throw err;
        }
      }
      return devOnlyInMemory("signatories", async () => {
        const all = await inMemoryDb.signatories.list(true);
        return all.find((s) => s.is_default_secondary === true) || null;
      });
    },

    update: async (id: string, data: Partial<SignatoryRecord>): Promise<SignatoryRecord | null> => {
      assertPersistentWrite();
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
      return devOnlyInMemory("signatories", () => inMemoryDb.signatories.update(id, data));
    },
  },

  // V2 §13/§14: reissue idempotency ledger. `finalize` performs the supersede +
  // relationship updates in a single DB transaction (RPC) so a crash between
  // them cannot leave "replacement created but original still live".
  reissueOperations: {
    findByIdempotencyKey: async (key: string): Promise<ReissueOperation | null> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("reissue_operations")) {
        try {
          const { data, error } = await supabaseAdmin!.from("reissue_operations")
            .select("*")
            .eq("idempotency_key", key)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("reissue_operations");
          return (data as ReissueOperation) || null;
        } catch (err) {
          if (!usingSupabase("reissue_operations", err)) throw err;
        }
      }
      return devOnlyInMemory("reissue_operations", () =>
        inMemoryDb.reissueOperations.findByIdempotencyKey(key)
      );
    },

    create: async (data: {
      idempotency_key: string;
      original_certificate_id: string;
      requested_by?: string | null;
      status: ReissueOperation["status"];
    }): Promise<ReissueOperation> => {
      assertPersistentWrite();
      if (!(await courseCatalogInMemory()) && usingSupabase("reissue_operations")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("reissue_operations")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("reissue_operations");
          return result as ReissueOperation;
        } catch (err) {
          if (!usingSupabase("reissue_operations", err)) throw err;
        }
      }
      return devOnlyInMemory("reissue_operations", () => inMemoryDb.reissueOperations.create(data));
    },

    update: async (
      id: string,
      data: Partial<ReissueOperation>
    ): Promise<ReissueOperation | null> => {
      assertPersistentWrite();
      if (!(await courseCatalogInMemory()) && usingSupabase("reissue_operations")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("reissue_operations")
            .update(data)
            .eq("id", id)
            .select()
            .single();
          if (error) {
            if (error.code === "PGRST116") return null;
            throw error;
          }
          recordSuccess("reissue_operations");
          return result as ReissueOperation;
        } catch (err) {
          if (!usingSupabase("reissue_operations", err)) throw err;
        }
      }
      return devOnlyInMemory("reissue_operations", () => inMemoryDb.reissueOperations.update(id, data));
    },

    // Atomic commit of a reissue (§13): mark the original SUPERSEDED, link the
    // replacement, and complete the operation in one transaction. Throws if the
    // original is not in a supersedable state (which aborts the RPC).
    finalize: async (
      operationId: string | null,
      originalId: string,
      replacementId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("reissue_operations")) {
        try {
          const { error } = await supabaseAdmin!.rpc("finalize_reissue", {
            p_operation_id: operationId,
            p_original_id: originalId,
            p_replacement_id: replacementId,
          });
          if (error) throw error;
          recordSuccess("reissue_operations");
          return { success: true };
        } catch (err) {
          if (!usingSupabase("reissue_operations", err)) throw err;
        }
      }
      return devOnlyInMemory("reissue_operations", async () => {
        const original = await inMemoryDb.certificates.findById(originalId);
        if (
          !original ||
          (original.status !== "ISSUED" && original.status !== "REISSUED")
        ) {
          return {
            success: false,
            error: `Original ${originalId} is not in a supersedable state.`,
          };
        }
        await inMemoryDb.certificates.update(originalId, {
          status: "SUPERSEDED",
          superseded_at: new Date().toISOString(),
          superseded_by_id: replacementId,
        });
        await inMemoryDb.certificates.update(replacementId, {
          reissued_from_id: originalId,
        });
        if (operationId) {
          await inMemoryDb.reissueOperations.update(operationId, {
            status: "COMPLETED",
            replacement_certificate_id: replacementId,
            completed_at: new Date().toISOString(),
          });
        }
        return { success: true };
      });
    },
  },

  adminUsers: {
    findByUsername: async (username: string): Promise<AdminUserRecord | null> => {
      if (usingSupabase("adminUsers")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_users")
            .select("*")
            .ilike("username", username.trim())
            .maybeSingle();
          if (error) throw error;
          recordSuccess("adminUsers");
          return (data as AdminUserRecord) || null;
        } catch (err) {
          if (!usingSupabase("adminUsers", err)) throw err;
        }
      }
      return devOnlyInMemory("adminUsers", () => inMemoryDb.adminUsers.findByUsername(username));
    },

    findById: async (id: string): Promise<AdminUserRecord | null> => {
      if (usingSupabase("adminUsers")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_users")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (data) {
            recordSuccess("adminUsers");
            return data as AdminUserRecord;
          }
        } catch (err) {
          if (!usingSupabase("adminUsers", err)) throw err;
        }
      }
      return devOnlyInMemory("adminUsers", () => inMemoryDb.adminUsers.findById(id));
    },

    list: async (): Promise<AdminUserRecord[]> => {
      if (usingSupabase("adminUsers")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_users")
            .select("*")
            .order("created_at", { ascending: true });
          if (error) throw error;
          recordSuccess("adminUsers");
          return (data || []) as AdminUserRecord[];
        } catch (err) {
          if (!usingSupabase("adminUsers", err)) throw err;
        }
      }
      return devOnlyInMemory("adminUsers", () => inMemoryDb.adminUsers.list());
    },

    create: async (data: AdminUserRecord): Promise<AdminUserRecord> => {
      assertPersistentWrite();
      if (usingSupabase("adminUsers")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("admin_users")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("adminUsers");
          return result as AdminUserRecord;
        } catch (err) {
          if (!usingSupabase("adminUsers", err)) throw err;
        }
      }
      return devOnlyInMemory("adminUsers", () => inMemoryDb.adminUsers.create(data));
    },

    update: async (id: string, data: Partial<AdminUserRecord>): Promise<AdminUserRecord | null> => {
      assertPersistentWrite();
      if (usingSupabase("adminUsers")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("admin_users")
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .maybeSingle();
          if (error) throw error;
          recordSuccess("adminUsers");
          if (result) return result as AdminUserRecord;
        } catch (err) {
          if (!usingSupabase("adminUsers", err)) throw err;
        }
      }
      return devOnlyInMemory("adminUsers", () => inMemoryDb.adminUsers.update(id, data));
    },
  },

  adminSessions: {
    create: async (data: AdminSessionRecord): Promise<AdminSessionRecord> => {
      assertPersistentWrite();
      if (usingSupabase("adminSessions")) {
        try {
          const { data: result, error } = await supabaseAdmin!.from("admin_sessions")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("adminSessions");
          return result as AdminSessionRecord;
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.create(data));
    },

    findByTokenHash: async (tokenHash: string): Promise<AdminSessionRecord | null> => {
      if (usingSupabase("adminSessions")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_sessions")
            .select("*")
            .eq("token_hash", tokenHash)
            .maybeSingle();
          if (error) throw error;
          recordSuccess("adminSessions");
          return (data as AdminSessionRecord) || null;
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.findByTokenHash(tokenHash));
    },

    touch: async (id: string): Promise<void> => {
      if (usingSupabase("adminSessions")) {
        try {
          const { error } = await supabaseAdmin!.from("admin_sessions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          recordSuccess("adminSessions");
          return;
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.touch(id));
    },

    revoke: async (tokenHash: string): Promise<void> => {
      if (usingSupabase("adminSessions")) {
        try {
          const { error } = await supabaseAdmin!.rpc("revoke_admin_session", {
            p_token_hash: tokenHash,
          });
          if (error) throw error;
          recordSuccess("adminSessions");
          return;
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.revoke(tokenHash));
    },

    revokeAllForUser: async (adminUserId: string): Promise<number> => {
      if (usingSupabase("adminSessions")) {
        try {
          const { data, error } = await supabaseAdmin!.rpc("revoke_all_admin_sessions", {
            p_admin_user_id: adminUserId,
          });
          if (error) throw error;
          recordSuccess("adminSessions");
          return (data as number) || 0;
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.revokeAllForUser(adminUserId));
    },

    listActiveForUser: async (adminUserId: string): Promise<AdminSessionRecord[]> => {
      if (usingSupabase("adminSessions")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_sessions")
            .select("*")
            .eq("admin_user_id", adminUserId)
            .is("revoked_at", null)
            .gt("expires_at", new Date().toISOString());
          if (error) throw error;
          recordSuccess("adminSessions");
          return (data || []) as AdminSessionRecord[];
        } catch (err) {
          if (!usingSupabase("adminSessions", err)) throw err;
        }
      }
      return devOnlyInMemory("adminSessions", () => inMemoryDb.adminSessions.listActiveForUser(adminUserId));
    },
  },

  adminLoginEvents: {
    record: async (data: AdminLoginEventRecord): Promise<AdminLoginEventRecord> => {
      // Best-effort append: authentication itself must not fail because the
      // audit trail is briefly unavailable.
      try {
        if (usingSupabase("adminLoginEvents")) {
          const { data: result, error } = await supabaseAdmin!.from("admin_login_events")
            .insert(data)
            .select()
            .single();
          if (error) throw error;
          recordSuccess("adminLoginEvents");
          return result as AdminLoginEventRecord;
        }
      } catch (err) {
        if (!usingSupabase("adminLoginEvents", err)) throw err;
      }
      try {
        return await inMemoryDb.adminLoginEvents.record(data);
      } catch {
        return data;
      }
    },

    listRecent: async (limit = 50): Promise<AdminLoginEventRecord[]> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("adminLoginEvents")) {
        try {
          const { data, error } = await supabaseAdmin!.from("admin_login_events")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) throw error;
          recordSuccess("adminLoginEvents");
          return (data || []) as AdminLoginEventRecord[];
        } catch (err) {
          if (!usingSupabase("adminLoginEvents", err)) throw err;
        }
      }
      return devOnlyInMemory("adminLoginEvents", () => inMemoryDb.adminLoginEvents.listRecent(limit));
    },
  },

  numbering: {
    nextNumber: async (prefix: string, year: number): Promise<number> => {
      if (!(await courseCatalogInMemory()) && usingSupabase("numbering")) {
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
          throw new PersistenceUnavailableError(
            "Certificate/student numbering is temporarily unavailable. Please try again shortly — the number has not been consumed.",
            { table: "numbering", state: classifyPersistenceError(err) }
          );
        }
      }
      return devOnlyInMemory("numbering", () => inMemoryDb.numbering.nextNumber(prefix, year));
    },
  },
};