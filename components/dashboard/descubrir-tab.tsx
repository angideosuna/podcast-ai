"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  Loader2,
  Play,
  RefreshCw,
  ChevronUp,
  ExternalLink,
  Cpu,
  Atom,
  Landmark,
  Palette,
  Heart,
  Search as SearchIcon,
  Compass,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { ClipAudioPlayer } from "@/components/clip-audio-player";
import { SocialFeed } from "@/components/social/social-feed";
import { LikeButton } from "@/components/social/like-button";
import { LiveStationCard, type StationWithSub } from "@/components/live-station-card";

interface TrendingTopic {
  topic: string;
  score: number;
  article_count: number;
  category: string | null;
}

interface ClipData {
  id?: string;
  script: string;
  articles: { title: string; source_name: string; url: string }[];
  likes_count?: number;
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

// ─── Clip thumbnail by news-agent category ────────────────

const CLIP_GRADIENTS: Record<string, string> = {
  technology: "from-[#7C3AED] to-[#6D28D9]",
  science: "from-[#06B6D4] to-[#0891B2]",
  business: "from-[#F97316] to-[#EA580C]",
  health: "from-emerald-500 to-[#06B6D4]",
  politics: "from-[#F97316] to-red-600",
  entertainment: "from-pink-500 to-[#7C3AED]",
  sports: "from-amber-500 to-[#F97316]",
  general: "from-[#7C3AED] to-[#A855F7]",
};

const CLIP_ICONS: Record<string, LucideIcon> = {
  technology: Cpu,
  science: Atom,
  business: TrendingUp,
  health: Heart,
  politics: Landmark,
  entertainment: Palette,
  sports: Compass,
  general: Radio,
};

function ClipThumbnail({ category }: { category: string | null }) {
  const cat = (category || "general").toLowerCase();
  const gradient = CLIP_GRADIENTS[cat] || "from-gray-600 to-gray-800";
  const Icon = CLIP_ICONS[cat] || Radio;
  return (
    <div className={`h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br ${gradient} relative flex items-center justify-center overflow-hidden`}>
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      <Icon size={20} className="relative z-10 text-white/80" />
    </div>
  );
}

export function DescubrirTab({ trending }: DescubrirTabProps) {
  const [clipStates, setClipStates] = useState<Record<string, ClipState>>({});
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const pollingRef = useRef<Set<string>>(new Set());

  // Live Stations state
  const [stations, setStations] = useState<StationWithSub[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      pollingRef.current.clear();
    };
  }, []);

  // Fetch live stations on mount
  useEffect(() => {
    let cancelled = false;
    async function loadStations() {
      try {
        const res = await fetch("/api/stations");
        if (!res.ok) throw new Error("Error fetching stations");
        const data = await res.json();
        if (!cancelled) setStations(data.stations ?? []);
      } catch {
        // Silent — not critical
      } finally {
        if (!cancelled) setStationsLoading(false);
      }
    }
    loadStations();
    return () => { cancelled = true; };
  }, []);

  // Optimistic subscribe toggle
  const handleSubscribeToggle = useCallback(async (stationId: string) => {
    setSubscribingId(stationId);

    // Optimistic update
    setStations((prev) =>
      prev.map((s) =>
        s.id === stationId
          ? {
              ...s,
              isSubscribed: !s.isSubscribed,
              subscriber_count: s.subscriber_count + (s.isSubscribed ? -1 : 1),
            }
          : s
      )
    );

    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId }),
      });

      if (!res.ok) throw new Error("Error toggling subscription");

      const data = await res.json();

      // Sync with server value
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId
            ? { ...s, isSubscribed: data.subscribed, subscriber_count: data.subscriberCount }
            : s
        )
      );
    } catch {
      // Revert optimistic update
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId
            ? {
                ...s,
                isSubscribed: !s.isSubscribed,
                subscriber_count: s.subscriber_count + (s.isSubscribed ? -1 : 1),
              }
            : s
        )
      );
    } finally {
      setSubscribingId(null);
    }
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

  const renderClipCard = (t: TrendingTopic, rank: number, isHighlight: boolean, isHero = false) => {
    const state = getClipState(t.topic);
    const isExpanded = expandedTopic === t.topic;
    const cat = (t.category || "general").toLowerCase();
    const gradient = CLIP_GRADIENTS[cat] || "from-gray-600 to-gray-800";

    return (
      <div key={t.topic} className={`overflow-hidden rounded-3xl bg-white border border-[#E5E7EB] backdrop-blur-md transition-all duration-200 hover:scale-[1.02] ${isHero ? "row-span-2" : ""}`}>
        {/* Visual header with gradient */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${isHero ? "h-[160px]" : "h-[80px]"} flex items-end p-4`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
          {/* Rank badge */}
          <span className={`absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
            rank === 1 ? "bg-yellow-400 text-black" : rank === 2 ? "bg-gray-300 text-black" : rank === 3 ? "bg-amber-600 text-white" : "bg-black/40 text-white"
          }`}>
            {rank}
          </span>
          <h3 className={`relative z-10 font-extrabold leading-tight text-white ${isHero ? "text-xl" : "text-[15px]"}`}>
            {t.topic}
          </h3>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-[13px] text-[#6B7280]">
            {t.article_count} {t.article_count === 1 ? "artículo" : "artículos"}
            {t.category ? ` · ${t.category}` : ""}
          </p>

          {/* Actions row */}
          <div className="mt-3 flex items-center gap-2">
            {state.status === "idle" && (
              <button
                onClick={() => handleGenerate(t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#7C3AED] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-[#A855F7] hover:scale-105"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Generar clip
              </button>
            )}

            {state.status === "generating" && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#7C3AED]/15 px-4 py-2 text-[13px] font-medium text-[#7C3AED]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generando...
              </span>
            )}

            {state.status === "ready" && (
              <button
                onClick={() => setExpandedTopic(isExpanded ? null : t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#7C3AED] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-[#A855F7] hover:scale-105"
              >
                {isExpanded ? (
                  <><ChevronUp className="h-3.5 w-3.5" /> Cerrar</>
                ) : (
                  <><Play className="h-3.5 w-3.5 fill-white" /> Reproducir</>
                )}
              </button>
            )}

            {state.status === "error" && (
              <button
                onClick={() => handleGenerate(t.topic)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-red-500/10 px-4 py-2 text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            )}

            {state.status === "ready" && state.clip?.id && (
              <LikeButton variant="clip" targetId={state.clip.id} liked={false} count={state.clip.likes_count ?? 0} />
            )}
          </div>
        </div>

        {/* Expanded: script preview + player + fuentes */}
        {isExpanded && state.status === "ready" && state.clip && (
          <div className="space-y-4 border-t border-[#E5E7EB] px-4 pb-4 pt-4">
            <div className="relative max-h-32 overflow-hidden">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#6B7280]">
                {state.clip.script.slice(0, 500)}
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
            </div>
            <ClipAudioPlayer script={state.clip.script} />
            {state.clip.articles.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-[#9CA3AF]">Fuentes:</p>
                <div className="flex flex-wrap gap-2">
                  {state.clip.articles.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full bg-[#F9FAFB] px-3 py-1 text-[12px] text-[#6B7280] transition-colors hover:bg-[#7C3AED]/10 hover:text-[#7C3AED]">
                      {a.source_name} <ExternalLink className="h-3 w-3" />
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
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-6 lg:px-8">
      {/* Search (Huxe Discover style) */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="Buscar nuevos shows"
          className="glass-input w-full !pl-11"
          readOnly
        />
      </div>

      {/* ═══ En directo — Live Stations ═══ */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <h2 className="text-base font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">
              En directo
            </h2>
          </div>
          {!stationsLoading && stations.length > 0 && (
            <span className="text-[12px] text-[#9CA3AF]">
              {stations.length} estaciones
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {stationsLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white border border-[#E5E7EB]" />
            ))}
          </div>
        )}

        {/* Stations grid */}
        {!stationsLoading && stations.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stations.map((station) => (
              <div key={station.id}>
                <LiveStationCard
                  station={station}
                  onSubscribeToggle={handleSubscribeToggle}
                  isSubscribing={subscribingId === station.id}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!stationsLoading && stations.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl bg-white border border-[#E5E7EB] p-8 text-center">
            <div className="mb-2 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-[#9CA3AF]">Sin estaciones disponibles</span>
            </div>
          </div>
        )}
      </section>

      {/* ═══ De tu gente ═══ */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">De tu gente</h2>
        </div>
        <SocialFeed variant="feed" />
      </section>

      {/* Sección 1: Clips destacados */}
      {clipTopics.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">Temas destacados</h2>
              <p className="mt-0.5 text-[13px] text-[#9CA3AF]">Los temas más polémicos del momento.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-in">
            {clipTopics.map((t, i) => renderClipCard(t, i + 1, true, i === 0))}
          </div>
        </section>
      )}

      {/* Sección 2: Más trending */}
      {restTopics.length > 0 && (
        <section className="mb-8">
          {clipTopics.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">Más trending</h2>
                <p className="mt-0.5 text-[13px] text-[#9CA3AF]">Genera un clip sobre cualquier tema.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-in">
            {restTopics.map((t, i) => renderClipCard(t, clipTopics.length + i + 1, false))}
          </div>
        </section>
      )}

      {/* ═══ Populares ═══ */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">Populares</h2>
            <p className="mt-0.5 text-[13px] text-[#9CA3AF]">Los episodios más valorados por la comunidad.</p>
          </div>
        </div>
        <SocialFeed variant="popular" />
      </section>

      {/* Empty state */}
      {trending.length === 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-white to-[#F9FAFB] p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F9FAFB]">
            <Radio className="h-7 w-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] font-medium text-[#6B7280]">No hay temas trending disponibles ahora mismo.</p>
          <p className="mt-1 text-[13px] text-[#9CA3AF]">Vuelve más tarde para descubrir nuevos temas.</p>
        </div>
      )}
    </div>
  );
}
