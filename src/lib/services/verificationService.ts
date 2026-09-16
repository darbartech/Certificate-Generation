import crypto from "crypto";

export const generateVerificationToken = (length = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

export const getVerificationUrl = (token: string): string => {
  // Preferred: private VERIFY_URL (server-only, never exposed to the browser).
  // NEXT_PUBLIC_* variants kept as fallbacks for setups that declared them
  // before the private variable existed.
  const configured =
    process.env.VERIFY_URL ||
    process.env.NEXT_PUBLIC_VERIFY_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!configured) {
    // This is what produced certificates with a "localhost/verify" QR code and caption:
    // VERIFY_URL / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_VERIFY_URL were never set in the deployed .env,
    // so every render silently fell back to the local dev URL with no indication anything
    // was wrong. Fail loudly in production instead of baking a dead link into a PDF that
    // may get printed, emailed, or handed to a student.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "VERIFY_URL (or NEXT_PUBLIC_SITE_URL) is not set. Refusing to generate a " +
        "certificate with a localhost verification link in production. Set it in your .env."
      );
    }
    console.warn(
      "[verificationService] VERIFY_URL / NEXT_PUBLIC_SITE_URL not set — " +
      "falling back to http://localhost:3000 for this non-production render."
    );
  }

  const baseUrl = configured || "http://localhost:3000";
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/verify/${token}`;
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const verifyTokenIntegrity = (token: string): boolean => {
  if (!token || typeof token !== "string") return false;
  if (token.length < 16 || token.length > 128) return false;
  return /^[a-f0-9]+$/.test(token);
};
