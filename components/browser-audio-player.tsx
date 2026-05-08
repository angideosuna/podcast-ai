"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { cleanScriptForTTS, parseDialogueSegments, type DialogueSegment } from "@/lib/tts-utils";
import { useVoiceInteraction } from "@/hooks/use-voice-interaction";
import { VoiceMicButton } from "@/components/voice-mic-button";

interface BrowserAudioPlayerProps {
  script: string;
  voice: string;
  episodeId?: string;
  deepcastId?: string;
  episodeTitle?: string;
  topics?: string[];
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

/** Find distinct Spanish voices for male and female */
function findDualVoices(): { alex: SpeechSynthesisVoice | null; sara: SpeechSynthesisVoice | null } {
  const voices = speechSynthesis.getVoices();
  const spanishVoices = voices.filter((v) => v.lang === "es-ES" || v.lang.startsWith("es"));

  const maleVoice = spanishVoices.find(
    (v) =>
      v.name.toLowerCase().includes("pablo") ||
      v.name.toLowerCase().includes("alvaro") ||
      v.name.toLowerCase().includes("male")
  );

  const femaleVoice = spanishVoices.find(
    (v) =>
      v.name.toLowerCase().includes("helena") ||
      v.name.toLowerCase().includes("elvira") ||
      v.name.toLowerCase().includes("female")
  );

  // If we can't find distinct voices, use different ones from the available set
  if (maleVoice && femaleVoice) {
    return { alex: maleVoice, sara: femaleVoice };
  }

  // Fallback: use first two different voices, or same voice with pitch variation
  const first = spanishVoices[0] || null;
  const second = spanishVoices[1] || first;
  return { alex: first, sara: second };
}

/** Speaker avatar circle */
function SpeakerAvatar({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium transition-all duration-500 ease-out ${
        active
          ? "bg-[#E07856] text-white ring-2 ring-[#E07856] ring-offset-2 ring-offset-white/60 scale-110"
          : "bg-[#F5EDE4] text-[#9B8E84]"
      }`}
    >
      {label}
    </div>
  );
}

export function BrowserAudioPlayer({ script, voice, episodeId, deepcastId, episodeTitle, topics }: BrowserAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<"ALEX" | "SARA" | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listenStartRef = useRef<number>(0);
  const totalListenRef = useRef<number>(0);
  const segmentsRef = useRef<DialogueSegment[]>([]);
  const playingRef = useRef(false);
  const stoppedRef = useRef(false);

  // Parse dialogue segments
  const segments = parseDialogueSegments(script);
  const hasDualVoice = segments.length >= 2 && new Set(segments.map((s) => s.speaker)).size >= 2;
  segmentsRef.current = segments;

  // Voice interaction
  const hasVoiceTarget = !!(episodeId || deepcastId);
  const { state: voiceState, isSupported: voiceSupported, startListening, stopListening } = useVoiceInteraction({
    episodeId,
    deepcastId,
    episodeContext: {
      title: episodeTitle || "",
      topics: topics ?? [],
      script,
    },
    onAnswerStart: () => {
      if (isPlaying) {
        speechSynthesis.pause();
        setIsPlaying(false);
        setIsPaused(true);
      }
    },
    onAnswerEnd: () => {
      if (isPaused) {
        speechSynthesis.resume();
        setIsPlaying(true);
        setIsPaused(false);
      }
    },
  });

  useEffect(() => {
    function loadVoices() {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        if (hasDualVoice) {
          setVoiceName("Alex & Sara");
        } else {
          const selected = findSpanishVoice(voice);
          setVoiceName(selected?.name || "Voz del sistema");
        }
      }
    }

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [voice, hasDualVoice]);

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

  /** Play dialogue segments one by one recursively */
  const playSegment = useCallback((index: number) => {
    const segs = segmentsRef.current;
    if (index >= segs.length || stoppedRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveSpeaker(null);
      setCurrentSegmentIndex(-1);
      playingRef.current = false;
      if (!stoppedRef.current) sendMetrics(1.0);
      return;
    }

    const seg = segs[index];
    const cleanedText = cleanScriptForTTS(seg.text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utteranceRef.current = utterance;

    // Set voice and pitch per speaker
    const { alex, sara } = findDualVoices();
    if (seg.speaker === "ALEX") {
      if (alex) utterance.voice = alex;
      utterance.pitch = 0.9;
    } else {
      if (sara) utterance.voice = sara;
      utterance.pitch = 1.15;
    }

    utterance.lang = "es-ES";
    utterance.rate = 1;

    setActiveSpeaker(seg.speaker);
    setCurrentSegmentIndex(index);

    utterance.onend = () => {
      if (!stoppedRef.current) {
        playSegment(index + 1);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveSpeaker(null);
      playingRef.current = false;
    };

    speechSynthesis.speak(utterance);
  }, [sendMetrics]);

  const handlePlay = useCallback(() => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      listenStartRef.current = Date.now();
      return;
    }

    speechSynthesis.cancel();
    stoppedRef.current = false;

    if (hasDualVoice) {
      // Play segment by segment for dual voice
      playingRef.current = true;
      setIsPlaying(true);
      setIsPaused(false);
      listenStartRef.current = Date.now();
      playSegment(0);
      return;
    }

    // Single voice fallback
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
      setActiveSpeaker(null);
      sendMetrics(1.0);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveSpeaker(null);
    };

    speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
    listenStartRef.current = Date.now();
  }, [script, voice, isPaused, sendMetrics, hasDualVoice, playSegment]);

  const handlePause = useCallback(() => {
    speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
    sendMetrics(0.5);
  }, [sendMetrics]);

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveSpeaker(null);
    setCurrentSegmentIndex(-1);
    playingRef.current = false;
    sendMetrics(0);
  }, [sendMetrics]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      speechSynthesis.cancel();
    };
  }, []);

  if (!voicesLoaded) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/30 bg-white/60 backdrop-blur-xl shadow-[0_-2px_16px_rgba(180,140,100,0.08)] md:left-[72px] lg:left-[240px]">
      {/* Segment text display for dual voice */}
      {hasDualVoice && activeSpeaker && currentSegmentIndex >= 0 && isPlaying && (
        <div className="border-b border-[#E8DFD3]/40 px-4 py-1.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-medium text-[#E07856]">{activeSpeaker}</span>
            <p className="truncate text-[12px] text-[#6B5D54]">
              {segments[currentSegmentIndex]?.text.slice(0, 100)}
              {(segments[currentSegmentIndex]?.text.length ?? 0) > 100 ? "..." : ""}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Speaker avatars for dual voice */}
        {hasDualVoice && (
          <div className="flex items-center gap-1">
            <SpeakerAvatar label="A" active={isPlaying && activeSpeaker === "ALEX"} />
            <SpeakerAvatar label="S" active={isPlaying && activeSpeaker === "SARA"} />
          </div>
        )}

        {isPlaying ? (
          <button
            onClick={handlePause}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:scale-105"
          >
            <Pause className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:scale-105"
          >
            <Play className="ml-0.5 h-5 w-5" strokeWidth={1.5} />
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/40 border border-white/30 text-[#6B5D54] transition-all duration-500 ease-out hover:bg-[#E07856]/10 hover:text-[#E07856]"
          >
            <Square className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-[#1A1614]">
            {voiceState.isProcessing
              ? "Alex y Sara piensan..."
              : voiceState.isAnswering
                ? "Respondiendo..."
                : isPlaying
                  ? episodeTitle || "Reproduciendo..."
                  : isPaused
                    ? "En pausa"
                    : episodeTitle || "Pulsa play para escuchar"}
          </span>
          <span className="text-xs text-[#9B8E84]">
            <Volume2 className="mr-1 inline h-3 w-3" strokeWidth={1.5} />
            {voiceName} (es-ES)
          </span>
        </div>

        {/* Compact mic button */}
        {hasVoiceTarget && voiceSupported && (
          <button
            onClick={voiceState.isListening ? stopListening : startListening}
            disabled={voiceState.isProcessing || voiceState.isAnswering}
            className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-500 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
              voiceState.isListening
                ? "border border-red-500 bg-red-500/20"
                : voiceState.isProcessing || voiceState.isAnswering
                  ? "border border-[#E07856]/30 bg-[#E07856]/10"
                  : "bg-white/40 border border-white/30 hover:bg-[#F5EDE4]"
            }`}
          >
            {voiceState.isListening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
            )}
            <svg className={`relative z-10 h-4 w-4 ${voiceState.isListening ? "text-red-400" : voiceState.isProcessing || voiceState.isAnswering ? "text-[#E07856]" : "text-[#6B5D54]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
