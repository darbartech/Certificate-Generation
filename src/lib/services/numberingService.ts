import { db } from "@/lib/database";

export const CERTIFICATE_PREFIX = process.env.CERTIFICATE_PREFIX || "DT-CERT";

export const generateCertificateNumber = async (
  issueDate: string,
  manualNumber?: string
): Promise<string> => {
  if (manualNumber) {
    const existing = await db.certificates.findByNumber(manualNumber);
    if (existing) {
      throw new Error(`Certificate number ${manualNumber} already exists`);
    }
    return manualNumber;
  }

  const year = new Date(issueDate).getFullYear();
  const sequenceNum = await db.numbering.nextNumber(CERTIFICATE_PREFIX, year);
  const padded = sequenceNum.toString().padStart(5, "0");
  return `${CERTIFICATE_PREFIX}-${year}-${padded}`;
};

export const validateCertificateNumberFormat = (number: string): boolean => {
  const pattern = new RegExp(`^${CERTIFICATE_PREFIX}-\\d{4}-\\d{5}$`);
  return pattern.test(number);
};

export const STUDENT_ID_PREFIX = process.env.STUDENT_ID_PREFIX || "DT-STU";

/**
 * Auto-generates a unique, sequential Student ID (e.g. "DT-STU-2026-0001").
 *
 * Admins never type this in — it is assigned server-side at issuance so the
 * sequence isn't burned by abandoned drafts/previews (same reasoning as
 * certificate numbers, see generateCertificateNumber above).
 *
 * `existingStudentId` lets a reissue reuse the ID that was already assigned
 * to this recipient at original issuance instead of minting a new one — the
 * same student keeps the same Student ID across a reissued certificate.
 */
export const generateStudentId = async (
  issueDate: string,
  existingStudentId?: string
): Promise<string> => {
  if (existingStudentId && existingStudentId.trim()) {
    return existingStudentId.trim();
  }

  const year = new Date(issueDate).getFullYear();
  const sequenceNum = await db.numbering.nextNumber(STUDENT_ID_PREFIX, year);
  const padded = sequenceNum.toString().padStart(4, "0");
  return `${STUDENT_ID_PREFIX}-${year}-${padded}`;
};

export const validateStudentIdFormat = (studentId: string): boolean => {
  const pattern = new RegExp(`^${STUDENT_ID_PREFIX}-\\d{4}-\\d{4}$`);
  return pattern.test(studentId);
};
