import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { AdminUser } from "@/lib/types";

export type { AdminUser } from "@/lib/types";

const isProd = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Session secret
// ---------------------------------------------------------------------------
// Session tokens are HMAC-signed with this secret so they cannot be forged
// or modified by a client. It must be set (32+ chars) in production.

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    if (isProd) {
      throw new Error("ADMIN_SESSION_SECRET must be set in production.");
    }
    console.warn(
      "[auth] ADMIN_SESSION_SECRET is not set. Using an insecure development-only " +
        "secret. Set ADMIN_SESSION_SECRET in your environment before deploying."
    );
    return "dev-only-insecure-secret-do-not-use-in-production";
  }

  if (secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters long.");
  }

  return secret;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
// NOTE: These are placeholder accounts backed by env-provided passwords.
// Replace this with a real `admins` table (see 001_certificate_system_schema.sql)
// once you're ready to manage admins dynamically instead of via env vars.

const DEFAULT_USERS: AdminUser[] = [
  {
    id: "user-super-admin",
    username: "admin",
    role: "super_admin",
    permissions: {
      create: true,
      preview: true,
      issue: true,
      revoke: true,
      download: true,
      manageTemplates: true,
    },
  },
  {
    id: "user-admin",
    username: "staff",
    role: "staff",
    permissions: {
      create: true,
      preview: true,
      issue: true,
      revoke: false,
      download: true,
      manageTemplates: false,
    },
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

// A hash of a random value, used so failed logins for unknown usernames take
// the same amount of time as failed logins for known usernames. Without this,
// response timing would leak which usernames exist.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);

// ---------------------------------------------------------------------------
// Login attempt tracking / lockout
// ---------------------------------------------------------------------------
// In-memory only: resets on server restart and is per-instance. Fine for a
// single-instance deployment; move to Supabase/Redis if you scale to
// multiple instances.

type AttemptState = { count: number; lockedUntil: number | null };
const loginAttempts = new Map<string, AttemptState>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function attemptKey(username: string): string {
  return username.trim().toLowerCase();
}

function isLockedOut(username: string): boolean {
  const state = loginAttempts.get(attemptKey(username));
  return !!state?.lockedUntil && state.lockedUntil > Date.now();
}

function recordFailedAttempt(username: string): void {
  const key = attemptKey(username);
  const state = loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
  const count = state.count + 1;
  loginAttempts.set(key, {
    count,
    lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null,
  });
}

function clearAttempts(username: string): void {
  loginAttempts.delete(attemptKey(username));
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const authenticateAdmin = async (
  username: string,
  password: string
): Promise<AdminUser | null> => {
  await initPasswords();

  const user = DEFAULT_USERS.find((u) => u.username === username);

  // Always compare against *some* bcrypt hash, even for unknown usernames or
  // locked-out accounts, so the response time doesn't reveal which case
  // occurred (prevents username enumeration via timing).
  const hash = user ? PASSWORD_HASHES[user.username] : DUMMY_HASH;
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid || isLockedOut(username)) {
    recordFailedAttempt(username);
    return null;
  }

  clearAttempts(username);
  return user;
};

// ---------------------------------------------------------------------------
// Session tokens (HMAC-signed — cannot be forged or tampered with)
// ---------------------------------------------------------------------------
// Format: base64url(payloadJson) + "." + base64url(hmacSha256Signature)

function sign(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export const generateSessionToken = (user: AdminUser): string => {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    expires: Date.now() + 1000 * 60 * 60 * 8, // 8 hours
  });

  const encodedPayload = Buffer.from(payload, "utf-8").toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const parseSessionToken = (token: string): AdminUser | null => {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const expectedSignature = sign(encodedPayload);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    // Reject mismatched lengths before timingSafeEqual (it throws on unequal
    // lengths), then do a constant-time comparison of the signature itself.
    if (provided.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(provided, expected)) return null;

    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    if (typeof decoded.expires !== "number" || decoded.expires < Date.now()) return null;

    const user = DEFAULT_USERS.find(
      (u) => u.id === decoded.id && u.username === decoded.username
    );
    return user || null;
  } catch {
    return null;
  }
};

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
