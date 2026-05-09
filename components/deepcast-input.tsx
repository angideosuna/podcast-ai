"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, X, Loader2, ArrowRight } from "lucide-react";

interface DeepCastInputProps {
  onGenerate: (query: string, duration: number) => void;
  isGenerating: boolean;
}

const PLACEHOLDER_SUGGESTIONS = [
  "¿Cómo afectará la IA al mercado laboral en España?",
  "Explícame la crisis energética en Europa",
  "¿Qué está pasando con las criptomonedas?",
  "El futuro de la educación con inteligencia artificial",
  "¿Por qué sube tanto el precio de la vivienda?",
  "Cambio climático: ¿estamos a tiempo?",
  "La revolución de los coches eléctricos",
  "¿Qué significa la nueva ley de datos europea?",
];

const DROPDOWN_SUGGESTIONS = [
  "¿Qué está pasando con la IA generativa?",
  "La situación económica en España hoy",
  "Últimas novedades en tecnología",
  "Geopolítica: conflictos actuales",
  "Salud mental en la era digital",
];

const DURATION_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
];

export function DeepCastInput({ onGenerate, isGenerating }: DeepCastInputProps) {
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState(10);
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rotate placeholder every 4s when not focused and empty
  useEffect(() => {
    if (isFocused || query) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isFocused, query]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    if (!query) setShowSuggestions(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || isGenerating) return;
    setShowSuggestions(false);
    onGenerate(trimmed, duration);
  }, [query, duration, isGenerating, onGenerate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const hasText = query.trim().length > 0;

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Input */}
      <div
        className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ease-out ${
          isFocused
            ? "border-[#E07856]/50 bg-white/60 backdrop-blur-xl ring-2 ring-[#E07856]/20"
            : "border-white/30 bg-white/40 backdrop-blur-xl"
        }`}
      >
        <Mic className={`h-5 w-5 shrink-0 transition-colors duration-500 ease-out ${isFocused ? "text-[#E07856]" : "text-[#9B8E84]"}`} strokeWidth={1.5} />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setShowSuggestions(false);
            else setShowSuggestions(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
          className="flex-1 bg-transparent text-[15px] text-[#1A1614] placeholder:text-[#9B8E84] outline-none disabled:opacity-50"
        />

        {hasText && !isGenerating && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="shrink-0 cursor-pointer rounded-full p-1 text-[#9B8E84] transition-all duration-500 ease-out hover:text-[#1A1614]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!hasText || isGenerating}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-500 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
            hasText && !isGenerating
              ? "bg-[#E07856] text-white hover:bg-[#C96A4A]"
              : "bg-[#E8DFD3] text-[#9B8E84]"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              Generar
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </>
          )}
        </button>

        {/* Suggestions dropdown */}
        {showSuggestions && !isGenerating && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-white/30 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(180,140,100,0.12)]">
            {DROPDOWN_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => selectSuggestion(suggestion)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-[14px] text-[#6B5D54] transition-all duration-500 ease-out hover:bg-[#F5EDE4]/60 hover:text-[#1A1614]"
              >
                <Mic className="h-4 w-4 shrink-0 text-[#9B8E84]" strokeWidth={1.5} />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration pills */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[#9B8E84]">Duración:</span>
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDuration(opt.value)}
            disabled={isGenerating}
            className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-500 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
              duration === opt.value
                ? "bg-[#E07856] text-white"
                : "bg-[#F5EDE4] text-[#6B5D54] hover:bg-[#E8DFD3] hover:text-[#1A1614]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
