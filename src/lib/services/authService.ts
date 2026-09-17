import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/database";
import {
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginThrottle,
} from "@/lib/services/loginThrottle";
import {
  PERMISSION_KEYS,
  type Permission,
  type AdminUser,
  type AdminUserRecord,
  type AdminLoginEventRecord,
  type AdminSessionRecord,
} from "@/lib/types";

export type { AdminUser } from "@/lib/types";

const isProd = process.env.NODE_ENV === "production";

const sha256Hex = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const SESSION_TTL_MS =
  Math.max(5, Number(process.env.ADMIN_SESSION_TTL_MINUTES) || 8 * 60) * 60 * 1000;

// ---------------------------------------------------------------------------
// Development fallback users
// ---------------------------------------------------------------------------
// V2 §15: production admin accounts live in `admin_users`. These env-backed
// users exist ONLY so local development works without a database. In production
// they are never trusted: if the database has no admin, authentication fails.
// Default passwords are deliberately refused in production.

const allPermissions = (): Record<Permission, boolean> => {
  const record = {} as Record<Permission, boolean>;
  for (const key of PERMISSION_KEYS) record[key] = true;
  return record;
};

const staffPermissions = (): Record<Permission, boolean> => {
  const record = allPermissions();
  for (const key of PERMISSION_KEYS) record[key] = false;
  record.VIEW_CERTIFICATES = true;
  record.CREATE_CERTIFICATE = true;
  record.PREVIEW_CERTIFICATE = true;
  record.DOWNLOAD_CERTIFICATE = true;
  return record;
};

// Legacy permission keys (pre-V2) mapped onto the granular set, so existing
// `admin_users.permissions` JSONB rows keep working without a data migration.
const LEGACY_PERMISSION_MAP: Record<string, Permission[]> = {
  create: ["CREATE_CERTIFICATE"],
  preview: ["PREVIEW_CERTIFICATE"],
  issue: ["ISSUE_CERTIFICATE", "REISSUE_CERTIFICATE"],
  revoke: ["REVOKE_CERTIFICATE"],
  download: ["DOWNLOAD_CERTIFICATE"],
  manageTemplates: ["MANAGE_COURSES", "MANAGE_SIGNATORIES", "MANAGE_TEMPLATES"],
};

export const normalizePermissions = (
  raw: Record<string, unknown> | null | undefined,
  role: AdminUser["role"]
): Record<Permission, boolean> => {
  const record = allPermissions();
  for (const key of PERMISSION_KEYS) record[key] = false;
  if (role === "super_admin") {
    for (const key of PERMISSION_KEYS) record[key] = true;
  }
  if (raw) {
    for (const [legacy, targets] of Object.entries(LEGACY_PERMISSION_MAP)) {
      if (raw[legacy] === true) for (const target of targets) record[target] = true;
    }
    for (const key of PERMISSION_KEYS) {
      if (typeof raw[key] === "boolean") record[key] = raw[key] as boolean;
    }
  }
  return record;
};

const DEFAULT_USERS: AdminUser[] = [
  {
    id: "user-super-admin",
    username: "admin",
    role: "super_admin",
    permissions: allPermissions(),
  },
  {
    id: "user-admin",
    username: "staff",
    role: "staff",
    permissions: staffPermissions(),
  },
];

const PASSWORD_HASHES: Record<string, string> = {};
let passwordsInitialized = false;

async function initPasswords() {
  if (passwordsInitialized) return;

  const adminPassword = process.env.ADMIN_PASSWORD;
  const staffPassword = process.env.STAFF_PASSWORD;

  if (isProd && (!adminPassword || !staffPassword)) {
    throw new Error(
      "ADMIN_PASSWORD and STAFF_PASSWORD must be set in production (no default credentials allowed)."
    );
  }

  for (const [name, value] of [
    ["ADMIN_PASSWORD", adminPassword],
    ["STAFF_PASSWORD", staffPassword],
  ] as const) {
    if (value && value.length < 12) {
      const message = `${name} must be at least 12 characters long (got ${value.length}).`;
      if (isProd) throw new Error(message);
      console.warn(`[auth] ${message}`);
    }
  }

  if (!adminPassword || !staffPassword) {
    console.warn(
      "[auth] ADMIN_PASSWORD/STAFF_PASSWORD not set. Using insecure development-only " +
        "defaults ('admin123' / 'staff123'). Set these before deploying."
    );
  }

  PASSWORD_HASHES["admin"] = await bcrypt.hash(adminPassword || "admin123", 12);
  PASSWORD_HASHES["staff"] = await bcrypt.hash(staffPassword || "staff123", 12);
  passwordsInitialized = true;
}

const getDevRecord = async (username: string): Promise<AdminUserRecord | null> => {
  if (isProd) return null;
  await initPasswords();
  const user = DEFAULT_USERS.find((u) => u.username === username.trim().toLowerCase());
  if (!user) return null;
  return {
    ...user,
    password_hash: PASSWORD_HASHES[user.username],
    is_active: true,
    mfa_secret: null,
    mfa_enabled: false,
    mfaEnabled: false,
  };
};

const getDevRecordById = async (id: string): Promise<AdminUserRecord | null> => {
  if (isProd) return null;
  await initPasswords();
  const user = DEFAULT_USERS.find((u) => u.id === id);
  if (!user) return null;
  return {
    ...user,
    password_hash: PASSWORD_HASHES[user.username],
    is_active: true,
    mfa_secret: null,
    mfa_enabled: false,
    mfaEnabled: false,
  };
};

const lookupAdmin = async (username: string): Promise<AdminUserRecord | null> => {
  const fromDb = await db.adminUsers.findByUsername(username);
  if (fromDb) return fromDb;
  return getDevRecord(username);
};

const lookupAdminById = async (id: string): Promise<AdminUserRecord | null> => {
  const fromDb = await db.adminUsers.findById(id);
  if (fromDb) return fromDb;
  return getDevRecordById(id);
};

const toAdminUser = (record: AdminUserRecord): AdminUser => ({
  id: record.id,
  username: record.username,
  role: record.role,
  permissions: normalizePermissions(
    record.permissions as unknown as Record<string, unknown>,
    record.role
  ),
  mfaEnabled: !!record.mfa_enabled,
});

// A hash of a random value, used so failed logins for unknown usernames take
// the same amount of time as failed logins for known usernames, preventing
// username enumeration through response timing.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);

// ---------------------------------------------------------------------------
// Login attempt tracking / lockout (§18)
// ---------------------------------------------------------------------------
// Distributed per-username and per-IP lockout lives in loginThrottle.ts
// (Redis-backed, fail-closed when Redis is unavailable).

// ---------------------------------------------------------------------------
// Login event audit trail (§15)
// ---------------------------------------------------------------------------

const recordLoginEvent = async (
  record: AdminUserRecord | null,
  username: string,
  success: boolean,
  meta?: { ip?: string; userAgent?: string; eventType?: string }
): Promise<void> => {
  const event: AdminLoginEventRecord = {
    id: crypto.randomUUID(),
    admin_user_id: record?.id ?? null,
    username: username || null,
    event_type: meta?.eventType || "login",
    success,
    ip_address: meta?.ip ? String(meta.ip).slice(0, 64) : null,
    user_agent: meta?.userAgent ? String(meta.userAgent).slice(0, 256) : null,
    created_at: new Date().toISOString(),
  };
  try {
    await db.adminLoginEvents.record(event);
  } catch (err) {
    console.error("[auth] Failed to record login event:", err);
  }
};

// ---------------------------------------------------------------------------
// Authentication (§15)
// ---------------------------------------------------------------------------

export type AuthenticatedAdmin = {
  user: AdminUser;
  record: AdminUserRecord;
};

/**
 * Verifies username/password. Returns null for any failure (unknown user,
 * wrong password, disabled account, lockout) without distinguishing which.
 * The password is always compared against some bcrypt hash to keep timing flat.
 */
export const authenticateAdmin = async (
  username: string,
  password: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<AuthenticatedAdmin | null> => {
  const throttle = await checkLoginThrottle(username, meta?.ip || "unknown");
  if (throttle.locked) {
    await bcrypt.compare(password, DUMMY_HASH);
    await recordLoginEvent(null, username, false, { ...meta, eventType: "login_locked" });
    return null;
  }

  const record = await lookupAdmin(username);
  const hash = record ? record.password_hash : DUMMY_HASH;
  const valid = await bcrypt.compare(password, hash);

  if (!record || !valid || !record.is_active) {
    await recordLoginFailure(username, meta?.ip || "unknown");
    await recordLoginEvent(record, username, false, meta);
    return null;
  }

  await clearLoginThrottle(username);
  try {
    await db.adminUsers.update(record.id, { last_login_at: new Date().toISOString() });
  } catch {
    // Non-fatal: the account is valid even if the last-login stamp fails.
  }
  return { user: toAdminUser(record), record };
};

// ---------------------------------------------------------------------------
// TOTP MFA (§17)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (input: string): Buffer => {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

const base32Encode = (buf: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

const hotp = (key: Buffer, counter: number): string => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return (binary % 1_000_000).toString().padStart(6, "0");
};

export const generateTotpSecret = (): string =>
  base32Encode(crypto.randomBytes(20));

export const buildTotpUri = (username: string, secret: string): string =>
  `otpauth://totp/DarbarTech:${encodeURIComponent(username)}?secret=${secret}&issuer=DarbarTech&algorithm=SHA1&digits=6&period=30`;

export const verifyTotp = (secret: string | null | undefined, token: string): boolean => {
  if (!secret) return false;
  const code = (token || "").trim();
  if (!/^\d{6}$/.test(code)) return false;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -1; drift <= 1; drift++) {
    if (hotp(key, counter + drift) === code) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Persistent sessions (§16)
// ---------------------------------------------------------------------------
// The cookie holds an opaque random ID; only its SHA-256 hash is stored. Every
// authenticated request re-loads the session and admin, so disabling an admin
// or revoking a session takes effect immediately on the next request.

export const createAdminSession = async (
  userId: string,
  meta?: { ip?: string; userAgent?: string },
  opts?: { mfaVerified?: boolean; scope?: string }
): Promise<{ sessionId: string; expiresAt: Date }> => {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.adminSessions.create({
    id: crypto.randomUUID(),
    admin_user_id: userId,
    token_hash: sha256Hex(sessionId),
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
    last_seen_at: now.toISOString(),
    ip_address: meta?.ip ? String(meta.ip).slice(0, 64) : null,
    user_agent: meta?.userAgent ? String(meta.userAgent).slice(0, 256) : null,
    mfa_verified: opts?.mfaVerified ?? false,
    scope: opts?.scope,
  });
  return { sessionId, expiresAt };
};

export const resolveSession = async (sessionId: string): Promise<AdminUser | null> => {
  if (!sessionId) return null;
  const session = await db.adminSessions.findByTokenHash(sha256Hex(sessionId));
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const record = await lookupAdminById(session.admin_user_id);
  if (!record || !record.is_active) return null;

  // Best-effort last-seen update; a failure must not reject a valid session.
  void db.adminSessions.touch(session.id).catch(() => {});
  const user = toAdminUser(record);
  user.sessionInfo = {
    mfa_verified: session.mfa_verified ?? false,
    scope: session.scope,
  };
  return user;
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  await db.adminSessions.revoke(sha256Hex(sessionId));
};

export const revokeAllSessions = async (userId: string): Promise<number> =>
  db.adminSessions.revokeAllForUser(userId);

export const listActiveSessions = async (userId: string) =>
  db.adminSessions.listActiveForUser(userId);

// ---------------------------------------------------------------------------
// Permissions / display helpers
// ---------------------------------------------------------------------------

export const checkPermission = (
  user: AdminUser,
  permission: keyof AdminUser["permissions"]
): boolean => {
  if (user.role === "super_admin") return true;
  return user.permissions[permission];
};

export const roleLabels: Record<AdminUser["role"], string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};

// Maps a certificate_events.actor_id back to a displayable username. Falls
// back to the development users; database-backed usernames are captured here
// when sessions resolve (see resolveSession) via the cache below.
const usernameCache = new Map<string, string>();

const rememberUsername = (user: AdminUser): void => {
  usernameCache.set(user.id, user.username);
};

export const getUsernameById = (userId: string | null | undefined): string | null => {
  if (!userId) return null;
  return (
    usernameCache.get(userId) ??
    DEFAULT_USERS.find((u) => u.id === userId)?.username ??
    null
  );
};

// Wrap resolveSession so successful lookups populate the username cache used
// by the dashboard/audit rendering.
export const resolveSessionWithCache = async (sessionId: string): Promise<AdminUser | null> => {
  const user = await resolveSession(sessionId);
  if (user) rememberUsername(user);
  return user;
};

// ---------------------------------------------------------------------------
// Admin account management (§15)
// ---------------------------------------------------------------------------

export type PermissionSet = Record<Permission, boolean>;

const rolePermissions = (role: AdminUser["role"]): PermissionSet => {
  if (role === "super_admin") return allPermissions();
  if (role === "staff") return staffPermissions();
  // "admin" (certificate manager): everything operational, but not account or
  // deployment settings management.
  const record = allPermissions();
  record.MANAGE_ADMINS = false;
  record.MANAGE_SETTINGS = false;
  return record;
};

export const listAdminAccounts = async (): Promise<AdminUser[]> => {
  const records = await db.adminUsers.list();
  const merged = new Map<string, AdminUser>();
  for (const record of records) merged.set(record.id, toAdminUser(record));
  // Surface the development fallback accounts so the management UI is not
  // empty in a local, database-less environment.
  if (!isProd) {
    await initPasswords();
    for (const user of DEFAULT_USERS) {
      if (!merged.has(user.id)) merged.set(user.id, user);
    }
  }
  return Array.from(merged.values());
};

export const createAdminAccount = async (input: {
  username: string;
  password: string;
  role: AdminUser["role"];
  permissions?: Partial<PermissionSet>;
}): Promise<AdminUser> => {
  const existing = await db.adminUsers.findByUsername(input.username);
  if (existing) throw new Error(`Admin "${input.username}" already exists.`);

  const record: AdminUserRecord = {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    password_hash: await bcrypt.hash(input.password, 12),
    role: input.role,
    permissions: { ...rolePermissions(input.role), ...(input.permissions || {}) },
    is_active: true,
    mfa_enabled: false,
    mfa_secret: null,
    mfaEnabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const created = await db.adminUsers.create(record);
  return toAdminUser(created);
};

export const updateAdminAccount = async (
  id: string,
  input: {
    password?: string;
    role?: AdminUser["role"];
    isActive?: boolean;
    permissions?: Partial<PermissionSet>;
  }
): Promise<AdminUser | null> => {
  const existing = await db.adminUsers.findById(id);
  if (!existing) return null;

  const patch: Partial<AdminUserRecord> = {};
  if (input.password) patch.password_hash = await bcrypt.hash(input.password, 12);
  if (input.role) {
    patch.role = input.role;
    if (!input.permissions) patch.permissions = rolePermissions(input.role);
  }
  if (input.permissions) {
    patch.permissions = {
      ...normalizePermissions(existing.permissions as unknown as Record<string, unknown>, existing.role),
      ...input.permissions,
    };
  }
  if (typeof input.isActive === "boolean") patch.is_active = input.isActive;

  const updated = await db.adminUsers.update(id, patch);
  if (!updated) return null;

  // Disabling an account must take effect immediately (§16 acceptance).
  if (input.isActive === false) {
    await db.adminSessions.revokeAllForUser(id);
  }
  return toAdminUser(updated);
};

export const generateMfaSetup = (username: string): { secret: string; uri: string } => {
  const secret = generateTotpSecret();
  return { secret, uri: buildTotpUri(username, secret) };
};

export const enableMfa = async (userId: string, secret: string): Promise<boolean> => {
  const updated = await db.adminUsers.update(userId, { mfa_secret: secret, mfa_enabled: true });
  return !!updated;
};

export const disableMfa = async (userId: string): Promise<boolean> => {
  const updated = await db.adminUsers.update(userId, { mfa_secret: null, mfa_enabled: false });
  return !!updated;
};

export const getAdminRecord = (userId: string): Promise<AdminUserRecord | null> =>
  lookupAdminById(userId);
