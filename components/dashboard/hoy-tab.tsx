"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { BrowserAudioPlayer } from "@/components/browser-audio-player";
import { AdjustEpisode } from "@/components/adjust-episode";
import { EpisodeFeedback } from "@/components/episode-feedback";
import {
  Loader2,
  Share2,
  Check,
  Play,
  Download,
  X,
  Headphones,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { EpisodeSummary, Article, Preferences, LoadingPhase } from "@/lib/types";

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
  onEpisodeGenerated: (episode: EpisodeSummary) => void;
}

const SCHEDULE_PROMPT_KEY = "wavecast_schedule_prompt_count";

const LOADING_MESSAGES: Record<string, { emoji: string; text: string }> = {
  news: { emoji: "📡", text: "Buscando noticias del día..." },
  script: { emoji: "✍️", text: "Generando tu guion personalizado..." },
  done: { emoji: "✅", text: "¡Listo!" },
  error: { emoji: "❌", text: "Ha ocurrido un error" },
};

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

  // Schedule suggestion state
  const [schedulePromptState, setSchedulePromptState] = useState<"hidden" | "visible" | "activating" | "confirmed">("hidden");

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

  // Show schedule suggestion after successful generation (no active schedule, shown < 3 times)
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
      setPhase("done");

      // Notify parent so todayEpisode updates
      if (data.episodeId) {
        onEpisodeGenerated({
          id: data.episodeId,
          title: `Podcast del ${new Date().toLocaleDateString("es-ES")}`,
          topics: prefs.topics,
          duration: prefs.duration,
          tone: prefs.tone,
          audio_url: null,
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

  // ─── RENDER: Loading state (generating) ─────────────────────

  if (phase === "news" || phase === "script") {
    const current = LOADING_MESSAGES[phase];
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-dark">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="text-6xl animate-bounce">{current.emoji}</div>
          <div>
            <h1 className="text-2xl font-bold">{current.text}</h1>
            <p className="mt-2 text-sm text-muted-light">Esto puede tardar unos segundos...</p>
          </div>
          <div className="mx-auto w-64 overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-2 rounded-full bg-forest transition-all duration-1000"
              style={{ width: phase === "news" ? "30%" : "70%" }}
            />
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <span className={phase === "news" ? "text-dark" : "text-muted-light"}>
              {phase === "news" ? "●" : "✓"} Noticias
            </span>
            <span className={phase === "script" ? "text-dark" : "text-muted-light"}>
              {phase === "script" ? "●" : "○"} Guion
            </span>
            <span className="text-muted-light">○ Listo</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Error state ────────────────────────────────────

  if (phase === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-dark">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">❌</div>
          <h1 className="text-2xl font-bold">Ha ocurrido un error</h1>
          <p className="text-muted">{error}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
              disabled={isGenerating}
              className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reintentar
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="cursor-pointer rounded-full border border-white/[0.08] px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Generated podcast ──────────────────────────────

  if (phase === "done" && generatedScript) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">🎙️</div>
          <h1 className="text-3xl font-bold">Tu podcast del día</h1>
          {preferences && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span className="rounded-full bg-cream-dark px-3 py-1">⏱️ {preferences.duration} min</span>
              <span className="rounded-full bg-cream-dark px-3 py-1">🎯 {preferences.tone}</span>
              <span className="rounded-full bg-cream-dark px-3 py-1">
                {preferences.voice === "male" ? "👨 Voz masculina" : "👩 Voz femenina"}
              </span>
            </div>
          )}
        </div>

        {/* Script */}
        <div className="glass-card p-6 sm:p-8">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedScript) }} />
        </div>

        {/* Sources */}
        {generatedArticles.length > 0 && (
          <div className="glass-card p-6 mt-8">
            <h2 className="mb-4 text-lg font-semibold text-dark">📰 Fuentes utilizadas</h2>
            <ul className="space-y-3">
              {generatedArticles.map((article, i) => (
                <li key={article.url || i} className="border-b border-white/[0.08] pb-3 last:border-0 last:pb-0">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="group block">
                    <p className="font-medium text-dark underline group-hover:text-forest transition-all duration-300">{article.title}</p>
                    <p className="mt-1 text-sm text-muted-light">{article.source} · {new Date(article.publishedAt).toLocaleDateString("es-ES")}</p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feedback */}
        {generatedEpisodeId && (
          <div className="mt-8">
            <EpisodeFeedback episodeId={generatedEpisodeId} />
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => {
              if (preferences && !isGenerating) {
                adjustmentsRef.current = null;
                generatePodcast(preferences);
              }
            }}
            disabled={isGenerating}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
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
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest disabled:opacity-50"
            >
              {copied ? <><Check className="h-4 w-4" /> Enlace copiado</> : <><Share2 className="h-4 w-4" /> Compartir</>}
            </button>
          )}
        </div>

        {/* Browser audio player */}
        {preferences && (
          <BrowserAudioPlayer script={generatedScript} voice={preferences.voice} />
        )}

        {/* Schedule suggestion banner */}
        {schedulePromptState !== "hidden" && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden rounded-2xl border border-forest/20 bg-forest/[0.05] p-5">
            {schedulePromptState === "confirmed" ? (
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0 text-forest" />
                <p className="text-sm font-medium">Listo. Mañana a las 8:00 tendrás tu podcast esperándote</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-2xl">🎧</span>
                  <div className="flex-1">
                    <p className="font-medium">¿Te ha gustado? Recíbelo cada mañana automáticamente</p>
                    <p className="mt-1 text-sm text-muted">Programa tu podcast diario y empieza cada día informado</p>
                  </div>
                  <button
                    onClick={handleDismissSchedulePrompt}
                    className="shrink-0 cursor-pointer text-muted transition-colors hover:text-dark"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleActivateDaily}
                    disabled={schedulePromptState === "activating"}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {schedulePromptState === "activating" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Activar podcast diario a las 8:00
                  </button>
                  <button
                    onClick={onSwitchToPerfil}
                    className="cursor-pointer text-sm font-medium text-forest underline underline-offset-2 transition-colors hover:text-forest-light"
                  >
                    Personalizar horario
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: Default dashboard view (idle) ──────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* PWA Install */}
      {showInstallBanner && (
        <div className="glass-card flex items-center gap-3 p-4">
          <Download className="h-5 w-5 shrink-0 text-forest" />
          <div className="flex-1">
            <p className="text-sm font-medium">Instala WaveCast en tu dispositivo</p>
            <p className="text-xs text-muted">Acceso rápido y experiencia nativa</p>
          </div>
          <button onClick={onInstall} className="cursor-pointer rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-white hover:bg-forest-light">Instalar</button>
          <button onClick={onDismissInstall} className="cursor-pointer text-muted hover:text-dark"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Banner perfil incompleto */}
      {!surveyCompleted && (
        <div className="glass-card flex items-center gap-3 p-4">
          <span className="text-xl">💡</span>
          <p className="flex-1 text-sm font-medium">Completa tu perfil para podcasts más personalizados</p>
          <button onClick={onSwitchToPerfil} className="cursor-pointer rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-white hover:bg-forest-light">Completar</button>
        </div>
      )}

      {/* Saludo */}
      <div>
        <h1 className="text-3xl font-bold">{greeting}, {displayName}</h1>
        <p className="mt-1 text-muted">{todayEpisode ? "Tu podcast de hoy está listo" : "Genera tu podcast personalizado del día"}</p>
      </div>

      {/* Episodio de hoy / Botón generar */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold">🎙️ Episodio de hoy</h2>
        {todayEpisode ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{todayEpisode.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {todayEpisode.topics.map(topicId => {
                  const t = getTopicById(topicId);
                  return (
                    <span key={topicId} className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs">
                      {t ? `${t.emoji} ${t.nombre}` : topicId}
                    </span>
                  );
                })}
              </div>
            </div>
            <Link href={`/historial/${todayEpisode.id}`} className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-light">
              <Play className="h-4 w-4" />Escuchar
            </Link>
          </div>
        ) : hasPreferences ? (
          <div className="text-center">
            <p className="mb-4 text-muted">Aún no has generado el podcast de hoy</p>
            <button
              onClick={() => preferences && !isGenerating && generatePodcast(preferences)}
              disabled={isGenerating || !preferences}
              className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎙️ Generar podcast de hoy
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="mb-4 text-muted">Configura tus preferencias para empezar</p>
            <button onClick={() => router.push("/onboarding")} className="cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-light">
              Configurar preferencias
            </button>
          </div>
        )}
      </div>

      {/* Weekly Digest */}
      {weeklyDigest && !todayEpisode?.topics.includes("weekly-digest") && (
        <Link href={`/historial/${weeklyDigest.id}`} className="glass-card flex items-center gap-4 p-5 transition-all duration-300 hover:bg-forest/5">
          <span className="text-3xl">📋</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">Tu resumen de la semana está listo</p>
              <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-semibold text-forest">Semanal</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">{weeklyDigest.title}</p>
          </div>
          <Play className="h-4 w-4 shrink-0 text-forest" />
        </Link>
      )}

      {/* Horario */}
      {schedule?.is_active ? (
        <div className="glass-card flex items-center gap-3 p-4">
          <span className="text-2xl">📅</span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Tu próximo podcast: {schedule.frequency === "daily" ? "todos los días" : schedule.frequency === "weekdays" ? "lunes a viernes" : "días seleccionados"} a las {schedule.time.slice(0, 5)}
            </p>
            <p className="text-xs text-muted">Generación automática activada</p>
          </div>
        </div>
      ) : null}

      {/* Últimos episodios */}
      {recentEpisodes.length > 0 && (
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Últimos episodios</h2>
            <button onClick={onSwitchToHistorial} className="cursor-pointer text-sm text-forest underline hover:text-forest-light">Ver todos →</button>
          </div>
          <ul className="space-y-3">
            {recentEpisodes.map(episode => (
              <li key={episode.id}>
                <Link href={`/historial/${episode.id}`} className="group flex items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3 transition-all duration-300 hover:border-forest/20 hover:bg-forest/5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-forest">{episode.title}</p>
                    <p className="mt-0.5 text-xs text-muted-light">
                      {new Date(episode.created_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {episode.duration} min
                    </p>
                  </div>
                  {episode.audio_url ? <Headphones className="ml-3 h-4 w-4 shrink-0" /> : <Clock className="ml-3 h-4 w-4 shrink-0 text-muted-light" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      {recentEpisodes.length > 0 && (
        <div className="flex gap-4">
          <div className="flex-1 glass-card p-4 text-center">
            <p className="text-2xl font-bold">{recentEpisodes.length}</p>
            <p className="text-xs text-muted">{recentEpisodes.length === 1 ? "episodio" : "episodios"}</p>
          </div>
          <div className="flex-1 glass-card p-4 text-center">
            <p className="text-2xl font-bold">{recentEpisodes.reduce((s, e) => s + e.duration, 0)}</p>
            <p className="text-xs text-muted">minutos generados</p>
          </div>
        </div>
      )}
    </div>
  );
}
