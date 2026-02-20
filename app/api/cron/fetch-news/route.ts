import { NextRequest, NextResponse } from "next/server";
import { runFetchNews } from "@/src/agents/news-agent/scripts/fetch-core";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFetchNews();
    return NextResponse.json({
      success: result.success,
      articlesFound: result.articlesFound,
      sources: result.sourcesOk,
    });
  } catch (err) {
    console.error("[cron/fetch-news] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
