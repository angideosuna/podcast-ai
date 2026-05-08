"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, X } from "lucide-react";
import { DeepCastInput } from "@/components/deepcast-input";
import { DeepCastCard, type DeepCast } from "@/components/deepcast-card";

export function DeepCastSection() {
  const [deepcasts, setDeepcasts] = useState<DeepCast[]>([]);
  const [activeDeepcast, setActiveDeepcast] = useState<DeepCast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's deepcasts on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/deepcast");
        if (!res.ok) throw new Error("Error cargando deepcasts");
        const data = await res.json();
        setDeepcasts(data.deepcasts ?? []);
      } catch {
        // Silent — not critical for dashboard
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleGenerate = useCallback(async (query: string, duration: number) => {
    setIsGenerating(true);
    setError(null);
    setActiveDeepcast(null);

    try {
      const res = await fetch("/api/deepcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, duration }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al generar el deepcast");
      }

      const data = await res.json();
      const newDeepcast = data.deepcast as DeepCast;

      setActiveDeepcast(newDeepcast);

      // Add to list (remove if already exists — cache hit)
      setDeepcasts((prev) => {
        const filtered = prev.filter((d) => d.id !== newDeepcast.id);
        return [newDeepcast, ...filtered].slice(0, 12);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Recent deepcasts excluding active one
  const recentDeepcasts = deepcasts
    .filter((d) => d.id !== activeDeepcast?.id)
    .slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#E07856]" strokeWidth={1.5} />
        <h2 className="text-xl font-normal text-[#1A1614] font-[family-name:var(--font-instrument-serif)]">
          DeepCast
        </h2>
        <span className="rounded-full bg-[#E07856]/10 px-2 py-0.5 text-[10px] font-medium text-[#E07856]">
          Nuevo
        </span>
      </div>

      <p className="mb-4 text-[13px] text-[#6B5D54]">
        Pregunta lo que quieras y genera un podcast en profundidad al instante.
      </p>

      {/* Input */}
      <DeepCastInput onGenerate={handleGenerate} isGenerating={isGenerating} />

      {/* Error inline */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3">
          <p className="flex-1 text-[13px] text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="shrink-0 cursor-pointer rounded-full p-1 text-red-400 transition-colors hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Active deepcast (just generated) */}
      {activeDeepcast && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#E07856]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#E07856]" />
              Recién generado
            </span>
          </div>
          <DeepCastCard deepcast={activeDeepcast} />
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-[#F5EDE4]/60 p-4">
              <div className="flex gap-3">
                <div className="h-14 w-14 rounded-xl bg-[#E8DFD3]/40" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded bg-[#E8DFD3]/40" />
                  <div className="h-4 w-3/4 rounded bg-[#E8DFD3]/40" />
                  <div className="h-3 w-1/2 rounded bg-[#E8DFD3]/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent deepcasts */}
      {!isLoading && recentDeepcasts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[14px] font-medium text-[#1A1614]">
            Tus DeepCasts recientes
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recentDeepcasts.map((dc) => (
              <DeepCastCard key={dc.id} deepcast={dc} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state (no deepcasts and not loading) */}
      {!isLoading && deepcasts.length === 0 && !activeDeepcast && (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-white/40 backdrop-blur-xl border border-white/30 p-8 text-center">
          <Sparkles className="mb-3 h-10 w-10 text-[#D4A574]/60" strokeWidth={1.5} />
          <p className="text-[14px] font-medium text-[#1A1614]">
            Tu primer DeepCast te espera
          </p>
          <p className="mt-1 text-[13px] text-[#9B8E84]">
            Escribe cualquier tema o pregunta y genera un podcast personalizado en segundos.
          </p>
        </div>
      )}
    </section>
  );
}
