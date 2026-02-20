import { describe, it, expect, vi } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getUserInsights } from "../user-insights";

function createMockSupabase(feedbacks: object[] | null, metrics: object[] | null) {
  const feedbackQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: feedbacks }),
  };

  const metricsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: metrics }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "episode_feedback") return feedbackQuery;
      if (table === "listening_metrics") return metricsQuery;
      return feedbackQuery;
    }),
  };
}

describe("getUserInsights", () => {
  it("returns null if there are fewer than 3 feedbacks", async () => {
    const supabase = createMockSupabase(
      [
        { rating: 5, tags: ["Buen ritmo"], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
        { rating: 1, tags: ["Muy largo"], comment: null, episodes: { topics: ["economia"], tone: "profesional" } },
      ],
      []
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getUserInsights("user-123", supabase as any);
    expect(result).toBeNull();
  });

  it("returns formatted string with 3+ feedbacks", async () => {
    const supabase = createMockSupabase(
      [
        { rating: 5, tags: ["Buen ritmo"], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
        { rating: 5, tags: ["Temas interesantes"], comment: null, episodes: { topics: ["startups"], tone: "casual" } },
        { rating: 1, tags: ["Muy largo"], comment: "Demasiado extenso", episodes: { topics: ["economia"], tone: "profesional" } },
        { rating: 5, tags: ["Buen ritmo"], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
      ],
      [
        { completion_rate: 0.8, playback_speed: 1.2 },
        { completion_rate: 0.6, playback_speed: 1.5 },
      ]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getUserInsights("user-123", supabase as any);
    expect(result).not.toBeNull();
    expect(result).toContain("HISTORIAL DE PREFERENCIAS DEL OYENTE");
  });

  it("includes positive and negative topics correctly", async () => {
    const supabase = createMockSupabase(
      [
        { rating: 5, tags: ["Buen ritmo"], comment: null, episodes: { topics: ["ia", "startups"], tone: "casual" } },
        { rating: 5, tags: ["Buen ritmo"], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
        { rating: 1, tags: ["Muy largo"], comment: null, episodes: { topics: ["economia"], tone: "profesional" } },
        { rating: 5, tags: null, comment: null, episodes: { topics: ["ciencia"], tone: "deep-dive" } },
      ],
      []
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getUserInsights("user-123", supabase as any);
    expect(result).toContain("valorados positivamente");
    expect(result).toContain("ia");
    expect(result).toContain("valorados negativamente");
    expect(result).toContain("economia");
  });

  it("includes average completion rate", async () => {
    const supabase = createMockSupabase(
      [
        { rating: 5, tags: [], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
        { rating: 5, tags: [], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
        { rating: 5, tags: [], comment: null, episodes: { topics: ["ia"], tone: "casual" } },
      ],
      [
        { completion_rate: 0.8, playback_speed: 1.0 },
        { completion_rate: 0.6, playback_speed: 1.0 },
      ]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getUserInsights("user-123", supabase as any);
    expect(result).toContain("Tasa media de escucha completa: 70%");
  });
});
