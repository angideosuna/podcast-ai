// GET /api/trending — returns today's trending topics (public, cached 1h)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("trending_topics")
    .select("topic, score, article_count, category")
    .eq("date", today)
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Error fetching trending" }, { status: 500 });
  }

  return NextResponse.json(
    { trending: data || [] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600",
      },
    }
  );
}
