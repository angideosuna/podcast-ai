"use client";

import { useState } from "react";
import { Mic, Play, Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { BrowserAudioPlayer } from "@/components/browser-audio-player";

export interface DeepCast {
  id: string;
  query: string;
  script: string | null;
  audio_url: string | null;
  cover_color: string | null;
  cover_image_url: string | null;
  source_titles: string[];
  duration: number;
  status: string;
  created_at: string;
}

interface DeepCastCardProps {
  deepcast: DeepCast;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

/** Renders script lines with ALEX:/SARA: color coding */
function ScriptRenderer({ script }: { script: string }) {
  // Strip [DEEPCAST: ...] prefix if present
  const cleaned = script.replace(/^\[DEEPCAST[^\]]*\]\s*/i, "");
  const lines = cleaned.split("\n");

  return (
    <div className="space-y-1 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Markdown headers
        if (trimmed.startsWith("#")) {
          return (
            <p key={i} className="mt-3 mb-1 font-medium text-[#1A1614]">
              {trimmed.replace(/^#{1,3}\s*/, "")}
            </p>
          );
        }
        // Separator
        if (trimmed === "---") return <hr key={i} className="my-2 border-[#E8DFD3]/40" />;

        // ALEX: lines
        if (trimmed.startsWith("ALEX:")) {
          return (
            <p key={i}>
              <span className="font-medium text-[#E07856]">ALEX: </span>
              <span className="text-[#6B5D54]">{trimmed.slice(5).trim()}</span>
            </p>
          );
        }
        // SARA: lines
        if (trimmed.startsWith("SARA:")) {
          return (
            <p key={i}>
              <span className="font-medium text-[#9B7B8E]">SARA: </span>
              <span className="text-[#6B5D54]">{trimmed.slice(5).trim()}</span>
            </p>
          );
        }
        // Regular text
        return <p key={i} className="text-[#6B5D54]">{trimmed}</p>;
      })}
    </div>
  );
}

export function DeepCastCard({ deepcast, compact }: DeepCastCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [coverError, setCoverError] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/40 backdrop-blur-xl transition-all duration-500 ease-out">
      {/* Header with cover */}
      <div className="flex gap-3 p-4">
        {/* Cover square */}
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: deepcast.cover_color || "linear-gradient(135deg, #E07856 0%, #1A1614 100%)" }}
        >
          <Mic className="h-6 w-6 text-white/80" strokeWidth={1.5} />
          {deepcast.cover_image_url && !coverError && (
            <img
              src={deepcast.cover_image_url}
              alt=""
              loading="lazy"
              onError={() => setCoverError(true)}
              className="absolute inset-0 z-[5] h-full w-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Badge + title */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-[#E07856]/10 px-2 py-0.5 text-[10px] font-medium text-[#E07856]">
              DeepCast
            </span>
          </div>
          <h3 className="mt-1 truncate text-[14px] font-medium leading-tight text-[#1A1614]">
            {deepcast.query}
          </h3>

          {/* Meta */}
          <div className="mt-1 flex items-center gap-3 text-[11px] text-[#9B8E84]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {deepcast.duration} min
            </span>
            <span>{timeAgo(deepcast.created_at)}</span>
            {deepcast.source_titles.length > 0 && (
              <span>{deepcast.source_titles.length} fuentes</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!compact && deepcast.script && (
        <div className="flex gap-2 border-t border-[#E8DFD3]/40 px-4 py-2.5">
          <button
            onClick={() => { setShowPlayer(!showPlayer); if (showScript) setShowScript(false); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#E07856] px-3.5 py-1.5 text-[12px] font-medium text-white transition-all duration-500 ease-out hover:bg-[#C96A4A]"
          >
            <Play className="h-3.5 w-3.5 fill-white" strokeWidth={1.5} />
            {showPlayer ? "Ocultar" : "Escuchar"}
          </button>

          <button
            onClick={() => { setShowScript(!showScript); if (showPlayer) setShowPlayer(false); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#F5EDE4] px-3.5 py-1.5 text-[12px] font-medium text-[#6B5D54] transition-all duration-500 ease-out hover:bg-[#E8DFD3] hover:text-[#1A1614]"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            Ver guion
            {showScript ? <ChevronUp className="h-3 w-3" strokeWidth={1.5} /> : <ChevronDown className="h-3 w-3" strokeWidth={1.5} />}
          </button>
        </div>
      )}

      {/* Player inline */}
      {showPlayer && deepcast.script && (
        <div className="border-t border-[#E8DFD3]/40">
          <BrowserAudioPlayer
            script={deepcast.script}
            voice="male"
            episodeTitle={deepcast.query}
          />
        </div>
      )}

      {/* Script expanded */}
      {showScript && deepcast.script && (
        <div className="max-h-96 overflow-y-auto border-t border-[#E8DFD3]/40 px-4 py-4">
          <ScriptRenderer script={deepcast.script} />
        </div>
      )}
    </div>
  );
}
