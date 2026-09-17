import crypto from "crypto";
import { db } from "@/lib/database";
import type { CertificateEvent, AuditOutboxRecord } from "@/lib/types";

export type EventType = CertificateEvent["event_type"];

export type EventContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

// V2 §11: lifecycle events that must never silently disappear.
const CRITICAL_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "ISSUING",
  "ISSUED",
  "ISSUE_FAILED",
  "REVOKED",
  "SUPERSEDED",
  "REISSUED",
]);

const MAX_CHAIN_RETRIES = 3;

type BuiltEvent = CertificateEvent & {
  certificate_id: string;
  event_type: EventType;
  id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  metadata_canonical: string;
  previous_event_hash: string | null;
  event_hash: string;
};

/**
 * Tamper-evident audit chain (DARBARTECH_CERTIFICATE_PRODUCTION_HARDENING §50-51).
 *
 * Each event records a SHA-256 hash of its own canonical fields chained to the
 * previous event's hash:
 *
 *   event_hash = sha256(id | certificate_id | event_type | actor_id | created_at
 *                       | JSON(metadata) | previous_event_hash)
 *
 * Any post-hoc modification of an earlier event breaks every later hash, making
 * silent tampering detectable during an integrity audit.
 */
const hashChainEvent = (parts: {
  id: string;
  certificate_id: string;
  event_type: string;
  actor_id: string;
  created_at: string;
  metadata: string;
  previous_event_hash: string;
}): string => {
  const canonical = [
    parts.id,
    parts.certificate_id,
    parts.event_type,
    parts.actor_id,
    parts.created_at,
    parts.metadata,
    parts.previous_event_hash,
  ].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
};

const buildEvent = (
  certificateId: string,
  eventType: EventType,
  actorId: string | undefined,
  metadata: Record<string, unknown> | undefined,
  ctx: EventContext | undefined,
  previousHash: string | null
): BuiltEvent => {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const enrichedMetadata = {
    ...(metadata || {}),
    ...(ctx?.ip ? { ip: String(ctx.ip).slice(0, 64) } : {}),
    ...(ctx?.userAgent ? { userAgent: String(ctx.userAgent).slice(0, 256) } : {}),
  };
  // The exact text is hashed and retained: jsonb does not preserve key order.
  const metadata_canonical = JSON.stringify(enrichedMetadata);

  const event_hash = hashChainEvent({
    id,
    certificate_id: certificateId,
    event_type: eventType,
    actor_id: actorId || "",
    created_at,
    metadata: metadata_canonical,
    previous_event_hash: previousHash || "",
  });

  return {
    id,
    certificate_id: certificateId,
    event_type: eventType,
    actor_id: actorId || null,
    metadata: enrichedMetadata,
    metadata_canonical,
    created_at,
    previous_event_hash: previousHash,
    event_hash,
    request_id: ctx?.requestId || null,
  };
};

const toCertificateEvent = (built: BuiltEvent): CertificateEvent => ({ ...built });

/**
 * Appends one event, serializing on the certificate's audit head (§10). On a
 * lost race the real predecessor is returned and the event is re-chained and
 * retried. If the append cannot complete at all, critical events are enqueued
 * to the durable outbox (§11) instead of being dropped.
 */
export const logEvent = async (
  certificateId: string,
  eventType: EventType,
  actorId?: string,
  metadata?: Record<string, unknown>,
  ctx?: EventContext
): Promise<CertificateEvent> => {
  const prior = await db.certificateEvents.findByCertificateId(certificateId);
  let previousHash = prior[0]?.event_hash ?? null;
  let lastBuilt: BuiltEvent | null = null;

  for (let attempt = 0; attempt < MAX_CHAIN_RETRIES; attempt++) {
    const built = buildEvent(certificateId, eventType, actorId, metadata, ctx, previousHash);
    lastBuilt = built;
    try {
      const result = await db.certificateEvents.appendWithHead(built);
      if (result.ok) return toCertificateEvent(built);
      // Lost the race: re-chain against the observed predecessor and retry.
      previousHash = result.previousEventHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[auditService] Failed to append ${eventType} for ${certificateId}: ${message}`);
      // T-B8: outbox insert uses independent error scope so chain-append failure does not prevent outbox durability.
      try {
        await enqueueForRetry(built, message);
      } catch {
        // enqueueForRetry already catches internally; belt-and-suspenders guard at call site.
      }
      return toCertificateEvent(built);
    }
  }

  const reason = "audit chain append retries exhausted";
  console.error(`[auditService] ${reason} for ${certificateId} (${eventType})`);
  // T-B8: outbox insert uses independent error scope so chain-append failure does not prevent outbox durability.
  if (lastBuilt) {
    try {
      await enqueueForRetry(lastBuilt, reason);
    } catch {
      // enqueueForRetry already catches internally; belt-and-suspenders guard at call site.
    }
  }
  return toCertificateEvent(lastBuilt!);
};

const enqueueForRetry = async (built: BuiltEvent, error: string): Promise<void> => {
  if (!CRITICAL_EVENT_TYPES.has(built.event_type)) return;
  try {
    await db.auditOutbox.enqueue({
      id: built.id,
      certificate_id: built.certificate_id,
      event_type: built.event_type,
      payload: built as unknown as Record<string, unknown>,
    });
    console.error(
      `[auditService] Enqueued critical ${built.event_type} for ${built.certificate_id} to durable outbox (${error}).`
    );
  } catch (enqueueErr) {
    console.error(
      `[auditService] CRITICAL: could not enqueue ${built.event_type} for ${built.certificate_id}: ${
        enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)
      }`
    );
  }
};

/**
 * V2 §11 background processor: drains outboxed critical events into the chain.
 * Idempotent — a row is only marked processed once its event is appended.
 */
export const processAuditOutbox = async (
  limit = 50
): Promise<{ processed: number; failed: number; pending: number }> => {
  const rows = await db.auditOutbox.listPending(limit);
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = (row as AuditOutboxRecord).payload as unknown as BuiltEvent | undefined;
    if (!payload || !payload.id) {
      await db.auditOutbox.markFailed(row.id, "outbox payload missing event id");
      failed++;
      continue;
    }
    try {
      const result = await db.certificateEvents.appendWithHead(payload);
      if (result.ok) {
        await db.auditOutbox.markProcessed(row.id);
        processed++;
        continue;
      }
      // Conflict: rebuild deterministically against the real predecessor.
      const rebuilt = buildEvent(
        payload.certificate_id,
        payload.event_type,
        payload.actor_id || undefined,
        payload.metadata,
        { requestId: payload.request_id || undefined },
        result.previousEventHash
      );
      const retry = await db.certificateEvents.appendWithHead(rebuilt);
      if (retry.ok) {
        await db.auditOutbox.markProcessed(row.id);
        processed++;
      } else {
        await db.auditOutbox.markFailed(row.id, "chain conflict could not be resolved");
        failed++;
      }
    } catch (err) {
      await db.auditOutbox.markFailed(
        row.id,
        err instanceof Error ? err.message : String(err)
      );
      failed++;
    }
  }

  return { processed, failed, pending: rows.length - processed };
};

/**
 * Verifies the hashes in a certificate's event chain from oldest to newest.
 * Returns true when every event's stored event_hash matches a recomputation
 * over its stored fields and the previous link. Mismatches indicate tampering.
 */
export const verifyAuditChain = async (certificateId: string): Promise<boolean> => {
  const events = (await db.certificateEvents.findByCertificateId(certificateId)).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let previousHash: string | null = null;
  for (const event of events) {
    const expected = hashChainEvent({
      id: event.id,
      certificate_id: event.certificate_id,
      event_type: event.event_type,
      actor_id: event.actor_id || "",
      created_at: event.created_at,
      metadata: event.metadata_canonical ?? JSON.stringify(event.metadata || {}),
      previous_event_hash: previousHash || "",
    });
    if (!event.event_hash || event.event_hash !== expected) return false;
    previousHash = event.event_hash;
  }
  return true;
};

export const getAuditTrail = async (certificateId: string): Promise<CertificateEvent[]> => {
  return db.certificateEvents.findByCertificateId(certificateId);
};

export const eventTypeLabels: Record<EventType, string> = {
  CREATED: "Certificate Created",
  PREVIEW_GENERATED: "Preview Generated",
  ISSUING: "Issuance Started",
  ISSUE_FAILED: "Issuance Failed",
  ISSUED: "Certificate Issued",
  RECOVERED: "Issuance Recovered",
  REVIEW_REQUIRED: "Manual Review Required",
  DOWNLOADED: "Certificate Downloaded",
  VERIFIED: "Certificate Verified",
  SUPERSEDED: "Certificate Superseded",
  REVOKED: "Certificate Revoked",
  REISSUED: "Certificate Reissued",
};