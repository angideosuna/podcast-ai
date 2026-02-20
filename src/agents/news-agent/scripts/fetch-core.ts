// Core logic for fetching news — used by both CLI and API route

import { NewsAgent } from "../index";

export interface FetchNewsResult {
  success: boolean;
  articlesFound: number;
  sourcesOk: number;
  sourcesTotal: number;
  details: {
    source_name: string;
    success: boolean;
    items: number;
    duration_ms?: number;
    error?: string;
  }[];
}

export async function runFetchNews(): Promise<FetchNewsResult> {
  const agent = new NewsAgent();
  const results = await agent.fetchAll();

  const articlesFound = results.reduce((sum, r) => sum + r.items.length, 0);
  const sourcesOk = results.filter((r) => r.success).length;

  return {
    success: true,
    articlesFound,
    sourcesOk,
    sourcesTotal: results.length,
    details: results.map((r) => ({
      source_name: r.source_name,
      success: r.success,
      items: r.items.length,
      duration_ms: r.duration_ms,
      error: r.error,
    })),
  };
}
