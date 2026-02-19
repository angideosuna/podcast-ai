"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getTopicById } from "@/lib/topics";
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePodcast = useCallback(async (prefs: Preferences) => {
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

      const response = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          adjustments: adjustmentsRef.current || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al generar el podcast");
      }

      const data = await response.json();

      setScript(data.script);
      setArticles(data.articles);
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
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 text-stone-900">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="text-6xl animate-bounce">{current.emoji}</div>
          <div>
            <h1 className="text-2xl font-bold">{current.text}</h1>
            <p className="mt-2 text-sm text-stone-400">
              Esto puede tardar unos segundos...
            </p>
          </div>

          {/* Barra de progreso */}
          <div className="mx-auto w-64 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-2 rounded-full bg-stone-900 transition-all duration-1000"
              style={{ width: phase === "news" ? "30%" : "70%" }}
            />
          </div>

          {/* Indicador de pasos */}
          <div className="flex justify-center gap-6 text-sm">
            <span className={phase === "news" ? "text-stone-900" : "text-stone-400"}>
              {phase === "news" ? "●" : "✓"} Noticias
            </span>
            <span className={phase === "script" ? "text-stone-900" : "text-stone-400"}>
              {phase === "script" ? "●" : "○"} Guion
            </span>
            <span className="text-stone-400">○ Listo</span>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de error
  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 text-stone-900">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold">Ha ocurrido un error</h1>
          <p className="text-stone-500">{error}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
              disabled={isGenerating}
              className="cursor-pointer rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push("/onboarding/confirmacion")}
              className="cursor-pointer rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900"
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
    <div className="min-h-screen bg-stone-100 px-4 pb-24 pt-12 text-stone-900">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h1 className="text-3xl font-bold">Tu podcast del dia</h1>
          {preferences && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-stone-500">
              <span className="rounded-full bg-stone-200 px-3 py-1">
                ⏱️ {preferences.duration} min
              </span>
              <span className="rounded-full bg-stone-200 px-3 py-1">
                🎯 {preferences.tone}
              </span>
              <span className="rounded-full bg-stone-200 px-3 py-1">
                {preferences.voice === "male" ? "👨" : "👩"} {preferences.voice === "male" ? "Voz masculina" : "Voz femenina"}
              </span>
              {preferences.topics.map((id) => {
                const topic = getTopicById(id);
                return (
                  <span
                    key={id}
                    className="rounded-full bg-stone-800/8 px-3 py-1 text-stone-900"
                  >
                    {topic ? `${topic.emoji} ${topic.nombre}` : id}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Guion del podcast */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <div
            className="prose prose-stone max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(script) }}
          />
        </div>

        {/* Fuentes utilizadas */}
        {articles.length > 0 && (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {articles.map((article, i) => (
                <li key={i} className="border-b border-stone-200 pb-3 last:border-0 last:pb-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="font-medium text-stone-900 underline group-hover:text-stone-700 transition-colors">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
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
              if (preferences && !isGenerating) {
                adjustmentsRef.current = null;
                generatePodcast(preferences);
              }
            }}
            disabled={isGenerating}
            className="cursor-pointer rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="cursor-pointer rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900"
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
