import { NextRequest, NextResponse } from "next/server";
import { runCleanup } from "@/src/agents/news-agent/scripts/cleanup-core";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCleanup();
    return NextResponse.json({
      success: result.success,
      deletedProcessed: result.deletedProcessed,
      deletedRawProcessed: result.deletedRawProcessed,
      deletedRawOld: result.deletedRawOld,
      totalDeleted: result.totalDeleted,
    });
  } catch (err) {
    console.error("[cron/cleanup] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
