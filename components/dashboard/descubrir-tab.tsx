"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TrendingUp, Loader2, Play, RefreshCw, ChevronUp, ExternalLink } from "lucide-react";
import { ClipAudioPlayer } from "@/components/clip-audio-player";

interface TrendingTopic {
  topic: string;
  score: number;
  article_count: number;
  category: string | null;
}

interface ClipData {
  script: string;
  articles: { title: string; source_name: string; url: string }[];
}

interface ClipState {
  status: "idle" | "generating" | "ready" | "error";
  clip?: ClipData;
  errorMessage?: string;
}

interface DescubrirTabProps {
  trending: TrendingTopic[];
}

const EXCLUDED_CATEGORIES = ["entertainment", "sports"];

export function DescubrirTab({ trending }: DescubrirTabProps) {
  const [clipStates, setClipStates] = useState<Record<string, ClipState>>({});
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const pollingRef = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      pollingRef.current.clear();
    };
  }, []);

  // Separar clips (top 5 excluyendo entertainment/sports) del resto
  const clipTopics = trending
    .filter((t) => !t.category || !EXCLUDED_CATEGORIES.includes(t.category.toLowerCase()))
    .slice(0, 5);
  const restTopics = trending.filter((t) => !clipTopics.includes(t));

  // Check cache para todos los trending topics en paralelo al montar
  useEffect(() => {
    let cancelled = false;
    const allTopicNames = trending.map((t) => t.topic);
    if (allTopicNames.length === 0) return;

    Promise.all(
      allTopicNames.map((topic) =>
        fetch(`/api/clips?topic=${encodeURIComponent(topic)}`)
          .then((r) => r.json())
          .then((data) => ({ topic, data }))
          .catch(() => ({ topic, data: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      const batch: Record<string, ClipState> = {};
      for (const { topic, data } of results) {
        if (data?.status === "ready") {
          batch[topic] = { status: "ready", clip: data.clip };
        } else if (data?.status === "generating") {
          batch[topic] = { status: "generating" };
        }
      }
      if (Object.keys(batch).length > 0) {
        setClipStates((prev) => ({ ...prev, ...batch }));
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trending]);

  const pollClip = useCallback(async (topic: string, attempts = 0) => {
    if (!mountedRef.current || attempts >= 60) {
      pollingRef.current.delete(topic);
      if (mountedRef.current && attempts >= 60) {
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "error", errorMessage: "Timeout: el clip tardó demasiado" },
        }));
      }
      return;
    }

    await new Promise((r) => setTimeout(r, 2000));
    if (!mountedRef.current) { pollingRef.current.delete(topic); return; }

    try {
      const res = await fetch(`/api/clips?topic=${encodeURIComponent(topic)}`);
      if (!mountedRef.current) { pollingRef.current.delete(topic); return; }
      const data = await res.json();

      if (data.status === "ready") {
        pollingRef.current.delete(topic);
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "ready", clip: data.clip },
        }));
      } else if (data.status === "error") {
        pollingRef.current.delete(topic);
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "error", errorMessage: data.error_message },
        }));
      } else {
        pollClip(topic, attempts + 1);
      }
    } catch {
      pollingRef.current.delete(topic);
      if (mountedRef.current) {
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "error", errorMessage: "Error de conexión" },
        }));
      }
    }
  }, []);

  const handleGenerate = useCallback(async (topic: string) => {
    // Protección doble-click: si ya está generando o polling, ignorar
    if (pollingRef.current.has(topic)) return;

    setClipStates((prev) => ({
      ...prev,
      [topic]: { status: "generating" },
    }));

    try {
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (!mountedRef.current) return;
      const data = await res.json();

      if (data.status === "ready") {
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "ready", clip: data.clip },
        }));
      } else if (res.status === 202 || data.status === "generating") {
        pollingRef.current.add(topic);
        pollClip(topic);
      } else if (data.status === "error") {
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "error", errorMessage: data.error_message },
        }));
      }
    } catch {
      if (mountedRef.current) {
        setClipStates((prev) => ({
          ...prev,
          [topic]: { status: "error", errorMessage: "Error de conexión" },
        }));
      }
    }
  }, [pollClip]);

  const getClipState = (topic: string): ClipState => {
    return clipStates[topic] || { status: "idle" };
  };

  const renderClipCard = (t: TrendingTopic, rank: number, isHighlight: boolean) => {
    const state = getClipState(t.topic);
    const isExpanded = expandedTopic === t.topic;

    return (
      <div key={t.topic} className="glass-card overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          {/* Badge de ranking */}
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
            isHighlight
              ? (rank === 1 ? "bg-red-600" : rank <= 3 ? "bg-orange-500" : "bg-orange-400")
              : "bg-forest/60"
          }`}>
            {rank}
          </span>

          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.topic}</p>
            <p className="mt-0.5 text-sm text-muted">
              {t.article_count} {t.article_count === 1 ? "artículo" : "artículos"}
              {t.category ? ` · ${t.category}` : ""}
            </p>
          </div>

          {/* Botón según estado */}
          <div className="flex items-center gap-2 shrink-0">
            {state.status === "idle" && (
              <button
                onClick={() => handleGenerate(t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-forest/80"
              >
                <Play className="h-3.5 w-3.5" />
                Generar clip
              </button>
            )}

            {state.status === "generating" && (
              <span className="flex items-center gap-1.5 rounded-full bg-forest/20 px-4 py-2 text-sm font-medium text-forest">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generando...
              </span>
            )}

            {state.status === "ready" && (
              <button
                onClick={() => setExpandedTopic(isExpanded ? null : t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-forest/80 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-forest"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Cerrar
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Escuchar
                  </>
                )}
              </button>
            )}

            {state.status === "error" && (
              <button
                onClick={() => handleGenerate(t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-red-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            )}
          </div>
        </div>

        {/* Expanded: script preview + player + fuentes */}
        {isExpanded && state.status === "ready" && state.clip && (
          <div className="border-t border-white/10 px-5 pb-5 pt-4 space-y-4">
            {/* Script preview con fade */}
            <div className="relative max-h-32 overflow-hidden">
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                {state.clip.script.slice(0, 500)}
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#121212] to-transparent" />
            </div>

            {/* Player inline */}
            <ClipAudioPlayer script={state.clip.script} />

            {/* Fuentes */}
            {state.clip.articles.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted mb-1.5">Fuentes:</p>
                <div className="flex flex-wrap gap-2">
                  {state.clip.articles.map((a) => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-muted transition-colors hover:text-forest hover:bg-forest/10"
                    >
                      {a.source_name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">🔍 Descubrir</h1>
        <p className="mt-1 text-muted">Los temas más comentados del día. Genera clips de 5 min y escúchalos al instante.</p>
      </div>

      {/* Sección 1: Clips destacados */}
      {clipTopics.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">🔥 Temas destacados</h2>
            <p className="mt-0.5 text-sm text-muted">Los temas más polémicos del momento.</p>
          </div>

          <div className="space-y-3">
            {clipTopics.map((t, i) => renderClipCard(t, i + 1, true))}
          </div>
        </div>
      )}

      {/* Sección 2: Más trending */}
      {restTopics.length > 0 && (
        <div className="space-y-4">
          {clipTopics.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold">📈 Más trending</h2>
              <p className="mt-0.5 text-sm text-muted">Genera un clip sobre cualquier tema.</p>
            </div>
          )}

          <div className="space-y-3">
            {restTopics.map((t, i) => renderClipCard(t, clipTopics.length + i + 1, false))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {trending.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4">📡</div>
          <p className="text-muted">No hay temas trending disponibles ahora mismo. Vuelve más tarde.</p>
        </div>
      )}
    </div>
  );
}
