import { describe, it, expect, vi } from "vitest";
import { withRetry, isTransientError } from "@/lib/retry";

describe("isTransientError", () => {
  it("returns true for AbortError (timeout)", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for network errors", () => {
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    expect(isTransientError(new Error("ECONNRESET"))).toBe(true);
    expect(isTransientError(new Error("network error"))).toBe(true);
  });

  it("returns true for 429 rate limit", () => {
    expect(isTransientError(new Error("Error 429: rate limited"))).toBe(true);
  });

  it("returns true for 500+ server errors", () => {
    expect(isTransientError(new Error("Error 500: internal server error"))).toBe(true);
    expect(isTransientError(new Error("Error 502: bad gateway"))).toBe(true);
    expect(isTransientError(new Error("Error 503: service unavailable"))).toBe(true);
  });

  it("returns true for overloaded errors", () => {
    expect(isTransientError(new Error("API is overloaded"))).toBe(true);
  });

  it("returns false for 400 bad request", () => {
    expect(isTransientError(new Error("Error 400: bad request"))).toBe(false);
  });

  it("returns false for 401 unauthorized", () => {
    expect(isTransientError(new Error("Error 401: unauthorized"))).toBe(false);
  });

  it("returns false for 403 forbidden", () => {
    expect(isTransientError(new Error("Error 403: forbidden"))).toBe(false);
  });

  it("returns false for API key errors", () => {
    expect(isTransientError(new Error("Invalid API key provided"))).toBe(false);
    expect(isTransientError(new Error("Authentication failed"))).toBe(false);
  });

  it("returns true for non-Error values", () => {
    expect(isTransientError("string error")).toBe(true);
    expect(isTransientError(null)).toBe(true);
    expect(isTransientError(undefined)).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("Error 503: unavailable"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 })
    ).rejects.toThrow("fetch failed");

    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on non-transient error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Error 401: unauthorized"));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })
    ).rejects.toThrow("401");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects custom isRetryable function", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("custom-retryable"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      isRetryable: (err) => err instanceof Error && err.message === "custom-retryable",
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects maxRetries: 0 (no retries)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 10 })
    ).rejects.toThrow("fetch failed");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff timing", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValue("ok");

    const start = Date.now();
    await withRetry(fn, { maxRetries: 2, baseDelayMs: 50, maxDelayMs: 500 });
    const elapsed = Date.now() - start;

    // First retry: ~50ms, second retry: ~100ms. Total >= 100ms with some tolerance
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
