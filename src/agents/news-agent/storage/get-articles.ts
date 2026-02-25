// Smart article selection for podcast generation
// Pipeline: candidates → topic diversity → source diversity → keyword dedup → surprise → story grouping

import { getClient } from "./supabase";
import { createLogger } from "@/lib/logger";
import { TOPIC_TO_CATEGORIES } from "@/lib/topics";
import { ARTICLES_BY_DURATION } from "@/lib/generate-script";
import { getCachedArticles, setCachedArticles } from "@/lib/news-cache";
import type { Article } from "@/lib/types";
import type { ProcessedNewsItem } from "../utils/types";

const log = createLogger("agent:get-articles");

const MAX_PER_SOURCE = 2;
const KEYWORD_OVERLAP_THRESHOLD = 0.5;

/**
 * Smart article selection for podcast generation.
 *
 * A. Fetch 3x candidates from processed_news (48h, by relevance)
 * B. Guarantee at least 1 article per user topic
 * C. Enforce max 2 articles per source
 * D. Remove articles with >50% keyword overlap
 * E. Add 1 surprise article outside user categories (if space)
 * F. Group by story_id with related_articles
 */
export async function fetchFromAgent(
  topics: string[],
  duration: number = 15
): Promise<Article[]> {
  const needed = ARTICLES_BY_DURATION[duration] || 5;

  // Resolve unique categories from user subtopics
  const categories = [
    ...new Set(topics.flatMap((t) => TOPIC_TO_CATEGORIES[t] ?? [])),
  ];

  if (categories.length === 0) {
    log.warn(`Sin mapeo de categorías para topics: ${topics.join(", ")}`);
    return [];
  }

  // Cache key includes duration
  const cacheKey = `smart-${categories.sort().join(",")}-${duration}-${new Date().toISOString().slice(0, 13)}`;
  const cached = getCachedArticles(cacheKey);
  if (cached) {
    log.info(`Cache hit (${cacheKey}): ${cached.length} artículos`);
    return cached;
  }

  log.info(
    `Selección inteligente — ${needed} noticias para ${duration}min, categorías: ${categories.join(", ")}`
  );

  const db = getClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // ── Paso A: Traer candidatos + sorpresa en paralelo ──

  const [candidatesRes, surpriseRes] = await Promise.all([
    db
      .from("processed_news")
      .select("*")
      .in("category", categories)
      .gte("processed_at", since)
      .order("relevance_score", { ascending: false })
      .limit(needed * 3),
    db
      .from("processed_news")
      .select("*")
      .not("category", "in", `(${categories.join(",")})`)
      .gte("processed_at", since)
      .gte("relevance_score", 8)
      .order("relevance_score", { ascending: false })
      .limit(5),
  ]);

  if (candidatesRes.error) {
    log.error("Error consultando processed_news", candidatesRes.error.message);
    return [];
  }

  const candidates = candidatesRes.data as ProcessedNewsItem[];
  const surprisePool = (surpriseRes.data ?? []) as ProcessedNewsItem[];
  log.info(`  A: ${candidates.length} candidatos (límite ${needed * 3}), ${surprisePool.length} sorpresa pool`);

  if (candidates.length === 0) return [];

  // ── Selection state ──

  const selected: ProcessedNewsItem[] = [];
  const usedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();

  function isValid(c: ProcessedNewsItem): boolean {
    if (usedIds.has(c.id!)) return false;
    if ((sourceCounts.get(c.source_name) || 0) >= MAX_PER_SOURCE) return false;
    for (const existing of selected) {
      if (c.keywords?.length && existing.keywords?.length) {
        if (keywordOverlap(c.keywords, existing.keywords) > KEYWORD_OVERLAP_THRESHOLD) return false;
      }
    }
    return true;
  }

  function addItem(item: ProcessedNewsItem): void {
    selected.push(item);
    usedIds.add(item.id!);
    sourceCounts.set(item.source_name, (sourceCounts.get(item.source_name) || 0) + 1);
  }

  // ── Paso B: 1 noticia top por cada topic del usuario ──

  const topicCategoryMap = new Map<string, Set<string>>();
  for (const topic of topics) {
    const cats = TOPIC_TO_CATEGORIES[topic] ?? [];
    if (cats.length > 0) topicCategoryMap.set(topic, new Set(cats));
  }

  for (const [topic, cats] of topicCategoryMap) {
    if (selected.length >= needed) break;
    const match = candidates.find((c) => cats.has(c.category) && isValid(c));
    if (match) {
      addItem(match);
      log.info(`  B: "${topic}" → "${match.title.slice(0, 60)}" (score ${match.relevance_score}, ${match.source_name})`);
    }
  }

  // ── Paso C+D: Rellenar con las más relevantes (source + keyword checks built into isValid) ──

  for (const candidate of candidates) {
    if (selected.length >= needed) break;
    if (isValid(candidate)) {
      addItem(candidate);
    }
  }

  log.info(`  B-D: ${selected.length}/${needed} tras diversidad de temas, fuentes y keywords`);

  // ── Paso E: Noticia sorpresa (si queda espacio, usa pool pre-cargado) ──

  if (selected.length < needed && surprisePool.length > 0) {
    const pick = surprisePool.find((s) => {
      const count = sourceCounts.get(s.source_name) || 0;
      return count < MAX_PER_SOURCE && !usedIds.has(s.id!);
    });
    if (pick) {
      addItem(pick);
      log.info(`  E: sorpresa — "${pick.title.slice(0, 60)}" (${pick.category}, score ${pick.relevance_score}, ${pick.source_name})`);
    }
  }

  log.info(`  E: ${selected.length} noticias finales`);

  // ── Paso F: Agrupar por story_id ──

  const articles = groupByStoryId(selected);

  log.info(`Selección completa: ${articles.length} artículos para podcast de ${duration}min`);

  setCachedArticles(cacheKey, articles);
  return articles;
}

/** Keyword overlap ratio: shared / min(|A|, |B|) */
function keywordOverlap(a: string[], b: string[]): number {
  const setA = new Set(a.map((k) => k.toLowerCase()));
  const setB = new Set(b.map((k) => k.toLowerCase()));
  let shared = 0;
  for (const k of setA) {
    if (setB.has(k)) shared++;
  }
  const minSize = Math.min(setA.size, setB.size);
  return minSize === 0 ? 0 : shared / minSize;
}

/** Groups selected articles by story_id. Main article gets related_articles. */
function groupByStoryId(items: ProcessedNewsItem[]): Article[] {
  const storyGroups = new Map<string, ProcessedNewsItem[]>();
  const standalone: ProcessedNewsItem[] = [];

  for (const item of items) {
    if (item.story_id && item.story_id !== "uncategorized") {
      const group = storyGroups.get(item.story_id);
      if (group) {
        group.push(item);
      } else {
        storyGroups.set(item.story_id, [item]);
      }
    } else {
      standalone.push(item);
    }
  }

  const result: Article[] = [];

  // Story groups: highest relevance is main, rest are related
  for (const [storyId, group] of storyGroups) {
    group.sort((a, b) => b.relevance_score - a.relevance_score);
    const main = group[0];
    const related = group.slice(1);

    const article: Article = {
      title: main.title,
      description: main.summary,
      source: main.source_name,
      url: main.url,
      publishedAt: main.published_at ?? new Date().toISOString(),
      sentiment: main.sentiment,
      impact_scope: main.impact_scope,
      category: main.category,
      keywords: main.keywords,
    };

    if (related.length > 0) {
      article.related_articles = related.map((r) => ({
        title: r.title,
        summary: r.summary,
      }));
      log.info(`  F: story "${storyId}" → 1 principal + ${related.length} relacionadas`);
    }

    result.push(article);
  }

  // Standalone articles
  for (const item of standalone) {
    result.push({
      title: item.title,
      description: item.summary,
      source: item.source_name,
      url: item.url,
      publishedAt: item.published_at ?? new Date().toISOString(),
      sentiment: item.sentiment,
      impact_scope: item.impact_scope,
      category: item.category,
      keywords: item.keywords,
    });
  }

  return result;
}
