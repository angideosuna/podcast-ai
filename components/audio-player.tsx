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
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Crear/actualizar el elemento de audio cuando cambia la URL
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

  // Sincronizar velocidad de reproducción
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
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

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeed(SPEED_OPTIONS[nextIndex]);
  };

  // Seek al hacer click en la barra de progreso
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Soporte para drag en la barra de progreso
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

  // Estado de carga
  if (isLoading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="text-sm text-slate-400">
            Generando audio del podcast...
          </span>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-4">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm text-slate-400">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex cursor-pointer items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sin audio disponible
  if (!audioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
      {/* Barra de progreso clickable (arriba del player) */}
      <div
        ref={progressRef}
        className="group relative h-1 w-full cursor-pointer transition-all hover:h-2"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 bg-slate-800" />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-violet-500"
          style={{ width: `${progress}%` }}
        />
        {/* Indicador circular al hacer hover */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Controles */}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-slate-900 transition-transform hover:scale-105"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </button>

        {/* Info del episodio */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-white">
            Tu podcast del dia
          </span>
          <span className="text-xs text-slate-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Volumen (icono decorativo) */}
        <Volume2 className="hidden h-4 w-4 text-slate-500 sm:block" />

        {/* Control de velocidad */}
        <button
          onClick={cycleSpeed}
          className="cursor-pointer rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
