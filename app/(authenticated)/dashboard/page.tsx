"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById } from "@/lib/topics";
import { Play, Headphones, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import type { EpisodeSummary } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ nombre: string | null } | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Cargar perfil, preferencias y episodios en paralelo
      const [profileRes, prefsRes, episodesRes] = await Promise.all([
        supabase.from("profiles").select("nombre").eq("id", user.id).single(),
        supabase
          .from("preferences")
          .select("id")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("episodes")
          .select("id, title, topics, duration, tone, audio_url, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setHasPreferences(!!prefsRes.data);
      if (episodesRes.data) setEpisodes(episodesRes.data);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  // Saludo contextual según hora del dia
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos dias";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    );
  }

  const greeting = getGreeting();
  const displayName = profile?.nombre || "Hola";

  // Comprobar si hay un episodio de hoy
  const today = new Date().toLocaleDateString("es-ES");
  const todayEpisode = episodes.find(
    (ep) => new Date(ep.created_at).toLocaleDateString("es-ES") === today
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-stone-100 px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Saludo */}
        <div>
          <h1 className="text-3xl font-bold">
            {greeting}, {displayName}
          </h1>
          <p className="mt-1 text-stone-500">
            {todayEpisode
              ? "Tu podcast de hoy esta listo"
              : "Genera tu podcast personalizado del dia"}
          </p>
        </div>

        {/* Episodio de hoy */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">
            🎙️ Episodio de hoy
          </h2>

          {todayEpisode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-stone-900">{todayEpisode.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {todayEpisode.topics.map((topicId) => {
                    const topic = getTopicById(topicId);
                    return (
                      <span
                        key={topicId}
                        className="rounded-full bg-stone-800/8 px-2.5 py-0.5 text-xs text-stone-900"
                      >
                        {topic ? `${topic.emoji} ${topic.nombre}` : topicId}
                      </span>
                    );
                  })}
                </div>
              </div>
              <Link
                href={`/historial/${todayEpisode.id}`}
                className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
              >
                <Play className="h-4 w-4" />
                Escuchar
              </Link>
            </div>
          ) : hasPreferences ? (
            <div className="text-center">
              <p className="mb-4 text-stone-500">
                Aun no has generado el podcast de hoy
              </p>
              <button
                onClick={() => router.push("/podcast")}
                className="cursor-pointer rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
              >
                🎙️ Generar podcast de hoy
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-stone-500">
                Configura tus preferencias para empezar
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                className="cursor-pointer rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
              >
                Configurar preferencias
              </button>
            </div>
          )}
        </div>

        {/* Ultimos episodios */}
        {episodes.length > 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-800">
                Ultimos episodios
              </h2>
              <Link
                href="/historial"
                className="text-sm text-stone-900 underline transition-colors hover:text-stone-700"
              >
                Ver todos →
              </Link>
            </div>
            <ul className="space-y-3">
              {episodes.map((episode) => (
                <li key={episode.id}>
                  <Link
                    href={`/historial/${episode.id}`}
                    className="group flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3 transition-colors hover:border-stone-300 hover:bg-stone-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-800 group-hover:text-stone-900">
                        {episode.title}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {new Date(episode.created_at).toLocaleDateString(
                          "es-ES",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          }
                        )}{" "}
                        · {episode.duration} min
                      </p>
                    </div>
                    {episode.audio_url ? (
                      <Headphones className="ml-3 h-4 w-4 shrink-0 text-stone-900" />
                    ) : (
                      <Clock className="ml-3 h-4 w-4 shrink-0 text-stone-400" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats */}
        {episodes.length > 0 && (
          <div className="flex gap-4">
            <div className="flex-1 rounded-2xl border border-stone-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-stone-900">{episodes.length}</p>
              <p className="text-xs text-stone-500">
                {episodes.length === 1 ? "episodio" : "episodios"}
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-stone-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-stone-900">
                {episodes.reduce((sum, ep) => sum + ep.duration, 0)}
              </p>
              <p className="text-xs text-stone-500">minutos generados</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
