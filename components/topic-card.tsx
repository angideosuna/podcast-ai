"use client";

import { type Topic } from "@/lib/topics";

interface TopicCardProps {
  topic: Topic;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function TopicCard({ topic, selected, disabled, onClick }: TopicCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={`
        relative flex flex-col items-center gap-3 rounded-xl border-2 p-6
        transition-all duration-200 cursor-pointer text-center
        ${
          selected
            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
            : "border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800"
        }
        ${disabled && !selected ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {/* Indicador de selección */}
      {selected && (
        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs">
          ✓
        </div>
      )}

      {/* Emoji */}
      <span className="text-4xl">{topic.emoji}</span>

      {/* Nombre */}
      <h3 className="text-lg font-semibold text-white">{topic.nombre}</h3>

      {/* Descripción */}
      <p className="text-sm text-slate-400 leading-relaxed">{topic.descripcion}</p>
    </button>
  );
}
