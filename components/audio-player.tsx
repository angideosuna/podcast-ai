"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Loader2,
  Volume2,
  RotateCcw,
  AlertCircle,
} from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  episodeId?: string;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  audioUrl,
  isLoading,
  error,
  onRetry,
  episodeId,
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
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-forest" />
          <span className="text-sm text-muted">
            Generando audio del podcast...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-muted">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex cursor-pointer items-center gap-1 rounded-full bg-cream-dark/50 px-3 py-1.5 text-xs text-dark/70 transition-all duration-300 hover:bg-forest/10 hover:text-forest"
            >
              <RotateCcw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!audioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black">
      {/* Barra de progreso */}
      <div
        ref={progressRef}
        className="group relative h-1 w-full cursor-pointer transition-all duration-300 hover:h-2"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 bg-cream-dark" />
        <div
          className="absolute inset-y-0 left-0 bg-forest"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-forest opacity-0 shadow-md transition-opacity duration-300 group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Controles */}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-dark">
            Tu podcast del día
          </span>
          <span className="text-xs text-muted">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <Volume2 className="hidden h-4 w-4 text-muted-light sm:block" />

        <button
          onClick={cycleSpeed}
          className="cursor-pointer rounded-full bg-cream-dark/50 px-3 py-1.5 text-xs font-medium text-dark/70 transition-all duration-300 hover:bg-forest/10 hover:text-forest"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
