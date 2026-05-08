"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  X,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { parseDialogueSegments, type DialogueSegment } from "@/lib/tts-utils";
import { getTopicById } from "@/lib/topics";
import { useVoiceInteraction } from "@/hooks/use-voice-interaction";
import { VoiceMicButton } from "@/components/voice-mic-button";

// ── Topic → gradient mapping (mirrors episode-thumbnail.tsx) ──────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  tecnologia: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
  ciencia: "linear-gradient(135deg, #06b6d4 0%, #1d4ed8 100%)",
  "negocios-finanzas": "linear-gradient(135deg, #059669 0%, #0f766e 100%)",
  entretenimiento: "linear-gradient(135deg, #ec4899 0%, #7c3aed 100%)",
  "salud-bienestar": "linear-gradient(135deg, #22c55e 0%, #059669 100%)",
  "sociedad-cultura": "linear-gradient(135deg, #dc2626 0%, #ea580c 100%)",
  "true-crime-misterio": "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
  lifestyle: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
  custom: "linear-gradient(135deg, #4b5563 0%, #1f2937 100%)",
  "weekly-digest": "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
};

function getCoverGradient(topics: string[]): string {
  if (topics.includes("weekly-digest")) return CATEGORY_GRADIENTS["weekly-digest"];
  const first = topics[0];
  if (first) {
    const topic = getTopicById(first);
    if (topic?.categoryId && CATEGORY_GRADIENTS[topic.categoryId]) {
      return CATEGORY_GRADIENTS[topic.categoryId];
    }
  }
  return CATEGORY_GRADIENTS.custom;
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

  // Parse dialogue segments
  const segments: DialogueSegment[] = useMemo(() => {
    return parseDialogueSegments(script);
  }, [script]);

  const hasDualVoice = segments.length >= 2 && new Set(segments.map(s => s.speaker)).size >= 2;

  // Estimate active segment
  const currentSegmentIndex = useMemo(() => {
    if (!hasDualVoice || duration <= 0 || segments.length === 0) return -1;
    const segDur = duration / segments.length;
    return Math.min(Math.floor(currentTime / segDur), segments.length - 1);
  }, [hasDualVoice, duration, currentTime, segments]);

  const activeSpeaker = currentSegmentIndex >= 0 ? segments[currentSegmentIndex]?.speaker : null;

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
  const coverGradient = getCoverGradient(topics);

  // Waveform bar heights (randomized on mount, animated via CSS)
  const barSeeds = useMemo(() => Array.from({ length: 20 }, () => Math.random()), []);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/[0.10] text-white transition-all duration-200 hover:bg-white/[0.14]"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6 lg:max-w-3xl lg:flex-row lg:gap-12">
        {/* Cover */}
        <div
          className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-3xl lg:h-[360px] lg:w-[360px] shrink-0"
          style={{ background: coverGradient }}
        >
          {/* Cover image behind avatars */}
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          {/* Dual avatars */}
          <div className="flex items-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-white text-xl font-extrabold transition-all duration-300 font-[family-name:var(--font-montserrat)] ${
                isPlaying && activeSpeaker === "ALEX"
                  ? "bg-[#7C3AED] text-white scale-110 ring-2 ring-[#7C3AED] ring-offset-2 ring-offset-transparent"
                  : "bg-black/40 text-white"
              }`}
            >
              A
            </div>
            <div
              className={`-ml-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white text-xl font-extrabold transition-all duration-300 font-[family-name:var(--font-montserrat)] ${
                isPlaying && activeSpeaker === "SARA"
                  ? "bg-[#7C3AED] text-white scale-110 ring-2 ring-[#7C3AED] ring-offset-2 ring-offset-transparent"
                  : "bg-black/40 text-white"
              }`}
            >
              S
            </div>
          </div>
        </div>

        {/* Title + topics */}
        <div className="w-full text-center">
          <h2 className="text-2xl font-extrabold text-white font-[family-name:var(--font-montserrat)] line-clamp-2">
            {episodeTitle}
          </h2>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {topics.slice(0, 4).map((t) => {
              const topic = getTopicById(t);
              return (
                <span key={t} className="rounded-full bg-white/[0.10] px-2.5 py-0.5 text-[11px] text-white/50">
                  {topic?.nombre || t}
                </span>
              );
            })}
          </div>
        </div>

        {/* Waveform (with answering overlay) */}
        <div className="relative">
          <div className="flex h-8 items-end gap-[3px]">
            {barSeeds.map((seed, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full transition-all duration-150"
                style={{
                  height: isPlaying
                    ? `${Math.max(6, seed * 32)}px`
                    : "4px",
                  backgroundColor: isPlaying ? "#7C3AED" : "rgba(255,255,255,0.14)",
                  opacity: isPlaying ? 0.5 + seed * 0.5 : 0.4,
                }}
              />
            ))}
          </div>

          {/* Voice answering overlay */}
          {(voiceState.isProcessing || voiceState.isAnswering) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(0,0,0,0.85)" }}>
              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-green-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-green-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-green-400" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-xs font-bold text-[#7C3AED] font-[family-name:var(--font-montserrat)]">
                  {voiceState.isProcessing ? "Alex & Sara piensan..." : "Alex & Sara responden"}
                </p>
                {voiceState.transcript && (
                  <p className="max-w-[200px] text-center text-[11px] italic text-white/30">
                    &ldquo;{voiceState.transcript}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Speaker indicators */}
        {hasDualVoice && (
          <div className="flex w-full items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                  isPlaying && activeSpeaker === "ALEX"
                    ? "bg-[#7C3AED] text-white scale-110"
                    : "bg-white/[0.10] text-white/30"
                }`}
              >
                A
              </div>
              <span className={`text-[12px] font-[family-name:var(--font-montserrat)] ${activeSpeaker === "ALEX" ? "text-[#7C3AED]" : "text-white/30"}`}>
                Alex
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-[family-name:var(--font-montserrat)] ${activeSpeaker === "SARA" ? "text-[#7C3AED]" : "text-white/30"}`}>
                Sara
              </span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                  isPlaying && activeSpeaker === "SARA"
                    ? "bg-[#7C3AED] text-white scale-110"
                    : "bg-white/[0.10] text-white/30"
                }`}
              >
                S
              </div>
            </div>
          </div>
        )}

        {/* Segment text */}
        {hasDualVoice && currentSegmentIndex >= 0 && isPlaying && (
          <p className="max-w-sm text-center text-sm leading-relaxed text-white/50 line-clamp-2">
            {segments[currentSegmentIndex]?.text.slice(0, 150)}
            {(segments[currentSegmentIndex]?.text.length ?? 0) > 150 ? "..." : ""}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => seekRelative(-15)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/50 transition-all duration-200 hover:text-white"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-[#7C3AED] text-white transition-all duration-200 hover:scale-105 hover:bg-[#A855F7]"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="ml-1 h-7 w-7" />
            )}
          </button>

          <button
            onClick={() => seekRelative(15)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/50 transition-all duration-200 hover:text-white"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Voice mic button */}
        {voiceSupported && (episodeId || deepcastId) && (
          <VoiceMicButton
            isListening={voiceState.isListening}
            isProcessing={voiceState.isProcessing}
            isAnswering={voiceState.isAnswering}
            transcript={voiceState.transcript}
            onPress={startListening}
            onRelease={stopListening}
            disabled={!episodeId && !deepcastId}
          />
        )}

        {/* Voice error */}
        {voiceState.error && (
          <button
            onClick={dismissError}
            className="cursor-pointer rounded-xl bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 transition-colors hover:bg-red-500/20"
          >
            {voiceState.error} ✕
          </button>
        )}

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className="cursor-pointer rounded-full bg-white/[0.10] px-4 py-1.5 text-[12px] font-semibold text-white/50 transition-all duration-200 hover:bg-white/[0.14] hover:text-white font-[family-name:var(--font-montserrat)]"
        >
          {speed}x
        </button>

        {/* Progress bar */}
        <div className="w-full space-y-1.5">
          <div
            ref={progressRef}
            className="group relative h-1 w-full cursor-pointer rounded-full bg-white/[0.14] transition-all duration-200 hover:h-2"
            onClick={handleProgressClick}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#7C3AED]"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-white/30">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
