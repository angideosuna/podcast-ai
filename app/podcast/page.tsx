"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { BrowserAudioPlayer } from "@/components/browser-audio-player";
import { AdjustEpisode } from "@/components/adjust-episode";
import { Loader2, Share2, Check } from "lucide-react";
import type { Article, Preferences, LoadingPhase } from "@/lib/types";

const LOADING_MESSAGES: Record<string, { emoji: string; text: string }> = {
  news: { emoji: "📡", text: "Buscando noticias del día..." },
  script: { emoji: "✍️", text: "Generando tu guion personalizado..." },
  done: { emoji: "✅", text: "¡Listo!" },
  error: { emoji: "❌", text: "Ha ocurrido un error" },
};

interface TrendingTopic {
  topic: string;
  score: number;
  article_count: number;
}

export default function PodcastPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <Loader2 className="h-8 w-8 animate-spin text-forest" />
        </div>
      }
    >
      <PodcastPageContent />
    </Suspense>
  );
}

function PodcastPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<LoadingPhase>("news");
  const [script, setScript] = useState<string>("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string>("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);

  // Ref para ajustes (evita recrear generatePodcast)
  const adjustmentsRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePodcast = useCallback(async (prefs: Preferences, trendingAdjustment?: string) => {
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      setPhase("news");

      // Pequeña pausa para que el usuario vea el estado
      await new Promise((r) => setTimeout(r, 800));
      setPhase("script");

      // Combine user adjustments with trending adjustment
      const parts: string[] = [];
      if (adjustmentsRef.current) parts.push(adjustmentsRef.current);
      if (trendingAdjustment) parts.push(trendingAdjustment);

      const response = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          adjustments: parts.length > 0 ? parts.join("\n") : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login?redirect=/podcast");
          return null;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al generar el podcast");
      }

      const data = await response.json();

      setScript(data.script);
      setArticles(data.articles);
      if (data.episodeId) setEpisodeId(data.episodeId);
      setPhase("done");

      return data.script as string;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }
      setError(err instanceof Error ? err.message : "Error desconocido");
      setPhase("error");
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [router]);

  useEffect(() => {
    // Intentar cargar preferencias: Supabase primero, localStorage como fallback
    async function loadPreferences(): Promise<Preferences | null> {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            // Actualizar caché local
            localStorage.setItem(
              "podcast-ai-preferences",
              JSON.stringify(data.preferences)
            );
            return data.preferences;
          }
        }
      } catch {
        // Fallback silencioso a localStorage
      }

      const saved = localStorage.getItem("podcast-ai-preferences");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
      return null;
    }

    loadPreferences().then(async (prefs) => {
      if (!prefs) {
        router.push("/onboarding");
        return;
      }
      // Si no tiene voz configurada, usar femenina por defecto
      if (!prefs.voice) prefs.voice = "female";
      setPreferences(prefs);

      // Fetch trending topics
      let trendingAdjustment: string | undefined;
      try {
        const trendingRes = await fetch("/api/trending");
        if (trendingRes.ok) {
          const data = await trendingRes.json();
          if (data.trending?.length > 0) {
            setTrendingTopics(data.trending.slice(0, 5));

            // Check if coming from dashboard with a specific trending topic
            const trendingParam = searchParams.get("trending");
            if (trendingParam) {
              setIncludeTrending(true);
              trendingAdjustment = `Prioriza e incluye noticias sobre este tema trending: ${trendingParam}`;
            }
          }
        }
      } catch {
        // Trending is optional
      }

      generatePodcast(prefs, trendingAdjustment);
    });
  }, [router, generatePodcast, searchParams]);

  const handleShare = useCallback(async () => {
    if (!episodeId) return;
    setShareLoading(true);

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episodeId }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      if (data.is_shared) {
        const shareUrl = `${window.location.origin}/shared/${episodeId}`;

        if (navigator.share) {
          await navigator.share({
            title: "Mi podcast del dia — PodCast.ai",
            text: "Escucha este podcast generado con IA",
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch {
      // silencioso
    } finally {
      setShareLoading(false);
    }
  }, [episodeId]);

  // Pantalla de carga
  if (phase === "news" || phase === "script") {
    const current = LOADING_MESSAGES[phase];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="text-6xl animate-bounce">{current.emoji}</div>
          <div>
            <h1 className="text-2xl font-bold">{current.text}</h1>
            <p className="mt-2 text-sm text-muted-light">
              Esto puede tardar unos segundos...
            </p>
          </div>

          {/* Barra de progreso */}
          <div className="mx-auto w-64 overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-2 rounded-full bg-forest transition-all duration-1000"
              style={{ width: phase === "news" ? "30%" : "70%" }}
            />
          </div>

          {/* Indicador de pasos */}
          <div className="flex justify-center gap-6 text-sm">
            <span className={phase === "news" ? "text-dark" : "text-muted-light"}>
              {phase === "news" ? "●" : "✓"} Noticias
            </span>
            <span className={phase === "script" ? "text-dark" : "text-muted-light"}>
              {phase === "script" ? "●" : "○"} Guion
            </span>
            <span className="text-muted-light">○ Listo</span>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de error
  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold">Ha ocurrido un error</h1>
          <p className="text-muted">{error}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
              disabled={isGenerating}
              className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push("/onboarding/confirmacion")}
              className="cursor-pointer rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla del podcast generado
  return (
    <div className="min-h-screen bg-cream px-4 pb-24 pt-12 text-dark">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h1 className="text-3xl font-bold">Tu podcast del dia</h1>
          {preferences && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span className="rounded-full bg-cream-dark px-3 py-1">
                ⏱️ {preferences.duration} min
              </span>
              <span className="rounded-full bg-cream-dark px-3 py-1">
                🎯 {preferences.tone}
              </span>
              <span className="rounded-full bg-cream-dark px-3 py-1">
                {preferences.voice === "male" ? "👨" : "👩"} {preferences.voice === "male" ? "Voz masculina" : "Voz femenina"}
              </span>
              {preferences.topics.map((id) => {
                const topic = getTopicById(id);
                return (
                  <span
                    key={id}
                    className="rounded-full bg-forest/10 px-3 py-1 text-dark"
                  >
                    {topic ? `${topic.emoji} ${topic.nombre}` : id}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Guion del podcast */}
        <div className="glass-card p-6 sm:p-8">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(script) }}
          />
        </div>

        {/* Fuentes utilizadas */}
        {articles.length > 0 && (
          <div className="glass-card p-6 mt-8">
            <h2 className="mb-4 text-lg font-semibold text-dark">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {articles.map((article, i) => (
                <li key={i} className="border-b border-white/30 pb-3 last:border-0 last:pb-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="font-medium text-dark underline group-hover:text-forest transition-all duration-300">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-light">
                      {article.source} · {new Date(article.publishedAt).toLocaleDateString("es-ES")}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trending toggle */}
        {trendingTopics.length > 0 && (
          <div className="glass-card mt-8 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <div
                onClick={() => setIncludeTrending(!includeTrending)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                  includeTrending ? "bg-forest" : "bg-cream-dark"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                    includeTrending ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-dark">
                Incluir noticias trending
              </span>
            </label>
            {includeTrending && (
              <div className="mt-3 flex flex-wrap gap-2">
                {trendingTopics.map((t) => (
                  <span
                    key={t.topic}
                    className="rounded-full bg-forest/10 px-2.5 py-1 text-xs text-dark"
                  >
                    {t.topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => {
              if (preferences && !isGenerating) {
                adjustmentsRef.current = null;
                const trendingAdj = includeTrending && trendingTopics.length > 0
                  ? `Prioriza e incluye noticias sobre estos temas trending de hoy: ${trendingTopics.map(t => t.topic).join(", ")}`
                  : undefined;
                generatePodcast(preferences, trendingAdj);
              }
            }}
            disabled={isGenerating}
            className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Regenerar podcast
          </button>
          <AdjustEpisode
            onAdjust={async (adjustments) => {
              if (!preferences) return;
              adjustmentsRef.current = adjustments;
              await generatePodcast(preferences);
              adjustmentsRef.current = null;
            }}
          />
          {episodeId && (
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Enlace copiado
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Compartir
                </>
              )}
            </button>
          )}
          <button
            onClick={() => router.push("/onboarding/confirmacion")}
            className="cursor-pointer rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest"
          >
            ← Cambiar preferencias
          </button>
        </div>
      </div>

      {/* Reproductor de voz del navegador */}
      {script && preferences && (
        <BrowserAudioPlayer
          script={script}
          voice={preferences.voice}
        />
      )}
    </div>
  );
}
