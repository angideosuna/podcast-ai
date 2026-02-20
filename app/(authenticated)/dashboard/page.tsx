"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById } from "@/lib/topics";
import { Play, Headphones, Clock, Loader2, TrendingUp, Download, X } from "lucide-react";
import Link from "next/link";
import type { EpisodeSummary } from "@/lib/types";

interface Schedule {
  time: string;
  frequency: string;
  custom_days: number[];
  is_active: boolean;
}

interface TrendingTopic {
  topic: string;
  score: number;
  article_count: number;
  category: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ nombre: string | null } | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA install prompt
  useEffect(() => {
    const dismissed = localStorage.getItem("podcast-ai-pwa-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as unknown as { prompt: () => void }).prompt();
    setShowInstallBanner(false);
    localStorage.setItem("podcast-ai-pwa-dismissed", "1");
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("podcast-ai-pwa-dismissed", "1");
  };

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

      // Cargar perfil, preferencias, episodios y schedule en paralelo
      const [profileRes, prefsRes, episodesRes, scheduleRes] = await Promise.all([
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
        supabase
          .from("schedules")
          .select("time, frequency, custom_days, is_active")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setHasPreferences(!!prefsRes.data);
      if (episodesRes.data) setEpisodes(episodesRes.data);
      if (scheduleRes.data) setSchedule(scheduleRes.data);

      // Fetch trending topics (no auth needed, non-blocking)
      try {
        const trendingRes = await fetch("/api/trending");
        if (trendingRes.ok) {
          const trendingData = await trendingRes.json();
          if (trendingData.trending?.length > 0) {
            setTrending(trendingData.trending.slice(0, 5));
          }
        }
      } catch {
        // Silencioso — trending es opcional
      }

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
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
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

  // Comprobar si hay un weekly digest reciente (últimos 7 días)
  const weeklyDigest = episodes.find(
    (ep) => ep.topics.includes("weekly-digest")
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-cream px-4 py-8 text-dark">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="glass-card flex items-center gap-3 p-4">
            <Download className="h-5 w-5 shrink-0 text-forest" />
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">
                Instala PodCast.ai en tu dispositivo
              </p>
              <p className="text-xs text-muted">
                Acceso rapido y experiencia nativa
              </p>
            </div>
            <button
              onClick={handleInstall}
              className="cursor-pointer rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:bg-forest-light"
            >
              Instalar
            </button>
            <button
              onClick={dismissInstall}
              className="cursor-pointer text-muted transition-colors hover:text-dark"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Saludo */}
        <div>
          <h1 className="text-3xl font-bold">
            {greeting}, {displayName}
          </h1>
          <p className="mt-1 text-muted">
            {todayEpisode
              ? "Tu podcast de hoy esta listo"
              : "Genera tu podcast personalizado del dia"}
          </p>
        </div>

        {/* Episodio de hoy */}
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-dark">
            🎙️ Episodio de hoy
          </h2>

          {todayEpisode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-dark">{todayEpisode.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {todayEpisode.topics.map((topicId) => {
                    const topic = getTopicById(topicId);
                    return (
                      <span
                        key={topicId}
                        className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs text-dark"
                      >
                        {topic ? `${topic.emoji} ${topic.nombre}` : topicId}
                      </span>
                    );
                  })}
                </div>
              </div>
              <Link
                href={`/historial/${todayEpisode.id}`}
                className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 font-medium text-white transition-all duration-300 hover:bg-forest-light"
              >
                <Play className="h-4 w-4" />
                Escuchar
              </Link>
            </div>
          ) : hasPreferences ? (
            <div className="text-center">
              <p className="mb-4 text-muted">
                Aun no has generado el podcast de hoy
              </p>
              <button
                onClick={() => router.push("/podcast")}
                className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light"
              >
                🎙️ Generar podcast de hoy
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-muted">
                Configura tus preferencias para empezar
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light"
              >
                Configurar preferencias
              </button>
            </div>
          )}
        </div>

        {/* Weekly Digest */}
        {weeklyDigest && !todayEpisode?.topics.includes("weekly-digest") && (
          <Link
            href={`/historial/${weeklyDigest.id}`}
            className="glass-card flex items-center gap-4 p-5 transition-all duration-300 hover:border-forest/20 hover:bg-forest/5"
          >
            <span className="text-3xl">📋</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-dark">Tu resumen de la semana está listo</p>
                <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-semibold text-forest">
                  Semanal
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted">{weeklyDigest.title}</p>
            </div>
            <Play className="h-4 w-4 shrink-0 text-forest" />
          </Link>
        )}

        {/* Horario automático */}
        {schedule?.is_active ? (
          <div className="glass-card flex items-center gap-3 p-4">
            <span className="text-2xl">📅</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">
                Tu próximo podcast: {schedule.frequency === "daily" ? "todos los días" : schedule.frequency === "weekdays" ? "lunes a viernes" : "días seleccionados"} a las {schedule.time.slice(0, 5)}
              </p>
              <p className="text-xs text-muted">Generación automática activada</p>
            </div>
            <Link
              href="/onboarding?step=2"
              className="text-xs text-forest underline transition-all duration-300 hover:text-forest-light"
            >
              Cambiar
            </Link>
          </div>
        ) : hasPreferences ? (
          <div className="glass-card flex items-center gap-3 p-4">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">
                Configura tu horario para recibir podcasts automáticos
              </p>
            </div>
            <Link
              href="/onboarding?step=2"
              className="rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:bg-forest-light"
            >
              Configurar
            </Link>
          </div>
        ) : null}

        {/* Ultimos episodios */}
        {episodes.length > 0 && (
          <div className="glass-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark">
                Ultimos episodios
              </h2>
              <Link
                href="/historial"
                className="text-sm text-dark underline transition-all duration-300 hover:text-forest"
              >
                Ver todos →
              </Link>
            </div>
            <ul className="space-y-3">
              {episodes.map((episode) => (
                <li key={episode.id}>
                  <Link
                    href={`/historial/${episode.id}`}
                    className="group flex items-center justify-between rounded-xl border border-white/30 px-4 py-3 transition-all duration-300 hover:border-forest/20 hover:bg-forest/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-dark group-hover:text-forest">
                        {episode.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-light">
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
                      <Headphones className="ml-3 h-4 w-4 shrink-0 text-dark" />
                    ) : (
                      <Clock className="ml-3 h-4 w-4 shrink-0 text-muted-light" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trending topics */}
        {trending.length > 0 && (
          <div className="glass-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-forest" />
              <h2 className="text-lg font-semibold text-dark">
                Trending hoy
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trending.map((t) => (
                <Link
                  key={t.topic}
                  href={`/podcast?trending=${encodeURIComponent(t.topic)}`}
                  className="rounded-full bg-forest/10 px-3 py-1.5 text-sm font-medium text-dark transition-all duration-300 hover:bg-forest/20 hover:text-forest"
                >
                  {t.topic}
                  <span className="ml-1 text-xs text-muted-light">
                    {t.article_count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {episodes.length > 0 && (
          <div className="flex gap-4">
            <div className="flex-1 glass-card p-4 text-center">
              <p className="text-2xl font-bold text-dark">{episodes.length}</p>
              <p className="text-xs text-muted">
                {episodes.length === 1 ? "episodio" : "episodios"}
              </p>
            </div>
            <div className="flex-1 glass-card p-4 text-center">
              <p className="text-2xl font-bold text-dark">
                {episodes.reduce((sum, ep) => sum + ep.duration, 0)}
              </p>
              <p className="text-xs text-muted">minutos generados</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
