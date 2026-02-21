import { describe, it, expect } from "vitest";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

function makeRequest(
  url: string,
  method: string,
  origin?: string
): NextRequest {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new NextRequest(new URL(url, "https://podcast.example.com"), {
    method,
    headers,
  });
}

describe("CSRF middleware", () => {
  describe("allows legitimate requests", () => {
    it("allows same-origin POST", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/generate-podcast",
        "POST",
        "https://podcast.example.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("allows POST without Origin header (server-to-server)", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/generate-podcast",
        "POST"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("allows GET requests regardless of origin", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/trending",
        "GET",
        "https://evil.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("allows same-origin PUT", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/preferences",
        "PUT",
        "https://podcast.example.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("allows same-origin DELETE", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/share",
        "DELETE",
        "https://podcast.example.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe("blocks cross-origin mutating requests", () => {
    it("blocks POST from different origin", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/generate-podcast",
        "POST",
        "https://evil.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });

    it("blocks PUT from different origin", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/preferences",
        "PUT",
        "https://attacker.io"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });

    it("blocks PATCH from different origin", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/profile",
        "PATCH",
        "https://phishing.net"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });

    it("blocks DELETE from different origin", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/share",
        "DELETE",
        "https://malicious.org"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });

    it("blocks POST with malformed Origin header", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/feedback",
        "POST",
        "not-a-valid-url"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });

    it("blocks subdomain origin mismatch", () => {
      const req = makeRequest(
        "https://podcast.example.com/api/generate-podcast",
        "POST",
        "https://evil.podcast.example.com"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });
  });

  describe("localhost development", () => {
    it("allows same localhost origin", () => {
      const req = makeRequest(
        "http://localhost:3000/api/generate-podcast",
        "POST",
        "http://localhost:3000"
      );
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("blocks different port on localhost", () => {
      const req = makeRequest(
        "http://localhost:3000/api/generate-podcast",
        "POST",
        "http://localhost:4000"
      );
      const res = middleware(req);
      expect(res.status).toBe(403);
    });
  });
});
