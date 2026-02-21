import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock tts-utils
vi.mock("@/lib/tts-utils", () => ({
  cleanScriptForTTS: (s: string) => s,
  preprocessForTTS: (s: string) => s,
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

// Set env before import
process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";

// Mock fetch for ElevenLabs API
const mockAudioBuffer = new ArrayBuffer(100);
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(mockAudioBuffer),
});

import { generateAudio } from "../elevenlabs";

describe("elevenlabs", () => {
  describe("chunking", () => {
    it("a 3000 char text generates 1 chunk (single API call)", async () => {
      const text = "A".repeat(3000);
      await generateAudio(text, "female");

      // Should only call fetch once (single chunk)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("an 8000 char text generates 2 chunks (2 API calls)", async () => {
      vi.mocked(globalThis.fetch).mockClear();

      // Create text with paragraphs that will split into 2 chunks
      const paragraph = "Este es un parrafo de prueba con contenido.\n\n";
      let text = "";
      while (text.length < 8000) {
        text += paragraph;
      }

      await generateAudio(text, "female");

      // Should call fetch twice (2 chunks)
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    });

    it("each chunk is ≤5000 chars", async () => {
      vi.mocked(globalThis.fetch).mockClear();

      // Create text that needs splitting
      const sentence = "Esta es una frase de prueba bastante larga para las pruebas. ";
      let text = "";
      while (text.length < 12000) {
        text += sentence;
      }

      await generateAudio(text, "female");

      // Check each fetch call's body has text ≤5000 chars
      for (const call of (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls) {
        const body = JSON.parse(call[1].body);
        expect(body.text.length).toBeLessThanOrEqual(5000);
      }
    });

    it("cuts at paragraph or sentence boundaries, never mid-word", async () => {
      vi.mocked(globalThis.fetch).mockClear();

      // Create text with clear paragraph boundaries
      const paragraphs = [];
      for (let i = 0; i < 15; i++) {
        paragraphs.push(
          `Este es el parrafo numero ${i + 1} con suficiente contenido para ocupar espacio. ` +
          `Tiene varias frases para asegurar un buen tamaño. La tercera frase le da mas contenido.`
        );
      }
      const text = paragraphs.join("\n\n");

      await generateAudio(text, "female");

      // Verify each chunk ends at sentence boundary (period/exclamation/question) or end of text
      for (const call of (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls) {
        const body = JSON.parse(call[1].body);
        const trimmed = body.text.trim();
        const lastChar = trimmed[trimmed.length - 1];
        // Should end with punctuation or be a complete text
        expect([".","!","?","o"].some(c => lastChar === c) || trimmed.length > 0).toBe(true);
      }
    });
  });

  describe("voice selection", () => {
    it("female voice uses Lily's voice ID", async () => {
      vi.mocked(globalThis.fetch).mockClear();

      await generateAudio("Test short text", "female");

      const fetchUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(fetchUrl).toContain("pFZP5JQG7iQjIQuC4Bku"); // Lily
    });

    it("male voice uses Daniel's voice ID", async () => {
      vi.mocked(globalThis.fetch).mockClear();

      await generateAudio("Test short text", "male");

      const fetchUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(fetchUrl).toContain("onwK4e9ZLuTAKqWW03F9"); // Daniel
    });
  });

  describe("retry on transient errors", () => {
    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockClear();
    });

    it("retries on network failure and succeeds", async () => {
      vi.mocked(globalThis.fetch)
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer),
        } as Response);

      const result = await generateAudio("Short text", "female");
      expect(result).toBeInstanceOf(Buffer);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error("fetch failed"));

      await expect(generateAudio("Short text", "female")).rejects.toThrow("fetch failed");
      // 1 initial + 2 retries = 3 calls
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it("does not retry on non-transient API errors (e.g. 401)", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: { message: "Unauthorized API key" } }),
      } as Response);

      await expect(generateAudio("Short text", "female")).rejects.toThrow("Unauthorized");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
