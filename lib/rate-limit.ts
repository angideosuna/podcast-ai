// Rate limiter with Vercel KV (persistent) and in-memory fallback

import { kv } from "@vercel/kv";

// In-memory fallback store
const memoryStore = new Map<string, { count: number; expiry: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

async function rateLimitWithKV(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSeconds);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  } catch {
    // Fallback to memory if KV fails or is not configured
    return rateLimitInMemory(key, limit, windowSeconds);
  }
}

function rateLimitInMemory(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.expiry < now) {
    memoryStore.set(key, { count: 1, expiry: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
  };
}

/**
 * Check rate limit for a given IP + route combination.
 * Uses Vercel KV for persistent limiting, falls back to memory.
 */
export async function checkRateLimit(
  key: string,
  config: { maxRequests: number; windowSeconds: number }
): Promise<RateLimitResult> {
  return rateLimitWithKV(key, config.maxRequests, config.windowSeconds);
}

/** Extract client IP from request (works on Vercel and local) */
export function getClientIP(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
