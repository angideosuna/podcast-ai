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
    <div className="overflow-hidden rounded-2xl glass-card">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✏️</span>
          <span className="text-lg font-semibold text-dark">Otros</span>
        </div>

        <p className="mt-1 text-sm text-muted">
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
            className="glass-input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`
              flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition-all duration-300 cursor-pointer
              ${
                input.trim()
                  ? "bg-forest text-white hover:bg-forest-light shadow-md shadow-forest/10"
                  : "bg-cream-dark text-muted-light cursor-not-allowed"
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
                className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-sm font-medium text-white shadow-md shadow-forest/10"
              >
                {label}
                <button
                  type="button"
                  onClick={() => onRemove(label)}
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-300 cursor-pointer"
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
