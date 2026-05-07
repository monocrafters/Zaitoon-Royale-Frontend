export type SessionCacheEnvelope<T> = {
  v: T;
  ts: number;
};

export function readSessionCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;

    // New format: { v, ts }
    if (parsed && typeof parsed === "object" && "ts" in (parsed as any) && "v" in (parsed as any)) {
      const env = parsed as SessionCacheEnvelope<T>;
      if (typeof env.ts !== "number") return null;
      if (Date.now() - env.ts > ttlMs) return null;
      return env.v ?? null;
    }

    // Legacy format: raw value without timestamp (treat as fresh and migrate)
    const legacyValue = parsed as T;
    if (typeof legacyValue !== "undefined" && legacyValue !== null) {
      writeSessionCache(key, legacyValue);
      return legacyValue;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  const envelope: SessionCacheEnvelope<T> = { v: value, ts: Date.now() };
  window.sessionStorage.setItem(key, JSON.stringify(envelope));
}

