"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { TOPICS } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { BrowserAudioPlayer } from "@/components/browser-audio-player";
import { AdjustEpisode } from "@/components/adjust-episode";
import type { Article, Preferences, LoadingPhase } from "@/lib/types";

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

  const generatePodcast = useCallback(async (prefs: Preferences) => {
    try {
      setPhase("news");

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
      // Si no tiene voz configurada, usar femenina por defecto
      if (!prefs.voice) prefs.voice = "female";
      setPreferences(prefs);
      generatePodcast(prefs);
    });
  }, [router, generatePodcast]);

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
              <span className="rounded-full bg-slate-800 px-3 py-1">
                {preferences.voice === "male" ? "👨" : "👩"} {preferences.voice === "male" ? "Voz masculina" : "Voz femenina"}
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
                generatePodcast(preferences);
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
              await generatePodcast(preferences);
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
