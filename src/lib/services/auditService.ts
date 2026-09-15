import { db } from "@/lib/database";
import type { CertificateEvent } from "@/lib/types";

export type EventType = CertificateEvent["event_type"];

export const logEvent = async (
  certificateId: string,
  eventType: EventType,
  actorId?: string,
  metadata?: Record<string, unknown>
): Promise<CertificateEvent> => {
  return db.certificateEvents.create({
    certificate_id: certificateId,
    event_type: eventType,
    actor_id: actorId || null,
    metadata: metadata || undefined,
  });
};

export const getAuditTrail = async (certificateId: string): Promise<CertificateEvent[]> => {
  return db.certificateEvents.findByCertificateId(certificateId);
};

export const eventTypeLabels: Record<EventType, string> = {
  CREATED: "Certificate Created",
  PREVIEW_GENERATED: "Preview Generated",
  ISSUED: "Certificate Issued",
  DOWNLOADED: "Certificate Downloaded",
  VERIFIED: "Certificate Verified",
  REVOKED: "Certificate Revoked",
  REISSUED: "Certificate Reissued",
};
