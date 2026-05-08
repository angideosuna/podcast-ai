"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { BrowserAudioPlayer } from "@/components/browser-audio-player";
import { AdjustEpisode } from "@/components/adjust-episode";
import { EpisodeFeedback } from "@/components/episode-feedback";
import { FullscreenPlayer } from "@/components/fullscreen-player";
import {
  Loader2,
  Share2,
  Check,
  Play,
  Download,
  X,
  Clock,
  RefreshCw,
  Globe,
  Lock,
  Sparkles,
  Mic,
  ArrowRight,
  AlertCircle,
  FileText,
  ChevronRight,
  Sun,
} from "lucide-react";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import dynamic from "next/dynamic";
import type { EpisodeSummary, Article, Preferences, LoadingPhase } from "@/lib/types";

const DeepCastSection = dynamic(() => import("@/components/deepcast-section").then(m => m.DeepCastSection), { ssr: false });

// ─── Types ───────────────────────────────────────────────────

interface Schedule {
  time: string;
  frequency: string;
  custom_days: number[];
  is_active: boolean;
}

interface HoyTabProps {
  greeting: string;
  displayName: string;
  todayEpisode: EpisodeSummary | undefined;
  weeklyDigest: EpisodeSummary | undefined;
  recentEpisodes: EpisodeSummary[];
  hasPreferences: boolean;
  schedule: Schedule | null;
  showInstallBanner: boolean;
  surveyCompleted: boolean;
  onInstall: () => void;
  onDismissInstall: () => void;
  onSwitchToHistorial: () => void;
  onSwitchToPerfil: () => void;
  onSwitchToUniverso: () => void;
  onEpisodeGenerated: (episode: EpisodeSummary) => void;
}

const SCHEDULE_PROMPT_KEY = "wavecast_schedule_prompt_count";

// ─── Helpers ─────────────────────────────────────────────────

function getWeatherLabel(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Despejado";
  if (h >= 12 && h < 15) return "Soleado";
  if (h >= 15 && h < 20) return "Atardecer";
  return "Noche";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════
// HOY TAB
// ═══════════════════════════════════════════════════════════════

export function HoyTab({
  greeting,
  displayName,
  todayEpisode,
  weeklyDigest,
  recentEpisodes,
  hasPreferences,
  schedule,
  showInstallBanner,
  onInstall,
  onDismissInstall,
  onSwitchToHistorial,
  onSwitchToPerfil,
  onSwitchToUniverso,
  onEpisodeGenerated,
  surveyCompleted,
}: HoyTabProps) {
  const router = useRouter();

  // ─── Generation state ──────────────────────────────────────
  const [phase, setPhase] = useState<LoadingPhase | "idle">("idle");
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [generatedArticles, setGeneratedArticles] = useState<Article[]>([]);
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const adjustmentsRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Public toggle state
  const [isPublic, setIsPublic] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);

  // Schedule suggestion state
  const [schedulePromptState, setSchedulePromptState] = useState<"hidden" | "visible" | "activating" | "confirmed">("hidden");

  // Fullscreen player state
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Cover image state
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  // Audio generation state (ElevenLabs)
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioGenerating, setAudioGenerating] = useState(false);

  // Transcript visibility
  const [showTranscript, setShowTranscript] = useState(false);

  // Generating sub-phase for animated dots
  const [genSubPhase, setGenSubPhase] = useState(0);

  // Sync isPublic from todayEpisode
  useEffect(() => {
    if (todayEpisode) setIsPublic(!!todayEpisode.is_shared);
  }, [todayEpisode]);

  // Load preferences on mount
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            if (!data.preferences.voice) data.preferences.voice = "female";
            setPreferences(data.preferences);
            localStorage.setItem("podcast-ai-preferences", JSON.stringify(data.preferences));
            return;
          }
        }
      } catch { /* fallback */ }

      const saved = localStorage.getItem("podcast-ai-preferences");
      if (saved) {
        try { setPreferences(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
    loadPrefs();
  }, []);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Generating sub-phase animation
  useEffect(() => {
    if (phase === "news") {
      setGenSubPhase(0);
      const t1 = setTimeout(() => setGenSubPhase(1), 1200);
      return () => clearTimeout(t1);
    }
    if (phase === "script") {
      setGenSubPhase(1);
      const t2 = setTimeout(() => setGenSubPhase(2), 4000);
      return () => clearTimeout(t2);
    }
    setGenSubPhase(0);
  }, [phase]);

  // Show schedule suggestion after successful generation
  useEffect(() => {
    if (phase !== "done") {
      if (schedulePromptState !== "confirmed") setSchedulePromptState("hidden");
      return;
    }
    if (schedule?.is_active) return;
    if (schedulePromptState === "confirmed") return;
    const count = parseInt(localStorage.getItem(SCHEDULE_PROMPT_KEY) || "0", 10);
    if (count >= 3) return;
    const timer = setTimeout(() => setSchedulePromptState("visible"), 800);
    return () => clearTimeout(timer);
  }, [phase, schedule, schedulePromptState]);

  const handleActivateDaily = useCallback(async () => {
    setSchedulePromptState("activating");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: "08:00", frequency: "daily", custom_days: [], is_active: true }),
      });
      if (!res.ok) throw new Error();
      setSchedulePromptState("confirmed");
    } catch {
      setSchedulePromptState("visible");
    }
  }, []);

  const handleDismissSchedulePrompt = useCallback(() => {
    const count = parseInt(localStorage.getItem(SCHEDULE_PROMPT_KEY) || "0", 10);
    localStorage.setItem(SCHEDULE_PROMPT_KEY, String(count + 1));
    setSchedulePromptState("hidden");
  }, []);

  const generatePodcast = useCallback(async (prefs: Preferences) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    setError("");

    try {
      setPhase("news");
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
        if (response.status === 401) { router.push("/login"); return; }
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al generar el podcast");
      }

      const data = await response.json();
      setGeneratedScript(data.script);
      setGeneratedArticles(data.articles);
      if (data.episodeId) setGeneratedEpisodeId(data.episodeId);
      setCoverImageUrl(null);
      setAudioUrl(null);
      setPhase("done");

      // Auto-generate audio with ElevenLabs
      if (data.script && data.episodeId) {
        setAudioGenerating(true);
        fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: data.script,
            episodeId: data.episodeId,
          }),
        })
          .then(async (audioRes) => {
            if (audioRes.ok) {
              const blob = await audioRes.blob();
              const url = URL.createObjectURL(blob);
              setAudioUrl(url);
            }
          })
          .catch(() => {})
          .finally(() => setAudioGenerating(false));
      }

      // Delayed fetch: cover image
      if (data.episodeId) {
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/episodes/${data.episodeId}/cover`);
            if (res.ok) {
              const coverData = await res.json();
              if (coverData.cover_image_url) setCoverImageUrl(coverData.cover_image_url);
            }
          } catch { /* silent */ }
        }, 5000);
      }

      // Notify parent
      if (data.episodeId) {
        onEpisodeGenerated({
          id: data.episodeId,
          title: `Podcast del ${new Date().toLocaleDateString("es-ES")}`,
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          audio_url: null,
          is_shared: false,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error desconocido");
      setPhase("error");
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [router, onEpisodeGenerated]);

  const handleShare = useCallback(async () => {
    const eid = generatedEpisodeId || todayEpisode?.id;
    if (!eid) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: eid }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.is_shared) {
        const shareUrl = `${window.location.origin}/shared/${eid}`;
        if (navigator.share) {
          await navigator.share({ title: "Mi podcast del día — WaveCast", text: "Escucha este podcast generado con IA", url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch { /* silent */ } finally { setShareLoading(false); }
  }, [generatedEpisodeId, todayEpisode?.id]);

  const handleTogglePublic = useCallback(async () => {
    const eid = generatedEpisodeId || todayEpisode?.id;
    if (!eid) return;
    setPublicLoading(true);
    const prev = isPublic;
    setIsPublic(!prev);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: eid }),
      });
      if (!res.ok) { setIsPublic(prev); return; }
      const data = await res.json();
      setIsPublic(data.is_shared);
    } catch {
      setIsPublic(prev);
    } finally {
      setPublicLoading(false);
    }
  }, [generatedEpisodeId, todayEpisode?.id, isPublic]);

  // ─── Extract episode title from script ─────────────────────
  const episodeTitle = (() => {
    if (!generatedScript) return "Tu podcast del día";
    const match = generatedScript.match(/^#\s+(.+)/m);
    if (match) {
      const clean = match[1].replace(/^[🎙️🎧📰✨🔥💡]+\s*/, "").replace(/\s*[🎙️🎧📰✨🔥💡]+$/, "").trim();
      return clean || match[1].trim();
    }
    return "Tu podcast del día";
  })();

  // ═══════════════════════════════════════════════════════════
  // RENDER: GENERATING STATE
  // ═══════════════════════════════════════════════════════════

  if (phase === "news" || phase === "script") {
    const PHASE_TEXTS = [
      "Recopilando noticias de hoy...",
      "Alex y Sara preparan el guion...",
      "Casi listo...",
    ];

    return (
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl glass-card p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Waveform bars */}
            <div className="flex items-end gap-1">
              {[8, 16, 24, 16, 8].map((baseH, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-[#7C3AED]/40"
                  style={{
                    height: `${baseH}px`,
                    animation: `barPulse 1.2s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>

            {/* Phase text */}
            <p className="text-sm text-[#6B7280]">
              {PHASE_TEXTS[genSubPhase]}
            </p>

            {/* Phase indicators */}
            <div className="flex items-center gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full transition-all duration-500 ${
                      i < genSubPhase
                        ? "bg-[#111827]"
                        : i === genSubPhase
                          ? "bg-[#111827] animate-pulse"
                          : "bg-[#D1D5DB]"
                    }`}
                  />
                  {i < 2 && <div className={`h-px w-8 transition-colors duration-500 ${i < genSubPhase ? "bg-[#6B7280]" : "bg-[#E5E7EB]"}`} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: ERROR STATE
  // ═══════════════════════════════════════════════════════════

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 glass-card p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">Ha ocurrido un error</h2>
            <p className="mt-2 text-sm text-red-400">{error}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
              disabled={isGenerating}
              className="btn-huxe px-6"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="btn-huxe-outline px-6"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: DONE STATE — Episode card
  // ═══════════════════════════════════════════════════════════

  if (phase === "done" && generatedScript) {
    const topicsList = preferences?.topics ?? [];

    return (
      <div className="mx-auto max-w-6xl px-5 pb-32 pt-6 lg:px-8">
        {/* Episode cover — clickable to open fullscreen */}
        <div
          className="group relative cursor-pointer overflow-hidden rounded-3xl"
          onClick={() => setShowFullscreen(true)}
        >
          <div className="relative flex h-[220px] items-center justify-center">
            <EpisodeThumbnail topics={topicsList} size="lg" coverImageUrl={coverImageUrl ?? undefined} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all duration-200 group-hover:bg-black/30">
              <div className="flex items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black/40 text-base font-extrabold text-white font-[family-name:var(--font-montserrat)]">
                  A
                </div>
                <div className="-ml-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black/40 text-base font-extrabold text-white font-[family-name:var(--font-montserrat)]">
                  S
                </div>
              </div>
              <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md opacity-0 transition-all duration-200 group-hover:opacity-100">
                <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-5 text-xl font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">
          {episodeTitle}
        </h1>

        {/* Topic pills */}
        {topicsList.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {topicsList.slice(0, 5).map((t) => {
              const topic = getTopicById(t);
              return (
                <span key={t} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] font-medium text-[#6B7280]">
                  {topic?.nombre || t}
                </span>
              );
            })}
            {preferences && (
              <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] font-medium text-[#6B7280]">
                <Clock className="mr-1 inline h-3 w-3" />{preferences.duration} min
              </span>
            )}
          </div>
        )}

        {/* Transcript toggle */}
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 glass-card px-4 py-3 text-[13px] font-semibold text-[#6B7280] transition-all duration-200 hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <FileText className="h-4 w-4" />
          {showTranscript ? "Ocultar transcripción" : "Ver transcripción"}
        </button>
        {showTranscript && (
          <div className="mt-3 glass-card p-6 sm:p-8">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedScript) }} />
          </div>
        )}

        {/* Actions row */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (preferences && !isGenerating) {
                adjustmentsRef.current = null;
                generatePodcast(preferences);
              }
            }}
            disabled={isGenerating}
            className="btn-huxe-ghost flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerar
          </button>
          <AdjustEpisode
            onAdjust={async (adjustments) => {
              if (!preferences) return;
              adjustmentsRef.current = adjustments;
              await generatePodcast(preferences);
              adjustmentsRef.current = null;
            }}
          />
          {(generatedEpisodeId || todayEpisode?.id) && (
            <>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="btn-huxe-ghost flex items-center gap-1.5 disabled:opacity-50"
              >
                {copied ? <><Check className="h-3.5 w-3.5 text-[#7C3AED]" /> Copiado</> : <><Share2 className="h-3.5 w-3.5" /> Compartir</>}
              </button>
              <button
                onClick={handleTogglePublic}
                disabled={publicLoading}
                className={`btn-huxe-ghost flex items-center gap-1.5 disabled:opacity-50 ${
                  isPublic ? "!bg-[#7C3AED]/15 !text-[#7C3AED]" : ""
                }`}
              >
                {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {isPublic ? "Público" : "Hacer público"}
              </button>
            </>
          )}
        </div>

        {/* Feedback */}
        {generatedEpisodeId && (
          <div className="mt-6">
            <EpisodeFeedback episodeId={generatedEpisodeId} />
          </div>
        )}

        {/* Sources */}
        {generatedArticles.length > 0 && (
          <div className="mt-6 glass-card p-5">
            <p className="mb-3 text-[13px] font-semibold text-[#6B7280]">
              Basado en {generatedArticles.length} noticias
            </p>
            <div className="flex flex-wrap gap-1.5">
              {generatedArticles.map((article, i) => (
                <a
                  key={article.url || i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[11px] text-[#6B7280] transition-all duration-200 hover:bg-[#E5E7EB] hover:text-[#111827]"
                >
                  {article.source}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Schedule suggestion banner */}
        {schedulePromptState !== "hidden" && (
          <div className="mt-6 overflow-hidden glass-card p-5">
            {schedulePromptState === "confirmed" ? (
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-[#7C3AED]" />
                <p className="text-[14px] font-medium text-[#111827]">Listo. Mañana a las 8:00 tendrás tu podcast esperándote</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6]">
                    <Clock className="h-5 w-5 text-[#6B7280]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#111827]">¿Te ha gustado? Recíbelo cada mañana</p>
                    <p className="mt-0.5 text-[13px] text-[#9CA3AF]">Programa tu podcast diario y empieza cada día informado</p>
                  </div>
                  <button
                    onClick={handleDismissSchedulePrompt}
                    className="btn-icon-circle h-8 w-8 shrink-0"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleActivateDaily}
                    disabled={schedulePromptState === "activating"}
                    className="btn-huxe px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {schedulePromptState === "activating" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                    Activar podcast diario a las 8:00
                  </button>
                  <button
                    onClick={onSwitchToPerfil}
                    className="cursor-pointer text-[13px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
                  >
                    Personalizar horario
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Audio player */}
        {audioGenerating && (
          <div className="fixed bottom-24 left-0 right-0 z-50 flex items-center justify-center gap-3 border-t border-[#E5E7EB] bg-white/95 shadow-md border border-[#E5E7EB] px-4 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
            <span className="text-[13px] text-[#6B7280]">Generando audio con voces reales...</span>
          </div>
        )}
        {audioUrl ? (
          <div className="fixed bottom-24 left-0 right-0 z-50 border-t border-[#E5E7EB] bg-white/95 shadow-md border border-[#E5E7EB] px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <span className="shrink-0 text-[13px] font-semibold text-[#111827]">{episodeTitle}</span>
              <audio src={audioUrl} controls className="h-10 flex-1" style={{ filter: "invert(1) hue-rotate(145deg)" }} />
            </div>
          </div>
        ) : !audioGenerating && preferences ? (
          <BrowserAudioPlayer script={generatedScript} voice={preferences.voice} episodeId={generatedEpisodeId ?? undefined} episodeTitle={episodeTitle} topics={topicsList} />
        ) : null}

        {/* Fullscreen player overlay */}
        {showFullscreen && (audioUrl || todayEpisode?.audio_url) && (
          <FullscreenPlayer
            audioUrl={audioUrl || todayEpisode!.audio_url!}
            script={generatedScript}
            episodeTitle={episodeTitle}
            topics={topicsList}
            coverImageUrl={coverImageUrl ?? undefined}
            episodeId={generatedEpisodeId ?? todayEpisode?.id}
            onClose={() => setShowFullscreen(false)}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: IDLE STATE — Huxe Home
  // ═══════════════════════════════════════════════════════════

  const dateStr = getFormattedDate();
  const weather = getWeatherLabel();

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-4 lg:px-8">
      {/* PWA Install */}
      {showInstallBanner && (
        <div className="flex items-center gap-3 glass-card p-4">
          <Download className="h-5 w-5 shrink-0 text-[#6B7280]" />
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#111827]">Instala WaveCast</p>
            <p className="text-[12px] text-[#9CA3AF]">Acceso rápido y experiencia nativa</p>
          </div>
          <button onClick={onInstall} className="btn-huxe px-4 py-1.5 text-[13px]">Instalar</button>
          <button onClick={onDismissInstall} className="btn-icon-circle h-8 w-8"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Profile incomplete banner */}
      {!surveyCompleted && (
        <div className="flex items-center gap-3 glass-card p-4">
          <Sparkles className="h-5 w-5 shrink-0 text-[#6B7280]" />
          <p className="flex-1 text-[14px] font-medium text-[#111827]">Completa tu perfil para podcasts más personalizados</p>
          <button onClick={onSwitchToPerfil} className="btn-huxe px-4 py-1.5 text-[13px]">Completar</button>
        </div>
      )}

      {/* ═══ Hero — Colorful gradient background with greeting ═══ */}
      <div className="relative -mx-5 lg:-mx-8 -mt-4 mb-2 overflow-hidden rounded-b-[2rem] px-6 pb-12 pt-10"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 30%, #F97316 60%, #06B6D4 100%)" }}
      >
        <div className="relative z-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white font-[family-name:var(--font-display)] leading-tight">
              {greeting},<br />{displayName}
            </h1>
            <p className="mt-2 text-[15px] text-white/60">{dateStr}</p>

            {/* Weather + Play pill (Huxe style) */}
            <div className="mt-6 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[14px] text-white/60">
                <Sun className="h-4 w-4" /> {weather}
              </span>
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={() => {
              if (todayEpisode) {
                router.push(`/historial/${todayEpisode.id}`);
              } else if (preferences && !isGenerating) {
                generatePodcast(preferences);
              } else if (!hasPreferences) {
                router.push("/onboarding");
              }
            }}
            disabled={isGenerating}
            className="mt-6 lg:mt-0 w-full lg:w-auto rounded-full bg-[#7C3AED] px-6 lg:px-8 py-3.5 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#6D28D9] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4 fill-white" />
            {todayEpisode ? "Reproducir" : "Generar mi podcast"}
          </button>
        </div>
      </div>

      {/* ═══ DeepCast section ═══ */}
      <DeepCastSection />

      {/* ═══ Keep listening / Today's episode ═══ */}
      {todayEpisode && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[#111827]">
            <Clock className="h-4 w-4 text-[#9CA3AF]" />
            Sigue escuchando
          </h2>
          <Link
            href={`/historial/${todayEpisode.id}`}
            className="group flex gap-4 glass-card-warm p-4 transition-all duration-200 hover:scale-[1.01]"
          >
            <div className="relative shrink-0">
              <EpisodeThumbnail topics={todayEpisode.topics} size="md" />
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-8 w-8 fill-white text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-[#111827]">{todayEpisode.title}</h3>
              <p className="mt-0.5 truncate text-[13px] text-[#9CA3AF]">
                {todayEpisode.topics.map(topicId => { const t = getTopicById(topicId); return t ? t.nombre : topicId; }).join(", ")}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-[12px] text-[#9CA3AF]">{todayEpisode.duration} min</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 self-center text-[#D1D5DB]" />
          </Link>
        </section>
      )}

      {/* ═══ Generate CTA (no episode yet) ═══ */}
      {!todayEpisode && hasPreferences && (
        <div className="glass-card-warm p-6 text-center">
          <Mic className="mx-auto mb-3 h-10 w-10 text-[#9CA3AF]" />
          <h3 className="text-lg font-bold text-[#111827]">Genera tu primer podcast</h3>
          <p className="mt-1 text-[13px] text-[#9CA3AF]">Alex y Sara te ponen al día con las últimas noticias</p>
          {preferences && preferences.topics.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {preferences.topics.slice(0, 4).map((t) => {
                const topic = getTopicById(t);
                return (
                  <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#9CA3AF]">
                    {topic?.nombre || t}
                  </span>
                );
              })}
            </div>
          )}
          <button
            onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
            disabled={isGenerating || !preferences}
            className="mt-5 btn-huxe w-full lg:w-auto flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white" />
            Generar ahora
          </button>
        </div>
      )}

      {!todayEpisode && !hasPreferences && (
        <div className="glass-card-warm p-6 text-center">
          <Mic className="mx-auto mb-3 h-10 w-10 text-[#9CA3AF]" />
          <p className="text-[14px] font-medium text-[#111827]">Configura tus preferencias para empezar</p>
          <button
            onClick={() => router.push("/onboarding")}
            className="mt-5 btn-huxe w-full lg:w-auto"
          >
            Configurar preferencias
          </button>
        </div>
      )}

      {/* ═══ Weekly Digest ═══ */}
      {weeklyDigest && !todayEpisode?.topics.includes("weekly-digest") && (
        <Link
          href={`/historial/${weeklyDigest.id}`}
          className="flex gap-4 glass-card-warm p-4 transition-all duration-200 hover:scale-[1.01] group"
        >
          <div className="relative shrink-0">
            <EpisodeThumbnail topics={["weekly-digest"]} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-[#111827]">Resumen de la semana</h3>
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">Semanal</span>
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[#9CA3AF]">{weeklyDigest.title}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 self-center text-[#D1D5DB]" />
        </Link>
      )}

      {/* ═══ Schedule ═══ */}
      {schedule?.is_active && (
        <div className="flex items-center gap-3 glass-card p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]">
            <Clock className="h-5 w-5 text-[#6B7280]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#111827]">
              Tu próximo podcast: {schedule.frequency === "daily" ? "todos los días" : schedule.frequency === "weekdays" ? "lunes a viernes" : "días seleccionados"} a las {schedule.time.slice(0, 5)}
            </p>
            <p className="text-[12px] text-[#9CA3AF]">Generación automática activada</p>
          </div>
        </div>
      )}

      {/* ═══ Recent episodes — horizontal scroll ═══ */}
      {recentEpisodes.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#111827]">Episodios recientes</h2>
            <button onClick={onSwitchToHistorial} className="cursor-pointer text-[13px] text-[#9CA3AF] transition-colors hover:text-[#111827]">Ver todo</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {recentEpisodes.map(episode => (
              <Link
                key={episode.id}
                href={`/historial/${episode.id}`}
                className="group flex flex-col overflow-hidden glass-card-warm transition-all duration-200 hover:scale-[1.02]"
              >
                <div className="relative">
                  <EpisodeThumbnail topics={episode.topics} size="sm" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-t-3xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-5 w-5 fill-white text-white" />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-[#111827]">{episode.title}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
                      {episode.duration} min
                    </span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {new Date(episode.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
