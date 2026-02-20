// Agrega feedback y métricas del usuario para inyectar en el prompt de Claude

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger("user-insights");

const MIN_FEEDBACKS = 3;

export async function getUserInsights(
  userId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    // Fetch últimos 10 feedbacks con datos del episodio
    const { data: feedbacks } = await supabase
      .from("episode_feedback")
      .select("rating, tags, comment, episodes(topics, tone, duration)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!feedbacks || feedbacks.length < MIN_FEEDBACKS) {
      return null;
    }

    // Fetch métricas promedio
    const { data: metrics } = await supabase
      .from("listening_metrics")
      .select("completion_rate, playback_speed")
      .eq("user_id", userId);

    // Agregar feedbacks
    const positiveFeedbacks = feedbacks.filter((f) => f.rating === 5);
    const negativeFeedbacks = feedbacks.filter((f) => f.rating === 1);

    const lines: string[] = [];

    // Temas positivos
    if (positiveFeedbacks.length > 0) {
      const positiveTopics = new Set<string>();
      const positiveTones = new Set<string>();
      for (const f of positiveFeedbacks) {
        const ep = f.episodes as { topics?: string[]; tone?: string } | null;
        if (ep?.topics) ep.topics.forEach((t: string) => positiveTopics.add(t));
        if (ep?.tone) positiveTones.add(ep.tone);
      }
      const positiveTags = positiveFeedbacks.flatMap((f) => f.tags || []);
      if (positiveTopics.size > 0) {
        lines.push(`- Episodios valorados positivamente: temas sobre [${[...positiveTopics].slice(0, 5).join(", ")}], tono [${[...positiveTones].join(", ")}]`);
      }
      if (positiveTags.length > 0) {
        const tagCounts = new Map<string, number>();
        positiveTags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
        const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
        lines.push(`- Lo que más le gusta: ${topTags.join(", ")}`);
      }
    }

    // Temas negativos
    if (negativeFeedbacks.length > 0) {
      const negativeTopics = new Set<string>();
      for (const f of negativeFeedbacks) {
        const ep = f.episodes as { topics?: string[] } | null;
        if (ep?.topics) ep.topics.forEach((t: string) => negativeTopics.add(t));
      }
      const negativeTags = negativeFeedbacks.flatMap((f) => f.tags || []);
      const comments = negativeFeedbacks.map((f) => f.comment).filter(Boolean);
      let line = "";
      if (negativeTopics.size > 0) line += `temas sobre [${[...negativeTopics].slice(0, 3).join(", ")}]`;
      if (negativeTags.length > 0) line += `${line ? ", " : ""}feedback: "${negativeTags.slice(0, 3).join(", ")}"`;
      if (comments.length > 0) line += `${line ? ", " : ""}comentario: "${comments[0]}"`;
      if (line) lines.push(`- Episodios valorados negativamente: ${line}`);
    }

    // Métricas
    if (metrics && metrics.length > 0) {
      const avgCompletion = metrics.reduce((sum, m) => sum + Number(m.completion_rate), 0) / metrics.length;
      const avgSpeed = metrics.reduce((sum, m) => sum + Number(m.playback_speed), 0) / metrics.length;

      lines.push(`- Tasa media de escucha completa: ${Math.round(avgCompletion * 100)}%`);
      if (avgSpeed > 1.1) {
        lines.push(`- Velocidad habitual: ${avgSpeed.toFixed(1)}x (le gusta ritmo rápido)`);
      } else if (avgSpeed < 0.9) {
        lines.push(`- Velocidad habitual: ${avgSpeed.toFixed(1)}x (prefiere ritmo pausado)`);
      }
    }

    if (lines.length === 0) return null;

    return `## HISTORIAL DE PREFERENCIAS DEL OYENTE

${lines.join("\n")}
- Ajusta el contenido teniendo en cuenta estas preferencias.`;
  } catch (error) {
    log.warn("Error obteniendo user insights", error);
    return null;
  }
}
