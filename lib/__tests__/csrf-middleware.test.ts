import { describe, it, expect } from "vitest";
import { shouldBlockRequest, isAllowedOrigin } from "@/lib/csrf";

describe("isAllowedOrigin", () => {
  it("allows same host", () => {
    expect(isAllowedOrigin("podcast.example.com", "https://podcast.example.com")).toBe(true);
  });

  it("allows null origin (server-to-server)", () => {
    expect(isAllowedOrigin("podcast.example.com", null)).toBe(true);
  });

  it("blocks different host", () => {
    expect(isAllowedOrigin("podcast.example.com", "https://evil.com")).toBe(false);
  });

  it("blocks malformed origin", () => {
    expect(isAllowedOrigin("podcast.example.com", "not-a-valid-url")).toBe(false);
  });

  it("blocks subdomain mismatch", () => {
    expect(isAllowedOrigin("podcast.example.com", "https://evil.podcast.example.com")).toBe(false);
  });

  it("allows same localhost with port", () => {
    expect(isAllowedOrigin("localhost:3000", "http://localhost:3000")).toBe(true);
  });

  it("blocks different port on localhost", () => {
    expect(isAllowedOrigin("localhost:3000", "http://localhost:4000")).toBe(false);
  });
});

describe("shouldBlockRequest", () => {
  const host = "podcast.example.com";
  const sameOrigin = "https://podcast.example.com";
  const crossOrigin = "https://evil.com";

  describe("allows legitimate requests", () => {
    it("allows same-origin POST to /api/", () => {
      expect(shouldBlockRequest("/api/generate-podcast", "POST", host, sameOrigin)).toBe(false);
    });

    it("allows POST without Origin header", () => {
      expect(shouldBlockRequest("/api/generate-podcast", "POST", host, null)).toBe(false);
    });

    it("allows GET regardless of origin", () => {
      expect(shouldBlockRequest("/api/trending", "GET", host, crossOrigin)).toBe(false);
    });

    it("allows same-origin PUT", () => {
      expect(shouldBlockRequest("/api/preferences", "PUT", host, sameOrigin)).toBe(false);
    });

    it("allows same-origin DELETE", () => {
      expect(shouldBlockRequest("/api/share", "DELETE", host, sameOrigin)).toBe(false);
    });

    it("does not block non-API paths", () => {
      expect(shouldBlockRequest("/login", "POST", host, crossOrigin)).toBe(false);
    });
  });

  describe("blocks cross-origin mutating requests", () => {
    it("blocks cross-origin POST", () => {
      expect(shouldBlockRequest("/api/generate-podcast", "POST", host, crossOrigin)).toBe(true);
    });

    it("blocks cross-origin PUT", () => {
      expect(shouldBlockRequest("/api/preferences", "PUT", host, "https://attacker.io")).toBe(true);
    });

    it("blocks cross-origin PATCH", () => {
      expect(shouldBlockRequest("/api/profile", "PATCH", host, "https://phishing.net")).toBe(true);
    });

    it("blocks cross-origin DELETE", () => {
      expect(shouldBlockRequest("/api/share", "DELETE", host, "https://malicious.org")).toBe(true);
    });

    it("blocks malformed Origin on POST", () => {
      expect(shouldBlockRequest("/api/feedback", "POST", host, "not-a-valid-url")).toBe(true);
    });

    it("blocks subdomain mismatch on POST", () => {
      expect(shouldBlockRequest("/api/generate-podcast", "POST", host, "https://evil.podcast.example.com")).toBe(true);
    });
  });
});
