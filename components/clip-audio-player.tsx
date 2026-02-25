"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { cleanScriptForTTS } from "@/lib/tts-utils";

interface ClipAudioPlayerProps {
  script: string;
}

function findSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const spanishEsVoices = voices.filter((v) => v.lang === "es-ES");

  if (spanishEsVoices.length === 0) {
    const anySpanish = voices.filter((v) => v.lang.startsWith("es"));
    return anySpanish[0] || null;
  }

  // Voz femenina por defecto para clips
  const female = spanishEsVoices.find(
    (v) =>
      v.name.toLowerCase().includes("helena") ||
      v.name.toLowerCase().includes("elvira") ||
      v.name.toLowerCase().includes("female")
  );
  return female || spanishEsVoices[0];
}

export function ClipAudioPlayer({ script }: ClipAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    function loadVoices() {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        const selected = findSpanishVoice();
        setVoiceName(selected?.name || "Voz del sistema");
      }
    }

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const handlePlay = useCallback(() => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    speechSynthesis.cancel();

    const cleanedText = cleanScriptForTTS(script);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utteranceRef.current = utterance;

    const selectedVoice = findSpanishVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }, [script, isPaused]);

  const handlePause = useCallback(() => {
    speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const handleStop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, []);

  if (!voicesLoaded) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3">
      {isPlaying ? (
        <button
          onClick={handlePause}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
        >
          <Pause className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={handlePlay}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
        >
          <Play className="ml-0.5 h-4 w-4" />
        </button>
      )}

      {(isPlaying || isPaused) && (
        <button
          onClick={handleStop}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-cream-dark/50 text-dark/70 transition-all duration-300 hover:bg-forest/10 hover:text-forest"
        >
          <Square className="h-3 w-3" />
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-dark">
          {isPlaying
            ? "Reproduciendo clip..."
            : isPaused
              ? "En pausa"
              : "Pulsa play para escuchar"}
        </span>
        <span className="text-xs text-muted">
          <Volume2 className="mr-1 inline h-3 w-3" />
          {voiceName} (es-ES)
        </span>
      </div>
    </div>
  );
}
