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

function makeItem(title: string, description?: string, id?: string): RawNewsItem {
  return {
    id: id || Math.random().toString(36).slice(2),
    source_id: "test-source",
    source_name: "Test Source",
    source_type: "rss",
    title,
    description: description ?? "Test description",
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
  it("detects duplicates with >70% word overlap in title", async () => {
    const items = [
      makeItem("Apple presenta nuevo iPhone con inteligencia artificial avanzada"),
      makeItem("Apple presenta nuevo iPhone con tecnologia inteligencia artificial avanzada"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("does NOT mark as duplicate with <70% title overlap", async () => {
    const items = [
      makeItem("La IA revoluciona la medicina"),
      makeItem("Nuevo avance en física cuántica"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(2);
  });

  it("detects duplicates by description overlap >60%", async () => {
    const items = [
      makeItem("Titular totalmente diferente A",
        "El gobierno español aprueba nuevas medidas económicas para combatir la inflación en el país"),
      makeItem("Titular totalmente diferente B",
        "El gobierno español aprueba nuevas medidas económicas para combatir la inflación nacional"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("keeps the item with longer description on duplicate", async () => {
    const items = [
      makeItem("Apple presenta iPhone nuevo", "Descripción corta"),
      makeItem("Apple presenta iPhone nuevo y revolucionario", "Descripción mucho más larga y completa con más detalles sobre el producto"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
    expect(result[0].description).toContain("mucho más larga");
  });

  it("normalizes accents correctly", async () => {
    const items = [
      makeItem("Tecnología avanzada en España"),
      makeItem("Tecnologia avanzada en Espana"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("ignores case differences", async () => {
    const items = [
      makeItem("BREAKING NEWS sobre inteligencia artificial"),
      makeItem("breaking news sobre inteligencia artificial"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("removes punctuation for comparison", async () => {
    const items = [
      makeItem("¡Hola, mundo! ¿Qué tal?"),
      makeItem("Hola mundo Que tal"),
    ];
    const result = await deduplicate(items);
    expect(result.length).toBe(1);
  });

  it("filters out stopwords for better matching", async () => {
    const items = [
      makeItem("El presidente de España anuncia las nuevas reformas"),
      makeItem("Presidente España anuncia nuevas reformas económicas"),
    ];
    const result = await deduplicate(items);
    // Without stopwords these are very similar
    expect(result.length).toBe(1);
  });

  it("returns empty array for empty input", async () => {
    const result = await deduplicate([]);
    expect(result).toEqual([]);
  });

  it("returns single item unchanged", async () => {
    const item = makeItem("Noticia única sobre tecnología");
    const result = await deduplicate([item]);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Noticia única sobre tecnología");
  });

  it("works without supabase client (skips cross-temporal)", async () => {
    const items = [
      makeItem("Noticia sobre inteligencia artificial"),
      makeItem("Otra noticia diferente sobre economía"),
    ];
    // No supabase client passed — should still work
    const result = await deduplicate(items);
    expect(result.length).toBe(2);
  });
});
