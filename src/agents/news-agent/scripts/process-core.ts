// Core logic for processing news — used by both CLI and API route

import { NewsAgent } from "../index";

export interface ProcessNewsResult {
  success: boolean;
  processed: number;
  duplicates: number;
  details: {
    title: string;
    category: string;
    relevance_score: number;
  }[];
}

export async function runProcessNews(): Promise<ProcessNewsResult> {
  const agent = new NewsAgent();
  const config = agent.getConfig();

  const rawCount = config.processing.batch_size;
  const processed = await agent.processAll();

  // duplicates = batch_size - processed (the ones that were deduped or failed)
  const duplicates = Math.max(0, rawCount - processed.length);

  return {
    success: true,
    processed: processed.length,
    duplicates,
    details: processed.map((item) => ({
      title: item.title,
      category: item.category,
      relevance_score: item.relevance_score,
    })),
  };
}
