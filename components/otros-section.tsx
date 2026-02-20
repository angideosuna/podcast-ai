"use client";

import { useState } from "react";

interface OtrosSectionProps {
  customTopics: string[];
  onAdd: (label: string) => void;
  onRemove: (label: string) => void;
}

export function OtrosSection({ customTopics, onAdd, onRemove }: OtrosSectionProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) return;
    if (customTopics.includes(trimmed)) return;
    onAdd(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✏️</span>
          <span className="text-lg font-semibold text-stone-900">Otros</span>
        </div>

        <p className="mt-1 text-sm text-stone-500">
          Agrega temas que no aparezcan en las categorías
        </p>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: Blockchain, Yoga..."
            maxLength={50}
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`
              flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition-colors cursor-pointer
              ${
                input.trim()
                  ? "bg-stone-900 text-white hover:opacity-90"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }
            `}
            aria-label="Agregar tema"
          >
            +
          </button>
        </div>

        {/* Chips */}
        {customTopics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {customTopics.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-white"
              >
                {label}
                <button
                  type="button"
                  onClick={() => onRemove(label)}
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                  aria-label={`Eliminar ${label}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
