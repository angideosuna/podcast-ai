"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  X,
  SkipBack,
  SkipForward,
  Mic,
} from "lucide-react";
import { parseDialogueSegments, type DialogueSegment } from "@/lib/tts-utils";
import { getTopicById } from "@/lib/topics";
import { useVoiceInteraction } from "@/hooks/use-voice-interaction";

// ── Cover gradient (warm fallback when no image) ─────────────────────────

function getCoverGradient(): string {
  return "linear-gradient(135deg, #E07856 0%, #F5D5B8 60%, #D4A574 100%)";
}

// ── Types ─────────────────────────────────────────────────────────────────

interface FullscreenPlayerProps {
  audioUrl: string;
  script: string;
  episodeTitle: string;
  topics: string[];
  coverImageUrl?: string;
  episodeId?: string;
  deepcastId?: string;
  onClose: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FullscreenPlayer({
  audioUrl,
  script,
  episodeTitle,
  topics,
  coverImageUrl,
  episodeId,
  deepcastId,
  onClose,
}: FullscreenPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  // Parse dialogue segments (keep for voice interaction context)
  const segments: DialogueSegment[] = useMemo(() => {
    return parseDialogueSegments(script);
  }, [script]);

  // Audio setup
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("ended", () => { setIsPlaying(false); setCurrentTime(0); });

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeAttribute("src");
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seekRelative = (seconds: number) => {
    if (!audioRef.current) return;
    const t = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform: 32 bars, random seeds
  const barSeeds = useMemo(() => Array.from({ length: 32 }, () => Math.random()), []);

  // Voice interaction
  const { state: voiceState, isSupported: voiceSupported, startListening, stopListening, dismissError } = useVoiceInteraction({
    episodeId,
    deepcastId,
    episodeContext: {
      title: episodeTitle,
      topics,
      script,
    },
    getCurrentTime: () => audioRef.current?.currentTime ?? 0,
    onAnswerStart: () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    },
    onAnswerEnd: () => {
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    },
  });

  // Topic labels joined by " · "
  const topicLabels = topics.slice(0, 4).map((t) => {
    const topic = getTopicById(t);
    return topic?.nombre || t;
  }).join(" \u00B7 ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto huxe-bg"
      style={{ animation: "huxe-player-in 600ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes huxe-player-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes huxe-pulse-warm {
          0%, 100% { transform: scale(1); background-color: rgba(224, 120, 86, 0.10); }
          50% { transform: scale(1.05); background-color: rgba(224, 120, 86, 0.25); }
        }
      `}</style>

      {/* Close button — top right, no background */}
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 cursor-pointer text-[#6B5D54] transition-all duration-500 ease-out hover:text-[#1A1614]"
      >
        <X className="h-6 w-6" strokeWidth={1.5} />
      </button>

      {/* Main content — single column, centered */}
      <div className="flex w-full max-w-md flex-col items-center px-6 py-12">

        {/* ── Cover ── */}
        <div
          className="relative h-[320px] w-[320px] overflow-hidden rounded-3xl lg:h-[400px] lg:w-[400px] shrink-0"
          style={{
            background: coverImageUrl ? undefined : getCoverGradient(),
            boxShadow: "0 12px 40px rgba(224, 120, 86, 0.08)",
          }}
        >
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* ── Title ── */}
        <h2
          className="mt-8 text-center text-[32px] leading-[1.05] text-[#1A1614] line-clamp-2 lg:text-[40px]"
          style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
        >
          {episodeTitle}
        </h2>

        {/* ── Topics — plain text, no pills ── */}
        {topicLabels && (
          <p className="mt-3 text-center text-[13px] font-medium text-[#6B5D54]">
            {topicLabels}
          </p>
        )}

        {/* ── Waveform ── */}
        <div className="relative mt-10 flex h-8 w-[80%] items-end justify-center gap-[3px]">
          {barSeeds.map((seed, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full"
              style={{
                height: isPlaying
                  ? `${Math.max(4, seed * 28)}px`
                  : "4px",
                backgroundColor: isPlaying ? "#E07856" : "#E8DFD3",
                opacity: isPlaying ? 0.5 + seed * 0.5 : 1,
                transition: "height 80ms ease-out, background-color 300ms, opacity 300ms",
              }}
            />
          ))}

          {/* Voice answering overlay */}
          {(voiceState.isProcessing || voiceState.isAnswering) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#E07856]" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#E07856]" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-[#E07856]" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-xs font-medium text-[#E07856]">
                  {voiceState.isProcessing ? "Pensando..." : "Respondiendo"}
                </p>
                {voiceState.transcript && (
                  <p className="max-w-[200px] text-center text-[11px] italic text-[#6B5D54]">
                    &ldquo;{voiceState.transcript}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="mt-10 flex items-center gap-8">
          <button
            onClick={() => seekRelative(-15)}
            className="cursor-pointer text-[#6B5D54] transition-all duration-500 ease-out hover:text-[#1A1614]"
          >
            <SkipBack className="h-7 w-7" strokeWidth={1.5} />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" strokeWidth={1.5} />
            ) : (
              <Play className="ml-1 h-7 w-7" strokeWidth={1.5} />
            )}
          </button>

          <button
            onClick={() => seekRelative(15)}
            className="cursor-pointer text-[#6B5D54] transition-all duration-500 ease-out hover:text-[#1A1614]"
          >
            <SkipForward className="h-7 w-7" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Voice mic button ── */}
        {voiceSupported && (episodeId || deepcastId) && (
          <button
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={stopListening}
            disabled={!episodeId && !deepcastId}
            className="mt-6 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border border-[#E07856]/20 transition-all duration-500 ease-out disabled:opacity-30"
            style={{
              animation: voiceState.isListening
                ? "huxe-pulse-warm 1.5s ease-in-out infinite"
                : undefined,
              backgroundColor: voiceState.isListening
                ? "rgba(224, 120, 86, 0.25)"
                : "rgba(224, 120, 86, 0.10)",
            }}
          >
            <Mic className="h-6 w-6 text-[#E07856]" strokeWidth={1.5} />
          </button>
        )}

        {/* Voice error */}
        {voiceState.error && (
          <button
            onClick={dismissError}
            className="mt-3 cursor-pointer rounded-full bg-[#E07856]/10 px-4 py-1.5 text-[11px] text-[#E07856] transition-all duration-500 ease-out hover:bg-[#E07856]/20"
          >
            {voiceState.error}
          </button>
        )}

        {/* ── Speed — plain text ── */}
        <button
          onClick={cycleSpeed}
          className="mt-6 cursor-pointer text-[13px] text-[#6B5D54] transition-all duration-500 ease-out hover:text-[#1A1614]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {speed}x
        </button>

        {/* ── Progress bar ── */}
        <div className="mt-8 w-full space-y-2">
          <div
            ref={progressRef}
            className="group relative h-[2px] w-full cursor-pointer rounded-full bg-[#E8DFD3] transition-all duration-200 hover:h-1"
            onClick={handleProgressClick}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#E07856]"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#E07856] opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[13px] text-[#6B5D54]" style={{ fontVariantNumeric: "tabular-nums" }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
