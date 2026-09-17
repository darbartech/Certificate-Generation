import crypto from "crypto";

// ---------------------------------------------------------------------------
// Production environment contract (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING §6)
// ---------------------------------------------------------------------------
// The server must fail fast on invalid production configuration instead of
// discovering a missing secret at certificate-issuance time. This module is
// the single source of truth for that contract.
//
// NOTE: This is intentionally NOT asserted at module-import time, because
// `next build` also runs with NODE_ENV=production in CI and would otherwise
// fail the build wherever secrets are absent. It is asserted lazily from the
// request path (auth middleware, login, verification, issuance) so that a
// misconfigured deployment fails on first request — before anyone can issue.

const isProd = process.env.NODE_ENV === "production";

const estimateShannonEntropy = (s: string): number => {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let entropy = 0;
  const len = s.length;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
};

export const REQUIRED_PRODUCTION_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERIFY_BASE_URL",
  "ADMIN_SESSION_SECRET",
  "CERTIFICATE_STORAGE_BUCKET",
  "REDIS_URL",
] as const;

export type ConfigIssue = { name: string; required: boolean; message: string };

export const validateProductionConfig = (): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];

  for (const name of REQUIRED_PRODUCTION_VARS) {
    const raw = process.env[name] || "";
    if (!raw.trim()) {
      issues.push({
        name,
        required: true,
        message: `Required environment variable "${name}" is not set in production.`,
      });
      continue;
    }
    if (name === "ADMIN_SESSION_SECRET") {
      const adminSessionSecret = raw.trim();
      if (adminSessionSecret.length < 32) {
        issues.push({
          name,
          required: true,
          message: "ADMIN_SESSION_SECRET must be at least 32 characters long.",
        });
      } else {
        const entropyPerChar = estimateShannonEntropy(adminSessionSecret);
        const totalEntropyBits = adminSessionSecret.length * entropyPerChar;
        if (entropyPerChar < 3.5 || totalEntropyBits < 128) {
          const msg = `ADMIN_SESSION_SECRET fails entropy requirements (entropy=${entropyPerChar.toFixed(2)} bits/char, total=${totalEntropyBits.toFixed(0)} bits, required >=3.5 bits/char AND >=128 total bits). Use a 32+ character random string from a password manager.`;
          console.error("[env] PRODUCTION CONFIG FAIL:", msg);
          issues.push({
            name,
            required: true,
            message: "PRODUCTION CONFIG ERROR: ADMIN_SESSION_SECRET entropy insufficient — see server logs",
          });
        }
      }
    }
    if (name === "VERIFY_BASE_URL" && /\/verify(\/|$)/i.test(raw)) {
      issues.push({
        name,
        required: true,
        message:
          "VERIFY_BASE_URL must be the site root WITHOUT a trailing /verify " +
          "(e.g. https://www.darbartech.com). The app appends /verify/<token>. " +
          "A trailing /verify produces broken /verify/verify/... links.",
      });
    }
  }

  return issues;
};

export const assertProductionConfig = (): void => {
  if (!isProd) return;
  const issues = validateProductionConfig();
  const required = issues.filter((i) => i.required);
  if (required.length === 0) return;

  const detail = required.map((i) => `  - ${i.name}: ${i.message}`).join("\n");
  throw new Error(
    `Production configuration is invalid. Refusing to run issuance until fixed.\n${detail}`
  );
};

export const getConfigWarnings = (): string[] => {
  if (!isProd) return [];
  return validateProductionConfig()
    .filter((i) => !i.required)
    .map((i) => `[config] ${i.message}`);
};

// Canonical verification base URL (server-only). Prefers VERIFY_BASE_URL; the
// legacy VERIFY_URL / NEXT_PUBLIC_* variants are stripped of any /verify suffix
// and used as fallbacks so earlier deployments keep working while migrating.
export const getVerifyBaseUrl = (): string => {
  const candidates = [
    process.env.VERIFY_BASE_URL,
    process.env.VERIFY_URL,
    process.env.NEXT_PUBLIC_VERIFY_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter((v): v is string => !!v && v.trim().length > 0);

  const normalize = (raw: string): string => {
    let base = raw.replace(/\/+$/, "");
    base = base.replace(/\/verify$/i, "");
    return base;
  };

  const base = candidates.length > 0 ? normalize(candidates[0]) : "";

  if (!base) {
    if (isProd) {
      throw new Error(
        "VERIFY_BASE_URL (or VERIFY_URL / NEXT_PUBLIC_SITE_URL) is not set. " +
          "Refusing to generate a certificate with a broken verification link in production."
      );
    }
    return "http://localhost:3000";
  }
  return base;
};

// A short-lived, cryptographically random request ID used across API logs,
// audit metadata and error responses for support correlation.
export const generateRequestId = (): string => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 8);
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `REQ-${stamp}-${rand}`;
};