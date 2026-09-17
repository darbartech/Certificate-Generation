import Redis from "ioredis";

// V2 §18: distributed login throttling. Attempt counters and lockout stamps
// live in Redis so they are enforced consistently across every app instance
// (an in-process Map cannot do this). When Redis is configured but unreachable
// we fail closed: attempts are still counted, but against a stricter local
// threshold on the instance, so a Redis outage cannot be used to brute-force
// accounts.

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5; // normal, Redis-backed threshold
const STRICT_MAX_ATTEMPTS = 3; // fail-closed threshold when Redis is unavailable
const KEY_PREFIX = "login:";

type LocalState = {
  count: number;
  windowStart: number;
  lockedUntil: number;
};

// Pin to globalThis so every route bundle in the process shares the fallback
// state (see inMemoryDb.ts for the same Next.js dev rationale).
const globalForLoginThrottle = globalThis as unknown as {
  __darbartechLoginThrottle?: Map<string, LocalState>;
};
const localAttempts: Map<string, LocalState> =
  globalForLoginThrottle.__darbartechLoginThrottle ?? new Map<string, LocalState>();
globalForLoginThrottle.__darbartechLoginThrottle = localAttempts;

const normalize = (value: string): string =>
  (value || "").trim().toLowerCase().slice(0, 128);

let client: Redis | null = null;
let unavailableUntil = 0;

const getClient = (): Redis | null => {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => (times > 3 ? null : 100 * times),
  });
  client.on("error", () => {
    // Errors surface at the call site; mark Redis unavailable briefly so a dead
    // instance isn't hammered on every attempt.
    unavailableUntil = Date.now() + 15_000;
  });
  return client;
};

export type LoginThrottleState = { locked: boolean; retryAfterMs: number };

const userKey = (username: string): string => `${KEY_PREFIX}user:${normalize(username)}`;
const ipKey = (ip: string): string => `${KEY_PREFIX}ip:${normalize(ip)}`;

const localCheck = (key: string): LoginThrottleState => {
  const state = localAttempts.get(key);
  if (!state) return { locked: false, retryAfterMs: 0 };
  if (state.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMs: state.lockedUntil - Date.now() };
  }
  return { locked: false, retryAfterMs: 0 };
};

const localRecord = (key: string): void => {
  const now = Date.now();
  const threshold = process.env.REDIS_URL ? STRICT_MAX_ATTEMPTS : MAX_ATTEMPTS;
  const existing = localAttempts.get(key);
  const state: LocalState =
    existing && now - existing.windowStart < WINDOW_MS
      ? existing
      : { count: 0, windowStart: now, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= threshold) {
    state.lockedUntil = now + LOCKOUT_MS;
    state.count = 0;
    state.windowStart = now;
  }
  localAttempts.set(key, state);
};

const bump = async (redis: Redis, key: string, threshold: number): Promise<void> => {
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, WINDOW_MS);
  if (count >= threshold) {
    await redis.set(`${key}:lock`, "1", "PX", LOCKOUT_MS);
    await redis.del(key);
  }
};

export const checkLoginThrottle = async (
  username: string,
  ip: string
): Promise<LoginThrottleState> => {
  const redis = getClient();
  if (redis && Date.now() > unavailableUntil) {
    try {
      const userLock = await redis.pttl(`${userKey(username)}:lock`);
      if (userLock > 0) return { locked: true, retryAfterMs: userLock };
      const ipLock = await redis.pttl(`${ipKey(ip)}:lock`);
      if (ipLock > 0) return { locked: true, retryAfterMs: ipLock };
      return { locked: false, retryAfterMs: 0 };
    } catch (err) {
      console.error("[login-throttle] Redis unavailable; using stricter local lockout.", err);
      unavailableUntil = Date.now() + 15_000;
    }
  }
  return localCheck(userKey(username));
};

export const recordLoginFailure = async (username: string, ip: string): Promise<void> => {
  const redis = getClient();
  if (redis && Date.now() > unavailableUntil) {
    try {
      await bump(redis, userKey(username), MAX_ATTEMPTS);
      // The per-IP counter is intentionally looser: many legitimate users may
      // share a NAT egress IP, so it only trips on sustained abuse.
      await bump(redis, ipKey(ip), MAX_ATTEMPTS * 4);
      return;
    } catch (err) {
      console.error("[login-throttle] Redis unavailable; recording failure locally.", err);
      unavailableUntil = Date.now() + 15_000;
    }
  }
  localRecord(userKey(username));
};

export const clearLoginThrottle = async (username: string): Promise<void> => {
  const key = userKey(username);
  const redis = getClient();
  if (redis && Date.now() > unavailableUntil) {
    try {
      await redis.del(key, `${key}:lock`);
      return;
    } catch {
      unavailableUntil = Date.now() + 15_000;
    }
  }
  localAttempts.delete(key);
};
