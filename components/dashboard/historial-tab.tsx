"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById, CATEGORIES } from "@/lib/topics";
import { Loader2, Search, X, Clock, Calendar, Play, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { EpisodeSummary } from "@/lib/types";

const PAGE_SIZE = 10;

const TONE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "profesional", label: "Profesional" },
  { value: "deep-dive", label: "Deep-dive" },
];

const DATE_OPTIONS = [
  { value: "", label: "Todo" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
];

function getDateThreshold(filter: string): string | null {
  const now = new Date();
  if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (filter === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).toISOString();
  }
  if (filter === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
}

interface HistorialTabProps {
  userId: string;
}

export function HistorialTab({ userId }: HistorialTabProps) {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [topicFilters, setTopicFilters] = useState<string[]>([]);
  const [toneFilter, setToneFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userTopicIds, setUserTopicIds] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch user preferences once on mount (not on every filter change)
  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(supabase.from("preferences").select("topics").eq("user_id", userId).single())
      .then(({ data: prefs }) => { if (prefs?.topics) setUserTopicIds(prefs.topics); })
      .catch(() => { /* ignore */ });
  }, [userId]);

  const loadEpisodes = useCallback(async (offset: number, filters: { topics: string[]; tone: string; date: string; search: string }) => {
    const supabase = createClient();

    let data: EpisodeSummary[] | null = null;
    let count: number | null = null;

    if (filters.search) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("search_episodes", { p_user_id: userId, p_query: filters.search, p_limit: PAGE_SIZE, p_offset: offset });
        if (!rpcError && rpcData) { data = rpcData as EpisodeSummary[]; count = rpcData.length < PAGE_SIZE ? offset + rpcData.length : null; }
      } catch { /* fallback */ }
    }

    if (data === null) {
      let query = supabase.from("episodes").select("id, title, topics, duration, tone, audio_url, is_shared, cover_image_url, created_at", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false });
      if (filters.topics.length > 0) query = query.overlaps("topics", filters.topics);
      if (filters.tone) query = query.eq("tone", filters.tone);
      const dt = getDateThreshold(filters.date);
      if (dt) query = query.gte("created_at", dt);
      if (filters.search) query = query.ilike("title", `%${filters.search}%`);
      query = query.range(offset, offset + PAGE_SIZE - 1);
      const result = await query;
      data = result.data;
      count = result.count ?? null;
    }

    if (offset === 0) setTotal(count ?? 0);
    if (data) {
      if (offset === 0) setEpisodes(data); else setEpisodes(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
  }, [userId]);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchText]);

  // Load on mount or filter change
  useEffect(() => {
    setLoading(true);
    loadEpisodes(0, { topics: topicFilters, tone: toneFilter, date: dateFilter, search: debouncedSearch })
      .finally(() => setLoading(false));
  }, [topicFilters, toneFilter, dateFilter, debouncedSearch, loadEpisodes]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadEpisodes(episodes.length, { topics: topicFilters, tone: toneFilter, date: dateFilter, search: debouncedSearch });
    setLoadingMore(false);
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleVisibility = async (e: React.MouseEvent, episodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTogglingId(episodeId);

    // Optimistic update
    setEpisodes(prev => prev.map(ep =>
      ep.id === episodeId ? { ...ep, is_shared: !ep.is_shared } : ep
    ));

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episodeId }),
      });
      if (!res.ok) {
        // Revert
        setEpisodes(prev => prev.map(ep =>
          ep.id === episodeId ? { ...ep, is_shared: !ep.is_shared } : ep
        ));
      } else {
        const data = await res.json();
        setEpisodes(prev => prev.map(ep =>
          ep.id === episodeId ? { ...ep, is_shared: data.is_shared } : ep
        ));
      }
    } catch {
      // Revert
      setEpisodes(prev => prev.map(ep =>
        ep.id === episodeId ? { ...ep, is_shared: !ep.is_shared } : ep
      ));
    } finally {
      setTogglingId(null);
    }
  };

  const hasActiveFilters = topicFilters.length > 0 || toneFilter !== "" || dateFilter !== "" || debouncedSearch !== "";
  const clearFilters = () => { setTopicFilters([]); setToneFilter(""); setDateFilter(""); setSearchText(""); setDebouncedSearch(""); };
  const toggleTopicFilter = (id: string) => setTopicFilters(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const filterTopicIds = userTopicIds.length > 0 ? userTopicIds : CATEGORIES.flatMap(c => c.subtopics.map(s => s.id)).slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">Tu biblioteca</h1>
        <p className="mt-1 text-[13px] text-[#9CA3AF]">
          {loading ? "Cargando..." : total === 0 && !hasActiveFilters ? "Aún no tienes episodios" : `${total} ${total === 1 ? "episodio" : "episodios"}${hasActiveFilters ? " encontrados" : " generados"}`}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar episodios..." className="glass-input w-full !pl-10 !pr-10" />
        {searchText && <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-[#9CA3AF] hover:text-[#111827]"><X className="h-4 w-4" /></button>}
      </div>

      {/* Filters — all pills */}
      <div className="space-y-2">
        {/* Topic pills */}
        <div className="flex flex-wrap gap-2 pb-1">
          {filterTopicIds.map(topicId => {
            const topic = getTopicById(topicId);
            if (!topic) return null;
            const active = topicFilters.includes(topicId);
            return (
              <button key={topicId} onClick={() => toggleTopicFilter(topicId)} className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ${active ? "bg-[#7C3AED] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"}`}>
                {topic.emoji} {topic.nombre}
              </button>
            );
          })}
        </div>
        {/* Tone + date pills */}
        <div className="flex flex-wrap items-center gap-2">
          {TONE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setToneFilter(prev => prev === opt.value ? "" : opt.value)} className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ${toneFilter === opt.value ? "bg-[#7C3AED] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"}`}>
              {opt.label}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-[#E5E7EB]" />
          {DATE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDateFilter(opt.value)} className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ${dateFilter === opt.value ? "bg-[#7C3AED] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"}`}>
              {opt.label}
            </button>
          ))}
          {hasActiveFilters && <button onClick={clearFilters} className="ml-auto cursor-pointer text-[12px] text-[#9CA3AF] transition-colors hover:text-[#7C3AED]">Limpiar</button>}
        </div>
      </div>

      {/* Episodes list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" /></div>
      ) : episodes.length === 0 ? (
        <div className="rounded-3xl bg-gradient-to-br from-white to-[#F9FAFB] p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F9FAFB]">
            {hasActiveFilters ? <Search className="h-7 w-7 text-[#6B7280]" /> : <Play className="h-7 w-7 fill-[#a0a0a0] text-[#6B7280]" />}
          </div>
          <p className="text-[15px] font-medium text-[#6B7280]">{hasActiveFilters ? "No se encontraron episodios con estos filtros" : "Genera tu primer podcast para empezar"}</p>
          <button onClick={() => hasActiveFilters ? clearFilters() : router.push("/dashboard")} className="mt-5 cursor-pointer rounded-full bg-[#7C3AED] px-6 py-3 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-[#A855F7] hover:scale-105">
            {hasActiveFilters ? "Limpiar filtros" : "Generar podcast"}
          </button>
        </div>
      ) : (
        <>
          {/* Pinterest/Bento grid */}
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3 stagger-in">
            {episodes.map((episode, idx) => (
              <Link
                key={episode.id}
                href={`/historial/${episode.id}`}
                className="group block break-inside-avoid overflow-hidden rounded-3xl bg-white border border-[#E5E7EB] transition-all duration-200 hover:scale-[1.02]"
              >
                {/* Thumbnail — taller for first 2, standard for rest */}
                <div className={`relative w-full overflow-hidden ${idx < 2 ? "h-[140px]" : "h-[100px]"}`}>
                  <EpisodeThumbnail topics={episode.topics} size="lg" className="!w-full !h-full !rounded-none" coverImageUrl={(episode as EpisodeSummary & { cover_image_url?: string }).cover_image_url ?? undefined} />
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </div>
                  </div>
                  {/* Visibility badge */}
                  <button
                    onClick={(e) => handleToggleVisibility(e, episode.id)}
                    disabled={togglingId === episode.id}
                    className={`absolute top-2 right-2 z-10 rounded-full p-1.5 backdrop-blur-sm transition-all duration-200 disabled:opacity-50 ${
                      episode.is_shared
                        ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                        : "bg-black/40 text-[#6B7280]"
                    }`}
                  >
                    {episode.is_shared ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  </button>
                  {/* Weekly badge */}
                  {episode.topics.includes("weekly-digest") && (
                    <span className="absolute top-2 left-2 rounded-full bg-[#7C3AED]/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Semanal
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3.5">
                  <h3 className="text-[14px] font-semibold leading-tight text-[#111827] line-clamp-2">
                    {episode.title}
                  </h3>
                  <p className="mt-1 text-[12px] text-[#9CA3AF] line-clamp-1">
                    {episode.topics.map(topicId => {
                      const topic = getTopicById(topicId);
                      return topic ? topic.nombre : topicId;
                    }).join(", ")}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-full bg-[#F9FAFB] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">
                      {episode.duration} min
                    </span>
                    <span className="rounded-full bg-[#F9FAFB] px-2 py-0.5 text-[11px] font-medium text-[#9CA3AF]">
                      {episode.tone}
                    </span>
                    <span className="ml-auto text-[11px] text-[#9CA3AF]">
                      {new Date(episode.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button onClick={handleLoadMore} disabled={loadingMore} className="cursor-pointer rounded-full bg-[#F3F4F6] px-6 py-2.5 text-[13px] font-semibold text-[#111827] transition-all duration-200 hover:bg-[#F3F4F6] hover:scale-105 disabled:opacity-50">
                {loadingMore ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</span> : "Cargar más"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
