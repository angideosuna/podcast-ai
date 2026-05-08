"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  Loader2,
  RotateCcw,
  AlertCircle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { parseDialogueSegments, type DialogueSegment } from "@/lib/tts-utils";

interface AudioPlayerProps {
  audioUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  episodeId?: string;
  script?: string;
  episodeTitle?: string;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Animated waveform bars */
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-6">
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-[#E07856] transition-all duration-150"
          style={{
            height: active
              ? `${Math.max(4, Math.random() * 24)}px`
              : "4px",
            opacity: active ? 0.6 + Math.random() * 0.4 : 0.3,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Speaker avatar circle */
function SpeakerAvatar({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-all duration-500 ease-out ${
        active
          ? "bg-[#E07856] text-white ring-2 ring-[#E07856] ring-offset-2 ring-offset-white/60 scale-110"
          : "bg-[#F5EDE4] text-[#9B8E84]"
      }`}
    >
      {label}
    </div>
  );
}

export function AudioPlayer({
  audioUrl,
  isLoading,
  error,
  onRetry,
  episodeId,
  script,
  episodeTitle,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem("podcast-ai-playback-speed");
    const parsed = saved ? parseFloat(saved) : NaN;
    return SPEED_OPTIONS.includes(parsed) ? parsed : 1;
  });
  const [isDragging, setIsDragging] = useState(false);
  const metricsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenTimeRef = useRef(0);

  // Parse dialogue segments from script
  const segments: DialogueSegment[] = useMemo(() => {
    if (!script) return [];
    return parseDialogueSegments(script);
  }, [script]);

  const hasDualVoice = segments.length >= 2 && new Set(segments.map((s) => s.speaker)).size >= 2;

  // Estimate current segment based on time (divide duration equally)
  const currentSegmentIndex = useMemo(() => {
    if (!hasDualVoice || duration <= 0 || segments.length === 0) return -1;
    const segmentDuration = duration / segments.length;
    return Math.min(Math.floor(currentTime / segmentDuration), segments.length - 1);
  }, [hasDualVoice, duration, currentTime, segments]);

  const activeSpeaker = currentSegmentIndex >= 0 ? segments[currentSegmentIndex]?.speaker : null;

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeAttribute("src");
    };
  }, [audioUrl, isDragging]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Metrics tracking: send every 30 seconds while playing
  const sendMetrics = useCallback(() => {
    if (!episodeId || !audioRef.current) return;
    const audio = audioRef.current;
    const completionRate = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episode_id: episodeId,
        total_listen_time_seconds: Math.round(listenTimeRef.current),
        completion_rate: Math.round(completionRate * 100) / 100,
        playback_speed: speed,
      }),
    }).catch(() => {});
  }, [episodeId, speed]);

  useEffect(() => {
    if (isPlaying && episodeId) {
      const interval = setInterval(() => {
        listenTimeRef.current += 10;
      }, 10000);
      metricsTimerRef.current = setInterval(sendMetrics, 30000);
      return () => {
        clearInterval(interval);
        if (metricsTimerRef.current) clearInterval(metricsTimerRef.current);
      };
    } else if (!isPlaying && episodeId) {
      // Send metrics on pause
      sendMetrics();
    }
  }, [isPlaying, episodeId, sendMetrics]);

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

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIndex];
    setSpeed(newSpeed);
    localStorage.setItem("podcast-ai-playback-speed", String(newSpeed));
  };

  const seekRelative = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeek(e);

    const handleMouseMove = (e: MouseEvent) => {
      if (!audioRef.current || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      setCurrentTime(newTime);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      if (audioRef.current && progressRef.current) {
        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        audioRef.current.currentTime = percentage * duration;
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isLoading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/30 bg-white/60 backdrop-blur-xl shadow-[0_-2px_16px_rgba(180,140,100,0.08)] md:left-[72px] lg:left-[240px]">
        <div className="flex items-center justify-center gap-3 px-4 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#D4A574]" />
          <span className="text-sm text-[#9B8E84]">
            Generando audio del podcast...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/30 bg-white/60 backdrop-blur-xl shadow-[0_-2px_16px_rgba(180,140,100,0.08)] md:left-[72px] lg:left-[240px]">
        <div className="flex items-center justify-center gap-3 px-4 py-4">
          <AlertCircle className="h-5 w-5 text-red-600" strokeWidth={1.5} />
          <span className="text-sm text-[#9B8E84]">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex cursor-pointer items-center gap-1 rounded-full bg-[#F5EDE4] px-3 py-1.5 text-xs text-[#6B5D54] transition-all duration-500 ease-out hover:bg-[#E07856]/10 hover:text-[#E07856]"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!audioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/30 bg-white/60 backdrop-blur-xl shadow-[0_-2px_16px_rgba(180,140,100,0.08)] md:left-[72px] lg:left-[240px]">
      {/* Segment text display (only with dual voice) */}
      {hasDualVoice && currentSegmentIndex >= 0 && isPlaying && (
        <div className="border-b border-[#E8DFD3]/40 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[11px] font-medium text-[#E07856]">
              {activeSpeaker}
            </span>
            <p className="truncate text-[12px] text-[#6B5D54]">
              {segments[currentSegmentIndex]?.text.slice(0, 120)}
              {(segments[currentSegmentIndex]?.text.length ?? 0) > 120 ? "..." : ""}
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="group relative h-1 w-full cursor-pointer transition-all duration-500 ease-out hover:h-2"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 bg-[#E8DFD3]" />
        <div
          className="absolute inset-y-0 left-0 bg-[#E07856]"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#E07856] opacity-0 shadow-md transition-opacity duration-500 group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Speaker avatars (only with dual voice) */}
        {hasDualVoice && (
          <div className="hidden sm:flex items-center gap-1.5">
            <SpeakerAvatar label="A" active={isPlaying && activeSpeaker === "ALEX"} />
            <SpeakerAvatar label="S" active={isPlaying && activeSpeaker === "SARA"} />
          </div>
        )}

        {/* Seek back */}
        <button
          onClick={() => seekRelative(-15)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#9B8E84] transition-all duration-500 ease-out hover:text-[#1A1614]"
        >
          <SkipBack className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:scale-105"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Play className="ml-0.5 h-5 w-5" strokeWidth={1.5} />
          )}
        </button>

        {/* Seek forward */}
        <button
          onClick={() => seekRelative(15)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#9B8E84] transition-all duration-500 ease-out hover:text-[#1A1614]"
        >
          <SkipForward className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Waveform (only when playing with dual voice) */}
        {hasDualVoice && (
          <div className="hidden sm:block">
            <Waveform active={isPlaying} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-[#1A1614]">
            {episodeTitle || "Tu podcast del día"}
          </span>
          <span className="text-xs text-[#9B8E84]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <button
          onClick={cycleSpeed}
          className="cursor-pointer rounded-full bg-[#F5EDE4] px-3 py-1.5 text-xs font-medium text-[#6B5D54] transition-all duration-500 ease-out hover:bg-[#E07856]/10 hover:text-[#E07856]"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
