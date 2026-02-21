import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared mock for messages.create
const mockCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "# Guion fake del podcast\n\nContenido de prueba." }],
});

// Mock Anthropic SDK as a class constructor
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock retry to avoid real delays but preserve retry behavior
vi.mock("@/lib/retry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/retry")>("@/lib/retry");
  return {
    ...actual,
    withRetry: async (fn: () => Promise<unknown>, options?: { maxRetries?: number }) => {
      const maxRetries = options?.maxRetries ?? 3;
      let lastError: unknown;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (i === maxRetries || !actual.isTransientError(err)) throw err;
        }
      }
      throw lastError;
    },
  };
});

// Set env var before import
process.env.ANTHROPIC_API_KEY = "test-key";

import { generateScript, ARTICLES_BY_DURATION } from "../generate-script";
import type { Article } from "@/lib/types";

function makeArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Noticia de prueba ${i + 1}`,
    description: `Descripción de la noticia ${i + 1} con contenido relevante.`,
    source: `Fuente ${i + 1}`,
    url: `https://example.com/news-${i + 1}`,
    publishedAt: new Date().toISOString(),
  }));
}

describe("ARTICLES_BY_DURATION", () => {
  it("returns 5 articles for 15 min", () => {
    expect(ARTICLES_BY_DURATION[15]).toBe(5);
  });

  it("returns 8 articles for 30 min", () => {
    expect(ARTICLES_BY_DURATION[30]).toBe(8);
  });

  it("returns 12 articles for 60 min", () => {
    expect(ARTICLES_BY_DURATION[60]).toBe(12);
  });
});

describe("generateScript", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("includes PERFIL DEL OYENTE when profile is provided", async () => {
    const articles = makeArticles(5);
    const profile = { nombre: "Juan", rol: "CTO", sector: "Tech", edad: "30", ciudad: "Madrid", nivel_conocimiento: null, objetivo_podcast: null, horario_escucha: null };

    await generateScript(articles, 15, "casual", undefined, profile);

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;

    expect(userContent).toContain("PERFIL DEL OYENTE");
    expect(userContent).toContain("Juan");
  });

  it("does NOT include PERFIL DEL OYENTE when profile is null", async () => {
    const articles = makeArticles(5);

    await generateScript(articles, 15, "casual", undefined, null);

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;

    expect(userContent).not.toContain("PERFIL DEL OYENTE");
  });

  it("includes article titles in the prompt", async () => {
    const articles = makeArticles(5);

    await generateScript(articles, 15, "casual");

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;

    expect(userContent).toContain("Noticia de prueba 1");
    expect(userContent).toContain("Noticia de prueba 2");
  });

  it("truncates articles to the correct count per duration", async () => {
    const articles = makeArticles(20);

    await generateScript(articles, 15, "casual");

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;

    // Should include articles 1-5 (ARTICLES_BY_DURATION[15] = 5)
    expect(userContent).toContain("Noticia de prueba 5");
    // Should NOT include article 6
    expect(userContent).not.toContain("NOTICIA 6:");
  });

  it("uses correct max_tokens for 15 min duration", async () => {
    const articles = makeArticles(5);

    await generateScript(articles, 15, "casual");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(8192);
  });

  it("uses correct max_tokens for 30 min duration", async () => {
    const articles = makeArticles(8);

    await generateScript(articles, 30, "profesional");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(12288);
  });

  it("uses correct max_tokens for 60 min duration", async () => {
    const articles = makeArticles(12);

    await generateScript(articles, 60, "deep-dive");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(16384);
  });

  it("includes adjustments in the prompt when provided", async () => {
    const articles = makeArticles(5);

    await generateScript(articles, 15, "casual", "Habla mas sobre IA");

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent).toContain("AJUSTES DEL USUARIO");
    expect(userContent).toContain("Habla mas sobre IA");
  });

  it("retries on transient error and succeeds", async () => {
    const articles = makeArticles(5);

    mockCreate
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Recovered script" }],
      });

    const result = await generateScript(articles, 15, "casual");
    expect(result).toBe("Recovered script");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-transient error (e.g. 401)", async () => {
    const articles = makeArticles(5);

    mockCreate.mockRejectedValue(new Error("Error 401: unauthorized"));

    await expect(generateScript(articles, 15, "casual")).rejects.toThrow("401");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws when Claude returns no text block", async () => {
    const articles = makeArticles(5);

    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "123" }],
    });

    await expect(generateScript(articles, 15, "casual")).rejects.toThrow(
      "No se recibió texto"
    );
  });
});
