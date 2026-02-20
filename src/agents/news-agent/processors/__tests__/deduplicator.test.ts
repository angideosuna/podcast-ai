import { describe, it, expect, vi } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { deduplicate } from "../deduplicator";
import type { RawNewsItem } from "../../utils/types";

function makeItem(title: string, id?: string): RawNewsItem {
  return {
    id: id || Math.random().toString(36).slice(2),
    source_id: "test-source",
    source_name: "Test Source",
    source_type: "rss",
    title,
    description: "Test description",
    content: null,
    url: `https://example.com/${Math.random().toString(36).slice(2)}`,
    image_url: null,
    author: null,
    language: "es",
    category: "technology",
    published_at: new Date().toISOString(),
  };
}

describe("deduplicate", () => {
  it("detects duplicates with >70% word overlap", () => {
    const items = [
      makeItem("Apple presenta nuevo iPhone con inteligencia artificial avanzada"),
      makeItem("Apple presenta nuevo iPhone con tecnologia inteligencia artificial avanzada"),
    ];
    const result = deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("does NOT mark as duplicate with <70% overlap", () => {
    const items = [
      makeItem("La IA revoluciona la medicina"),
      makeItem("Nuevo avance en física cuántica"),
    ];
    const result = deduplicate(items);
    expect(result.length).toBe(2);
  });

  it("normalizes accents correctly", () => {
    const items = [
      makeItem("Tecnología avanzada en España"),
      makeItem("Tecnologia avanzada en Espana"),
    ];
    const result = deduplicate(items);
    // After normalization both titles are identical → 1 item
    expect(result.length).toBe(1);
  });

  it("ignores case differences", () => {
    const items = [
      makeItem("BREAKING NEWS sobre inteligencia artificial"),
      makeItem("breaking news sobre inteligencia artificial"),
    ];
    const result = deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("removes punctuation for comparison", () => {
    const items = [
      makeItem("¡Hola, mundo! ¿Qué tal?"),
      makeItem("Hola mundo Que tal"),
    ];
    const result = deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("returns empty array for empty input", () => {
    const result = deduplicate([]);
    expect(result).toEqual([]);
  });

  it("returns single item unchanged", () => {
    const item = makeItem("Noticia única sobre tecnología");
    const result = deduplicate([item]);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Noticia única sobre tecnología");
  });
});
