"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { cleanScriptForTTS } from "@/lib/tts-utils";

interface BrowserAudioPlayerProps {
  script: string;
  voice: string;
  episodeId?: string;
}

function findSpanishVoice(gender: string): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const spanishEsVoices = voices.filter((v) => v.lang === "es-ES");

  if (spanishEsVoices.length === 0) {
    const anySpanish = voices.filter((v) => v.lang.startsWith("es"));
    return anySpanish[0] || null;
  }

  if (gender === "male") {
    const male = spanishEsVoices.find(
      (v) =>
        v.name.toLowerCase().includes("pablo") ||
        v.name.toLowerCase().includes("alvaro") ||
        v.name.toLowerCase().includes("male")
    );
    return male || spanishEsVoices[0];
  }

  const female = spanishEsVoices.find(
    (v) =>
      v.name.toLowerCase().includes("helena") ||
      v.name.toLowerCase().includes("elvira") ||
      v.name.toLowerCase().includes("female")
  );
  return female || spanishEsVoices[0];
}

export function BrowserAudioPlayer({ script, voice, episodeId }: BrowserAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listenStartRef = useRef<number>(0);
  const totalListenRef = useRef<number>(0);

  useEffect(() => {
    function loadVoices() {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        const selected = findSpanishVoice(voice);
        setVoiceName(selected?.name || "Voz del sistema");
      }
    }

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [voice]);

  const sendMetrics = useCallback((completionRate: number) => {
    if (!episodeId) return;
    const elapsed = listenStartRef.current > 0 ? (Date.now() - listenStartRef.current) / 1000 : 0;
    totalListenRef.current += elapsed;
    listenStartRef.current = 0;
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episode_id: episodeId,
        total_listen_time_seconds: Math.round(totalListenRef.current),
        completion_rate: Math.round(completionRate * 100) / 100,
        playback_speed: 1.0,
      }),
    }).catch(() => {});
  }, [episodeId]);

  const handlePlay = useCallback(() => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      listenStartRef.current = Date.now();
      return;
    }

    speechSynthesis.cancel();

    const cleanedText = cleanScriptForTTS(script);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utteranceRef.current = utterance;

    const selectedVoice = findSpanishVoice(voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      sendMetrics(1.0);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
    listenStartRef.current = Date.now();
  }, [script, voice, isPaused, sendMetrics]);

  const handlePause = useCallback(() => {
    speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
    sendMetrics(0.5); // estimate ~50% when pausing
  }, [sendMetrics]);

  const handleStop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    sendMetrics(0);
  }, [sendMetrics]);

  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  if (!voicesLoaded) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        {isPlaying ? (
          <button
            onClick={handlePause}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
          >
            <Pause className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-forest text-white transition-transform duration-300 hover:scale-105"
          >
            <Play className="ml-0.5 h-5 w-5" />
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-cream-dark/50 text-dark/70 transition-all duration-300 hover:bg-forest/10 hover:text-forest"
          >
            <Square className="h-4 w-4" />
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-dark">
            {isPlaying
              ? "Reproduciendo..."
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
    </div>
  );
}
