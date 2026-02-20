// Cron Job: Genera resúmenes semanales para usuarios activos
// Se ejecuta domingos a las 10:00 UTC

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateScript, ARTICLES_BY_DURATION } from "@/lib/generate-script";
import { getUserInsights } from "@/lib/user-insights";
import { createLogger } from "@/lib/logger";

export const maxDuration = 60;

const log = createLogger("cron/weekly-digest");

const WEEKLY_SYSTEM_PROMPT_EXTRA = `

CONTEXTO ESPECIAL: Este es un RESUMEN SEMANAL, no un episodio diario normal.

ESTRUCTURA OBLIGATORIA:
1. Intro: "Esta semana en tu podcast..." con los highlights más importantes
2. Análisis profundo de las 3 noticias más relevantes de la semana
3. Conexiones entre noticias: patrones, tendencias, cómo se relacionan entre sí
4. Cierre: lo que viene la próxima semana, qué vigilar, preguntas abiertas

TONO: Más reflexivo y analítico que un episodio diario. Es un momento para hacer balance.`;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Get top 15 news of the week by relevance
    const { data: topNews } = await supabase
      .from("processed_news")
      .select("title, summary, category, relevance_score, url, source_name, published_at, keywords")
      .gte("processed_at", oneWeekAgo.toISOString())
      .order("relevance_score", { ascending: false })
      .limit(15);

    if (!topNews || topNews.length === 0) {
      log.info("No news found for weekly digest");
      return NextResponse.json({ success: true, usersProcessed: 0, episodesGenerated: 0 });
    }

    // 2. Get active users: have active schedule OR generated podcast in last 7 days
    const [{ data: scheduledUsers }, { data: recentUsers }] = await Promise.all([
      supabase
        .from("schedules")
        .select("user_id")
        .eq("is_active", true),
      supabase
        .from("episodes")
        .select("user_id")
        .gte("created_at", oneWeekAgo.toISOString()),
    ]);

    const activeUserIds = new Set<string>();
    scheduledUsers?.forEach((s) => activeUserIds.add(s.user_id));
    recentUsers?.forEach((e) => activeUserIds.add(e.user_id));

    if (activeUserIds.size === 0) {
      log.info("No active users for weekly digest");
      return NextResponse.json({ success: true, usersProcessed: 0, episodesGenerated: 0 });
    }

    let usersProcessed = 0;
    let episodesGenerated = 0;

    for (const userId of activeUserIds) {
      try {
        // Get user preferences
        const { data: prefs } = await supabase
          .from("preferences")
          .select("topics")
          .eq("user_id", userId)
          .single();

        if (!prefs?.topics?.length) continue;

        // Get user profile
        let profile: Record<string, string | null> | null = null;
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("nombre, rol, sector, edad, ciudad, nivel_conocimiento, objetivo_podcast, horario_escucha")
            .eq("id", userId)
            .single();
          if (profileData) profile = profileData as Record<string, string | null>;
        } catch {
          // ignore
        }

        // Get insights
        let insights: string | null = null;
        try {
          insights = await getUserInsights(userId, supabase);
        } catch {
          // ignore
        }

        // Format articles for generateScript
        const articles = topNews.map((n) => ({
          title: n.title,
          description: n.summary || "",
          source: n.source_name,
          url: n.url,
          publishedAt: n.published_at,
        }));

        // Limit articles to the expected count
        const maxArticles = ARTICLES_BY_DURATION[30] || 8;
        const selectedArticles = articles.slice(0, maxArticles);

        // Generate script with weekly digest system prompt
        const script = await generateScript(
          selectedArticles,
          30,
          "deep-dive",
          WEEKLY_SYSTEM_PROMPT_EXTRA,
          profile,
          insights
        );

        // Save episode with "weekly-digest" tag
        const weekTopics = [...prefs.topics, "weekly-digest"];
        const { data: episode } = await supabase
          .from("episodes")
          .insert({
            user_id: userId,
            title: `Resumen semanal — ${now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`,
            script,
            duration: 30,
            tone: "deep-dive",
            topics: weekTopics,
            articles: selectedArticles,
          })
          .select("id")
          .single();

        if (episode) episodesGenerated++;
        usersProcessed++;

        log.info(`Weekly digest generated for user ${userId}`);
      } catch (err) {
        log.error(`Error generating weekly digest for user ${userId}`, err);
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed,
      episodesGenerated,
    });
  } catch (err) {
    log.error("Error in weekly digest cron", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
