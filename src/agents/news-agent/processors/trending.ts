// Trending topics processor
// Aggregates keywords from recent processed_news and upserts into trending_topics

import { createLogger } from "@/lib/logger";
import { getClient } from "../storage/supabase";

const log = createLogger("agent:trending");

export async function updateTrendingTopics(): Promise<number> {
  const db = getClient();

  // 1. Get processed news from the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews, error: fetchError } = await db
    .from("processed_news")
    .select("keywords, relevance_score, category")
    .gte("published_at", since);

  if (fetchError) {
    log.error("Error fetching recent processed news", fetchError.message);
    return 0;
  }

  if (!recentNews || recentNews.length === 0) {
    log.info("No recent processed news for trending");
    return 0;
  }

  // 2. Aggregate by keyword
  const keywordMap = new Map<
    string,
    { count: number; totalRelevance: number; category: string }
  >();

  for (const article of recentNews) {
    const keywords: string[] = article.keywords || [];
    for (const keyword of keywords) {
      const normalized = keyword.toLowerCase().trim();
      if (!normalized || normalized.length < 2) continue;

      const existing = keywordMap.get(normalized) || {
        count: 0,
        totalRelevance: 0,
        category: "",
      };
      existing.count++;
      existing.totalRelevance += Number(article.relevance_score) || 0;
      if (!existing.category && article.category) {
        existing.category = article.category;
      }
      keywordMap.set(normalized, existing);
    }
  }

  if (keywordMap.size === 0) {
    log.info("No keywords found in recent news");
    return 0;
  }

  // 3. Calculate score: count * avgRelevance, take top 20
  const scored = [...keywordMap.entries()]
    .map(([topic, data]) => ({
      topic,
      score: data.count * (data.totalRelevance / data.count),
      article_count: data.count,
      category: data.category || null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // 4. Upsert into trending_topics with today's date
  const today = new Date().toISOString().split("T")[0];
  const rows = scored.map((item) => ({
    topic: item.topic,
    score: Math.round(item.score * 100) / 100,
    article_count: item.article_count,
    category: item.category,
    date: today,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await db
    .from("trending_topics")
    .upsert(rows, { onConflict: "topic,date" });

  if (upsertError) {
    log.error("Error upserting trending topics", upsertError.message);
    return 0;
  }

  // 5. Cleanup: delete trending_topics older than 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const { error: cleanupError } = await db
    .from("trending_topics")
    .delete()
    .lt("date", weekAgo);

  if (cleanupError) {
    log.warn("Error cleaning old trending topics", cleanupError.message);
  }

  log.info(`Trending topics updated: ${rows.length} topics for ${today}`);
  return rows.length;
}
