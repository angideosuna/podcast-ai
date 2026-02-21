import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test both dev and prod modes, so we'll re-import the module
// after changing NODE_ENV. Use dynamic import to reset module state.

// Helper to set NODE_ENV (readonly in Next.js types, but writable at runtime)
function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setNodeEnv(originalEnv!);
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe("development mode", () => {
    it("outputs colored text with context and timestamp", async () => {
      setNodeEnv("development");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test-module");
      log.info("hello world");

      expect(console.log).toHaveBeenCalledTimes(1);
      const output = vi.mocked(console.log).mock.calls[0][0] as string;
      expect(output).toContain("[INFO]");
      expect(output).toContain("[test-module]");
      expect(output).toContain("hello world");
    });

    it("shows debug messages in development", async () => {
      setNodeEnv("development");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.debug("debug msg");

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it("routes warn to console.warn", async () => {
      setNodeEnv("development");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.warn("warning");

      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("routes error to console.error", async () => {
      setNodeEnv("development");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.error("failure");

      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("production mode", () => {
    it("outputs valid JSON", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("api/podcast");
      log.info("episode generated");

      expect(console.log).toHaveBeenCalledTimes(1);
      const output = vi.mocked(console.log).mock.calls[0][0] as string;

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("info");
      expect(parsed.context).toBe("api/podcast");
      expect(parsed.message).toBe("episode generated");
      expect(parsed.timestamp).toBeDefined();
    });

    it("serializes Error objects with name, message, and stack", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      const err = new Error("something broke");
      log.error("failure", err);

      const output = vi.mocked(console.error).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data.name).toBe("Error");
      expect(parsed.data.message).toBe("something broke");
      expect(parsed.data.stack).toBeDefined();
    });

    it("includes arbitrary data in the data field", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.info("metrics", { duration: 150, articles: 5 });

      const output = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data).toEqual({ duration: 150, articles: 5 });
    });

    it("suppresses debug messages in production", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.debug("should not appear");

      expect(console.log).not.toHaveBeenCalled();
    });

    it("routes error level to console.error", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.error("critical issue");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.log).not.toHaveBeenCalled();
    });

    it("routes warn level to console.warn", async () => {
      setNodeEnv("production");
      const { createLogger } = await import("@/lib/logger");

      const log = createLogger("test");
      log.warn("slow query");

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
