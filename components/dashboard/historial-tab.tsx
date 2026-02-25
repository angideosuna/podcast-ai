"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById, CATEGORIES } from "@/lib/topics";
import { Loader2, Search, X, Headphones, Clock } from "lucide-react";
import Link from "next/link";
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
      let query = supabase.from("episodes").select("id, title, topics, duration, tone, audio_url, created_at", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false });
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

  const hasActiveFilters = topicFilters.length > 0 || toneFilter !== "" || dateFilter !== "" || debouncedSearch !== "";
  const clearFilters = () => { setTopicFilters([]); setToneFilter(""); setDateFilter(""); setSearchText(""); setDebouncedSearch(""); };
  const toggleTopicFilter = (id: string) => setTopicFilters(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const filterTopicIds = userTopicIds.length > 0 ? userTopicIds : CATEGORIES.flatMap(c => c.subtopics.map(s => s.id)).slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Historial de episodios</h1>
        <p className="mt-1 text-muted">
          {loading ? "Cargando..." : total === 0 && !hasActiveFilters ? "Aún no tienes episodios" : `${total} ${total === 1 ? "episodio" : "episodios"}${hasActiveFilters ? " encontrados" : " generados"}`}
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar en título y contenido..." className="glass-input w-full pl-9 text-sm" />
          {searchText && <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-light hover:text-dark"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterTopicIds.map(topicId => {
            const topic = getTopicById(topicId);
            if (!topic) return null;
            const active = topicFilters.includes(topicId);
            return (
              <button key={topicId} onClick={() => toggleTopicFilter(topicId)} className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 ${active ? "bg-forest text-white" : "bg-cream-dark/50 text-dark/70 hover:bg-forest/10"}`}>
                {topic.emoji} {topic.nombre}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TONE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setToneFilter(prev => prev === opt.value ? "" : opt.value)} className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 ${toneFilter === opt.value ? "bg-forest text-white" : "bg-cream-dark/50 text-dark/70 hover:bg-forest/10"}`}>
              {opt.label}
            </button>
          ))}
          <span className="mx-1 text-cream-dark">|</span>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="cursor-pointer rounded-full bg-cream-dark/50 px-3 py-1 text-xs font-medium text-dark/70 outline-none hover:bg-forest/10">
            {DATE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {hasActiveFilters && <button onClick={clearFilters} className="ml-auto cursor-pointer text-xs text-muted-light underline hover:text-forest">Limpiar filtros</button>}
        </div>
      </div>

      {/* Episodes list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-forest" /></div>
      ) : episodes.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4">{hasActiveFilters ? "🔍" : "🎙️"}</div>
          <p className="mb-4 text-muted">{hasActiveFilters ? "No se encontraron episodios con estos filtros" : "Genera tu primer podcast para empezar el historial"}</p>
          <button onClick={() => hasActiveFilters ? clearFilters() : router.push("/dashboard")} className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-light">
            {hasActiveFilters ? "Limpiar filtros" : "Generar podcast"}
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {episodes.map(episode => (
              <li key={episode.id}>
                <Link href={`/historial/${episode.id}`} className="group flex items-start justify-between glass-card px-5 py-4 transition-all duration-300 hover:border-forest/20 hover:bg-forest/5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium group-hover:text-forest">{episode.title}</p>
                      {episode.topics.includes("weekly-digest") && <span className="shrink-0 rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-semibold text-forest">Semanal</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted-light">
                      {new Date(episode.created_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {episode.duration} min · {episode.tone}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {episode.topics.map(topicId => {
                        const topic = getTopicById(topicId);
                        return <span key={topicId} className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs">{topic ? `${topic.emoji} ${topic.nombre}` : topicId}</span>;
                      })}
                    </div>
                  </div>
                  {episode.audio_url ? <Headphones className="ml-4 mt-1 h-5 w-5 shrink-0" /> : <Clock className="ml-4 mt-1 h-5 w-5 shrink-0 text-muted-light" />}
                </Link>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={handleLoadMore} disabled={loadingMore} className="cursor-pointer rounded-full border border-white/[0.08] px-6 py-3 font-medium text-dark/80 hover:border-forest/30 hover:text-forest disabled:opacity-50">
                {loadingMore ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</span> : "Cargar más episodios"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
