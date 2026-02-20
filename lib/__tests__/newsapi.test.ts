import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Set env var before import
process.env.GNEWS_API_KEY = "test-gnews-key";

import { fetchNews } from "../newsapi";

const originalFetch = globalThis.fetch;

function mockFetch(response: object, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchNews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps 'ia' topic to correct search terms", async () => {
    mockFetch({
      articles: [
        {
          title: "Test article",
          description: "Test desc",
          source: { name: "Test" },
          url: "https://example.com/1",
          publishedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    await fetchNews(["ia"]);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain("inteligencia+artificial");
  });

  it("filters articles without title", async () => {
    mockFetch({
      articles: [
        {
          title: "",
          description: "No title",
          source: { name: "Test" },
          url: "https://example.com/1",
          publishedAt: "2025-01-01T00:00:00Z",
        },
        {
          title: "Valid article",
          description: "Has title",
          source: { name: "Test" },
          url: "https://example.com/2",
          publishedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const result = await fetchNews(["ia"]);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Valid article");
  });

  it("filters articles without description", async () => {
    mockFetch({
      articles: [
        {
          title: "No desc article",
          description: null,
          source: { name: "Test" },
          url: "https://example.com/1",
          publishedAt: "2025-01-01T00:00:00Z",
        },
        {
          title: "Valid article",
          description: "Has description",
          source: { name: "Test" },
          url: "https://example.com/2",
          publishedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const result = await fetchNews(["ia"]);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Valid article");
  });

  it("throws on empty articles response", async () => {
    mockFetch({ articles: [] });

    await expect(fetchNews(["ia"])).rejects.toThrow(
      "No se encontraron noticias"
    );
  });

  it("throws on API error response", async () => {
    mockFetch({ errors: ["Rate limit exceeded"] }, false, 429);

    await expect(fetchNews(["ia"])).rejects.toThrow("Error de GNews");
  });

  it("handles all defined topic mappings", async () => {
    mockFetch({
      articles: [
        {
          title: "Test",
          description: "Test",
          source: { name: "T" },
          url: "https://example.com/1",
          publishedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    // Should not throw for any known topic
    const topics = [
      "ia", "ciberseguridad", "startups", "gadgets", "programacion",
      "espacio", "naturaleza-medioambiente", "neurociencia", "medicina",
      "emprendimiento", "marketing", "inversiones", "economia",
      "cine-series", "videojuegos", "musica", "comedia",
      "fitness", "nutricion", "salud-mental", "desarrollo-personal",
      "politica-actualidad", "historia", "filosofia", "educacion",
      "casos-reales", "paranormal", "conspiraciones", "criminologia",
      "viajes", "gastronomia", "deportes", "relaciones-familia",
    ];

    for (const topic of topics) {
      await expect(fetchNews([topic])).resolves.toBeDefined();
    }
  });
});
