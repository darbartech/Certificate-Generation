import crypto from "crypto";
import { getVerifyBaseUrl } from "@/lib/config/env";

export const generateVerificationToken = (length = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Builds the canonical public verification URL:
 *
 *   <VERIFY_BASE_URL>/verify/<token>
 *
 * VERIFY_BASE_URL must be the site ROOT (no trailing "/verify") — see
 * src/lib/config/env.ts. The legacy VERIFY_URL / NEXT_PUBLIC_* variables are
 * accepted as fallbacks and any "/verify" suffix is stripped so we can never
 * produce a broken "…/verify/verify/<token>" link (hardening finding P0-01).
 */
export const getVerificationUrl = (token: string): string => {
  const base = getVerifyBaseUrl();
  return `${base}/verify/${encodeURIComponent(token)}`;
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const verifyTokenIntegrity = (token: string): boolean => {
  if (!token || typeof token !== "string") return false;
  if (token.length < 16 || token.length > 128) return false;
  return /^[a-f0-9]+$/.test(token);
};
