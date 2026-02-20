import { NextRequest, NextResponse } from "next/server";
import { runProcessNews } from "@/src/agents/news-agent/scripts/process-core";
import { invalidateCache } from "@/lib/news-cache";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runProcessNews();

    // Invalidate article cache so next podcast uses fresh news
    invalidateCache();

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      duplicates: result.duplicates,
    });
  } catch (err) {
    console.error("[cron/process-news] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
