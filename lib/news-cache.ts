// In-memory cache with TTL for news articles

import type { Article } from "@/lib/types";

const cache = new Map<string, { articles: Article[]; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getCachedArticles(cacheKey: string): Article[] | null {
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.articles;
  if (cached) cache.delete(cacheKey); // Clean expired
  return null;
}

export function setCachedArticles(cacheKey: string, articles: Article[]): void {
  cache.set(cacheKey, { articles, expiry: Date.now() + CACHE_TTL });
}

export function invalidateCache(): void {
  cache.clear();
}
