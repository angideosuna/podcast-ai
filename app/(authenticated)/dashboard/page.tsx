"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Home, Search, User, Plus } from "lucide-react";
import { useDashboard } from "@/components/dashboard-context";
import type { EpisodeSummary } from "@/lib/types";

// Lazy load tab components — only the active tab gets loaded
const HoyTab = dynamic(
  () => import("@/components/dashboard/hoy-tab").then((m) => ({ default: m.HoyTab })),
  { ssr: false }
);
const HistorialTab = dynamic(
  () => import("@/components/dashboard/historial-tab").then((m) => ({ default: m.HistorialTab })),
  { ssr: false }
);
const DescubrirTab = dynamic(
  () => import("@/components/dashboard/descubrir-tab").then((m) => ({ default: m.DescubrirTab })),
  { ssr: false }
);
const PerfilTab = dynamic(
  () => import("@/components/dashboard/perfil-tab").then((m) => ({ default: m.PerfilTab })),
  { ssr: false }
);
const UniversoTab = dynamic(
  () => import("@/components/dashboard/universo-tab").then((m) => ({ default: m.UniversoTab })),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // ─── Shared state ────────────────────────────────────────────
  const [profileName, setProfileName] = useState<string | null>(null);
  const [recentEpisodes, setRecentEpisodes] = useState<EpisodeSummary[]>([]);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [surveyCompleted, setSurveyCompleted] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // ═══ PWA install ═══════════════════════════════════════════
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

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    (installPrompt as unknown as { prompt: () => void }).prompt();
    setShowInstallBanner(false);
    localStorage.setItem("podcast-ai-pwa-dismissed", "1");
  }, [installPrompt]);

  const dismissInstall = useCallback(() => {
    setShowInstallBanner(false);
    localStorage.setItem("podcast-ai-pwa-dismissed", "1");
  }, []);

  // ═══ Initial data load — all queries in parallel ═══════════
  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      // Fetch everything in parallel — DB + trending API
      const [profileRes, prefsRes, episodesRes, scheduleRes, trendingRes] = await Promise.all([
        supabase.from("profiles").select("nombre, survey_completed").eq("id", user.id).single(),
        supabase.from("preferences").select("id").eq("user_id", user.id).single(),
        supabase.from("episodes").select("id, title, topics, duration, tone, audio_url, is_shared, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("schedules").select("time, frequency, custom_days, is_active").eq("user_id", user.id).single(),
        fetch("/api/trending").then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (profileRes.data) {
        setProfileName(profileRes.data.nombre);
        setSurveyCompleted(!!profileRes.data.survey_completed);
      }
      setHasPreferences(!!prefsRes.data);
      if (episodesRes.data) setRecentEpisodes(episodesRes.data);
      if (scheduleRes.data) setSchedule(scheduleRes.data);
      if (trendingRes?.trending?.length > 0) setTrending(trendingRes.trending.slice(0, 10));

      // Backfill onboarding cookie
      if (prefsRes.data && !document.cookie.includes("wavecast_onboarding_complete")) {
        document.cookie = "wavecast_onboarding_complete=true; path=/; max-age=31536000; SameSite=Lax";
      }

      setLoading(false);
    }
    loadDashboard();
  }, [router]);

  // ═══ Memoized computations ═══════════════════════════════
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const displayName = profileName || "Hola";

  const todayEpisode = useMemo(() => {
    const today = new Date().toLocaleDateString("es-ES");
    return recentEpisodes.find((ep) => new Date(ep.created_at).toLocaleDateString("es-ES") === today);
  }, [recentEpisodes]);

  const weeklyDigest = useMemo(() => {
    return recentEpisodes.find((ep) => ep.topics.includes("weekly-digest"));
  }, [recentEpisodes]);

  const switchToHistorial = useCallback(() => setActiveTab("historial"), [setActiveTab]);
  const switchToPerfil = useCallback(() => setActiveTab("perfil"), [setActiveTab]);
  const switchToUniverso = useCallback(() => setActiveTab("universo"), [setActiveTab]);
  const handleSurveyChange = useCallback((c: boolean) => setSurveyCompleted(c), []);

  const handleEpisodeGenerated = useCallback((episode: EpisodeSummary) => {
    setRecentEpisodes((prev) => [episode, ...prev.filter((e) => e.id !== episode.id)].slice(0, 3));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A574]" />
      </div>
    );
  }

  return (
    <div className="min-h-full text-[#1A1614] pb-20 md:pb-0">
      {/* ── Sub-tabs (For You / History) — mobile only ── */}
      {(activeTab === "hoy" || activeTab === "historial") && (
        <div className="sticky top-0 z-30 bg-white/30 backdrop-blur-xl md:hidden" role="tablist" aria-label="Sub-secciones">
          <div className="flex items-center gap-6 px-5 py-3">
            <button
              onClick={() => setActiveTab("hoy")}
              className={`relative text-[16px] font-medium transition-all duration-500 ease-out ${
                activeTab === "hoy" ? "text-[#1A1614]" : "text-[#9B8E84] hover:text-[#6B5D54]"
              }`}
            >
              Para ti
              {activeTab === "hoy" && (
                <span className="absolute -bottom-3 left-0 right-0 h-[2px] rounded-full bg-[#E07856]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("historial")}
              className={`relative text-[16px] font-medium transition-all duration-500 ease-out ${
                activeTab === "historial" ? "text-[#1A1614]" : "text-[#9B8E84] hover:text-[#6B5D54]"
              }`}
            >
              Historial
              {activeTab === "historial" && (
                <span className="absolute -bottom-3 left-0 right-0 h-[2px] rounded-full bg-[#E07856]" />
              )}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => {
                /* refresh */
              }}
              className="text-[#9B8E84] hover:text-[#1A1614] transition-all duration-500 ease-out"
              aria-label="Actualizar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {(activeTab === "perfil") && (
        <div className="sticky top-0 z-30 bg-white/30 backdrop-blur-xl md:hidden" role="tablist">
          <div className="flex items-center gap-6 px-5 py-3">
            <button className="relative text-[16px] font-medium text-[#1A1614]">
              Mi Perfil
              <span className="absolute -bottom-3 left-0 right-0 h-[2px] rounded-full bg-[#E07856]" />
            </button>
          </div>
        </div>
      )}

      {/* ── Tab panels ── */}
      <div id={`panel-${activeTab}`} role="tabpanel">
        {activeTab === "hoy" && (
          <HoyTab
            greeting={greeting}
            displayName={displayName}
            todayEpisode={todayEpisode}
            weeklyDigest={weeklyDigest}
            recentEpisodes={recentEpisodes}
            hasPreferences={hasPreferences}
            schedule={schedule}
            showInstallBanner={showInstallBanner}
            surveyCompleted={surveyCompleted}
            onInstall={handleInstall}
            onDismissInstall={dismissInstall}
            onSwitchToHistorial={switchToHistorial}
            onSwitchToPerfil={switchToPerfil}
            onSwitchToUniverso={switchToUniverso}
            onEpisodeGenerated={handleEpisodeGenerated}
          />
        )}

        {activeTab === "historial" && userId && (
          <HistorialTab userId={userId} />
        )}

        {activeTab === "descubrir" && (
          <DescubrirTab trending={trending} />
        )}

        {activeTab === "universo" && <UniversoTab />}

        {activeTab === "perfil" && (
          <PerfilTab onNameChange={setProfileName} onSurveyChange={handleSurveyChange} />
        )}
      </div>

      {/* ── Bottom floating capsule nav — MOBILE ONLY ── */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <nav className="bottom-nav-capsule flex items-center gap-1 rounded-full px-2 py-2" role="tablist" aria-label="Navegación principal">
          {/* Home pill */}
          <button
            role="tab"
            aria-selected={activeTab === "hoy" || activeTab === "historial"}
            onClick={() => setActiveTab("hoy")}
            className={`flex items-center justify-center rounded-full px-8 py-2.5 transition-all duration-500 ease-out ${
              activeTab === "hoy" || activeTab === "historial"
                ? "bg-[#E07856]/10 text-[#E07856]"
                : "text-[#9B8E84] hover:text-[#6B5D54]"
            }`}
          >
            <Home className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Discover pill */}
          <button
            role="tab"
            aria-selected={activeTab === "descubrir" || activeTab === "universo"}
            onClick={() => setActiveTab("descubrir")}
            className={`flex items-center justify-center rounded-full px-8 py-2.5 transition-all duration-500 ease-out ${
              activeTab === "descubrir" || activeTab === "universo"
                ? "bg-[#E07856]/10 text-[#E07856]"
                : "text-[#9B8E84] hover:text-[#6B5D54]"
            }`}
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Profile pill */}
          <button
            role="tab"
            aria-selected={activeTab === "perfil"}
            onClick={() => setActiveTab("perfil")}
            className={`flex items-center justify-center rounded-full px-8 py-2.5 transition-all duration-500 ease-out ${
              activeTab === "perfil"
                ? "bg-[#E07856]/10 text-[#E07856]"
                : "text-[#9B8E84] hover:text-[#6B5D54]"
            }`}
          >
            <User className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* + circular button */}
          <button
            onClick={() => setActiveTab("universo")}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:bg-[#C96A4A]"
            aria-label="Crear"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </nav>
      </div>
    </div>
  );
}
