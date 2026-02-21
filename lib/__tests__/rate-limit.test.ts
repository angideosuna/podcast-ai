import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Vercel KV to always fall back to in-memory
vi.mock("@vercel/kv", () => ({
  kv: {
    incr: vi.fn().mockRejectedValue(new Error("KV not configured")),
    expire: vi.fn(),
  },
}));

import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows first request", async () => {
    const result = await checkRateLimit("test-unique-key-1", {
      maxRequests: 5,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests up to limit", async () => {
    const key = "test-limit-key-" + Date.now();
    const config = { maxRequests: 3, windowSeconds: 60 };

    const r1 = await checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over limit", async () => {
    const key = "test-block-key-" + Date.now();
    const config = { maxRequests: 2, windowSeconds: 60 };

    await checkRateLimit(key, config);
    await checkRateLimit(key, config);

    const r3 = await checkRateLimit(key, config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("uses different counters per key", async () => {
    const config = { maxRequests: 1, windowSeconds: 60 };
    const suffix = Date.now();

    const r1 = await checkRateLimit(`key-a-${suffix}`, config);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(`key-b-${suffix}`, config);
    expect(r2.allowed).toBe(true);
  });
});

describe("getClientIP", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIP(request)).toBe("1.2.3.4");
  });

  it("extracts IP from x-real-ip header", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientIP(request)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const request = new Request("https://example.com");
    expect(getClientIP(request)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "5.6.7.8",
      },
    });
    expect(getClientIP(request)).toBe("1.2.3.4");
  });
});
