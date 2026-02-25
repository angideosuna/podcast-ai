"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mic, History, Compass, User } from "lucide-react";
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

type Tab = "hoy" | "historial" | "descubrir" | "perfil";

const TABS: { id: Tab; label: string; icon: React.ElementType; emoji: string }[] = [
  { id: "hoy", label: "Hoy", icon: Mic, emoji: "🎧" },
  { id: "historial", label: "Historial", icon: History, emoji: "📚" },
  { id: "descubrir", label: "Descubrir", icon: Compass, emoji: "🔍" },
  { id: "perfil", label: "Mi Perfil", icon: User, emoji: "👤" },
];

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("hoy");
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
        supabase.from("episodes").select("id, title, topics, duration, tone, audio_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
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

  const switchToHistorial = useCallback(() => setActiveTab("historial"), []);
  const switchToPerfil = useCallback(() => setActiveTab("perfil"), []);
  const handleSurveyChange = useCallback((c: boolean) => setSurveyCompleted(c), []);

  const handleEpisodeGenerated = useCallback((episode: EpisodeSummary) => {
    setRecentEpisodes((prev) => [episode, ...prev.filter((e) => e.id !== episode.id)].slice(0, 3));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-cream text-dark">
      {/* ── Tab bar ── */}
      <div className="sticky top-[53px] z-30 border-b border-white/10 bg-black" role="tablist" aria-label="Secciones del dashboard">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? "border-b-2 border-[#1DB954] text-white"
                  : "text-muted hover:text-dark"
              }`}
            >
              <span className="sm:hidden" aria-hidden="true">{tab.emoji}</span>
              <tab.icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

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
            onEpisodeGenerated={handleEpisodeGenerated}
          />
        )}

        {activeTab === "historial" && userId && (
          <HistorialTab userId={userId} />
        )}

        {activeTab === "descubrir" && (
          <DescubrirTab trending={trending} />
        )}

        {activeTab === "perfil" && (
          <PerfilTab onNameChange={setProfileName} onSurveyChange={handleSurveyChange} />
        )}
      </div>
    </div>
  );
}
