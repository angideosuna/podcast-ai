"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { TOPICS } from "@/lib/topics";
import { AudioPlayer } from "@/components/audio-player";
import { AdjustEpisode } from "@/components/adjust-episode";

interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

interface Preferences {
  topics: string[];
  duration: number;
  tone: string;
}

type LoadingPhase = "news" | "script" | "done" | "error";

const LOADING_MESSAGES: Record<string, { emoji: string; text: string }> = {
  news: { emoji: "📡", text: "Buscando noticias del día..." },
  script: { emoji: "✍️", text: "Generando tu guion personalizado..." },
  done: { emoji: "✅", text: "¡Listo!" },
  error: { emoji: "❌", text: "Ha ocurrido un error" },
};

export default function PodcastPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LoadingPhase>("news");
  const [script, setScript] = useState<string>("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string>("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // Ref para ajustes (evita recrear generatePodcast)
  const adjustmentsRef = useRef<string | null>(null);

  // Estado del audio y episodio
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  // Generar audio a partir del guion
  const generateAudioFromScript = useCallback(
    async (scriptText: string) => {
      setAudioLoading(true);
      setAudioError(null);

      // Liberar URL anterior si existe
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        const response = await fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: scriptText, episodeId }),
        });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ||
            "Error al generar el audio"
        );
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : "No se pudo generar el audio"
      );
    } finally {
      setAudioLoading(false);
    }
  }, [episodeId]);

  const generatePodcast = useCallback(async (prefs: Preferences) => {
    try {
      setPhase("news");
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setAudioError(null);

      // Pequeña pausa para que el usuario vea el estado
      await new Promise((r) => setTimeout(r, 800));
      setPhase("script");

      const response = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          adjustments: adjustmentsRef.current || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al generar el podcast");
      }

      setScript(data.script);
      setArticles(data.articles);
      if (data.episodeId) setEpisodeId(data.episodeId);
      setPhase("done");

      return data.script as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setPhase("error");
      return null;
    }
  }, []);

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
      if (saved) return JSON.parse(saved);
      return null;
    }

    loadPreferences().then((prefs) => {
      if (!prefs) {
        router.push("/onboarding");
        return;
      }
      setPreferences(prefs);

      // Generar guion y luego audio en paralelo
      generatePodcast(prefs).then((generatedScript) => {
        if (generatedScript) {
          generateAudioFromScript(generatedScript);
        }
      });
    });
  }, [router, generatePodcast, generateAudioFromScript]);

  // Limpiar URL del audio al desmontar
  useEffect(() => {
    return () => {
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  // Convertir markdown básico a HTML para renderizar el guion
  function renderMarkdown(md: string): string {
    return md
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-slate-200 mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="border-slate-800 my-6" />')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="text-slate-300 leading-relaxed mb-4">')
      // Wrap in paragraph
      .replace(/^(?!<)/, '<p class="text-slate-300 leading-relaxed mb-4">')
      .concat("</p>");
  }

  // Pantalla de carga
  if (phase === "news" || phase === "script") {
    const current = LOADING_MESSAGES[phase];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="text-6xl animate-bounce">{current.emoji}</div>
          <div>
            <h1 className="text-2xl font-bold">{current.text}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Esto puede tardar unos segundos...
            </p>
          </div>

          {/* Barra de progreso */}
          <div className="mx-auto w-64 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-1000"
              style={{ width: phase === "news" ? "30%" : "70%" }}
            />
          </div>

          {/* Indicador de pasos */}
          <div className="flex justify-center gap-6 text-sm">
            <span className={phase === "news" ? "text-blue-400" : "text-slate-600"}>
              {phase === "news" ? "●" : "✓"} Noticias
            </span>
            <span className={phase === "script" ? "text-blue-400" : "text-slate-600"}>
              {phase === "script" ? "●" : "○"} Guion
            </span>
            <span className="text-slate-600">○ Listo</span>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de error
  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold">Ha ocurrido un error</h1>
          <p className="text-slate-400">{error}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => preferences && generatePodcast(preferences)}
              className="cursor-pointer rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push("/onboarding/confirmacion")}
              className="cursor-pointer rounded-full border border-slate-700 px-6 py-3 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
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
    <div className="min-h-screen bg-slate-950 px-4 pb-24 pt-12 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h1 className="text-3xl font-bold">Tu podcast del dia</h1>
          {preferences && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-400">
              <span className="rounded-full bg-slate-800 px-3 py-1">
                ⏱️ {preferences.duration} min
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1">
                🎯 {preferences.tone}
              </span>
              {preferences.topics.map((id) => {
                const topic = TOPICS.find((t) => t.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-400"
                  >
                    {topic ? `${topic.emoji} ${topic.nombre}` : id}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Guion del podcast */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
          <div
            className="prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(script) }}
          />
        </div>

        {/* Fuentes utilizadas */}
        {articles.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {articles.map((article, i) => (
                <li key={i} className="border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {article.source} · {new Date(article.publishedAt).toLocaleDateString("es-ES")}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => {
              if (preferences) {
                adjustmentsRef.current = null;
                generatePodcast(preferences).then((s) => {
                  if (s) generateAudioFromScript(s);
                });
              }
            }}
            className="cursor-pointer rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            🔄 Regenerar podcast
          </button>
          <AdjustEpisode
            onAdjust={async (adjustments) => {
              if (!preferences) return;
              adjustmentsRef.current = adjustments;
              const s = await generatePodcast(preferences);
              if (s) generateAudioFromScript(s);
              adjustmentsRef.current = null;
            }}
          />
          <button
            onClick={() => router.push("/onboarding/confirmacion")}
            className="cursor-pointer rounded-full border border-slate-700 px-6 py-3 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            ← Cambiar preferencias
          </button>
        </div>
      </div>

      {/* Audio Player (sticky en la parte inferior) */}
      <AudioPlayer
        audioUrl={audioUrl}
        isLoading={audioLoading}
        error={audioError}
        onRetry={() => script && generateAudioFromScript(script)}
      />
    </div>
  );
}
