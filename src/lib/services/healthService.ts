import Redis from "ioredis";
import { supabaseAdmin } from "@/lib/database/supabase";
import { pingDatabase } from "@/lib/database";
import storageService from "@/lib/services/storageService";

export type ComponentStatus = "ok" | "unavailable" | "not_configured" | "memory";

export type ReadinessReport = {
  status: "ready" | "degraded";
  database: ComponentStatus;
  redis: ComponentStatus;
  storage: ComponentStatus;
  config: { ok: boolean; missing: string[] };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

let redisProbe: Redis | null = null;
let redisProbeUrl: string | undefined;

const checkRedis = async (): Promise<ComponentStatus> => {
  const url = process.env.REDIS_URL;
  if (!url) return "not_configured";
  try {
    if (!redisProbe || redisProbeUrl !== url) {
      redisProbe?.disconnect();
      redisProbe = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      redisProbe.on("error", () => {});
      redisProbeUrl = url;
    }
    if (redisProbe.status === "wait" || redisProbe.status === "end") {
      await redisProbe.connect();
    }
    const pong = await withTimeout(redisProbe.ping(), 1500);
    return pong === "PONG" ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  }
};

const checkStorage = async (): Promise<ComponentStatus> => {
  if (!storageService.isConfigured || !supabaseAdmin) return "not_configured";
  try {
    const { error } = await withTimeout(
      supabaseAdmin.storage.getBucket(storageService.storageBucket),
      2000
    );
    return error ? "unavailable" : "ok";
  } catch {
    return "unavailable";
  }
};

const checkConfig = (): { ok: boolean; missing: string[] } => {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
};

// V2 §38: readiness only. Never includes secrets or connection strings.
export const getReadiness = async (): Promise<ReadinessReport> => {
  const [database, redis, storage] = await Promise.all([
    pingDatabase(),
    checkRedis(),
    checkStorage(),
  ]);
  const config = checkConfig();

  const isProd = process.env.NODE_ENV === "production";
  // In production an in-memory database or a missing bucket is NOT ready: it
  // means issued certificates would not be durable.
  const databaseOk = database === "ok" || (database === "memory" && !isProd);
  const storageOk = storage === "ok" || (storage === "not_configured" && !isProd);
  const status: ReadinessReport["status"] =
    databaseOk && redis !== "unavailable" && storageOk && config.ok ? "ready" : "degraded";

  return { status, database, redis, storage, config };
};
