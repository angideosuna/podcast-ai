"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById } from "@/lib/topics";
import { Headphones, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import type { EpisodeSummary } from "@/lib/types";

export default function HistorialPage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEpisodes() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("episodes")
        .select("id, title, topics, duration, tone, audio_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setEpisodes(data);
      setLoading(false);
    }

    loadEpisodes();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-stone-100 px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Historial de episodios</h1>
          <p className="mt-1 text-stone-500">
            {episodes.length === 0
              ? "Aun no tienes episodios"
              : `${episodes.length} ${episodes.length === 1 ? "episodio" : "episodios"} generados`}
          </p>
        </div>

        {episodes.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="text-4xl mb-4">🎙️</div>
            <p className="mb-4 text-stone-500">
              Genera tu primer podcast para empezar el historial
            </p>
            <button
              onClick={() => router.push("/podcast")}
              className="cursor-pointer rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              Generar podcast
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {episodes.map((episode) => (
              <li key={episode.id}>
                <Link
                  href={`/historial/${episode.id}`}
                  className="group flex items-start justify-between rounded-2xl border border-stone-200 bg-white px-5 py-4 transition-colors hover:border-stone-300 hover:bg-stone-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800 group-hover:text-stone-900">
                      {episode.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
                      {new Date(episode.created_at).toLocaleDateString(
                        "es-ES",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}{" "}
                      · {episode.duration} min · {episode.tone}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {episode.topics.map((topicId) => {
                        const topic = getTopicById(topicId);
                        return (
                          <span
                            key={topicId}
                            className="rounded-full bg-stone-800/8 px-2.5 py-0.5 text-xs text-stone-900"
                          >
                            {topic
                              ? `${topic.emoji} ${topic.nombre}`
                              : topicId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {episode.audio_url ? (
                    <Headphones className="ml-4 mt-1 h-5 w-5 shrink-0 text-stone-900" />
                  ) : (
                    <Clock className="ml-4 mt-1 h-5 w-5 shrink-0 text-stone-400" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
