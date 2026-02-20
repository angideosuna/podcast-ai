"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sliders, Loader2 } from "lucide-react";

interface AdjustEpisodeProps {
  onAdjust: (adjustments: string) => Promise<void>;
}

const QUICK_SUGGESTIONS = [
  "Mas sobre inteligencia artificial",
  "Mas sobre economia",
  "Mas corto y conciso",
  "Tono mas informal",
  "Mas datos y cifras",
  "Menos politica",
];

export function AdjustEpisode({ onAdjust }: AdjustEpisodeProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await onAdjust(input.trim());
      setOpen(false);
      setInput("");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput((prev) => (prev ? `${prev}. ${suggestion}` : suggestion));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex cursor-pointer items-center gap-2 rounded-full border border-white/40 bg-cream-light/80 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/20 hover:text-forest">
          <Sliders className="h-4 w-4" />
          Ajustar episodio
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/40 bg-cream-light text-dark sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar el episodio de hoy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Sugerencias rapidas */}
          <div>
            <p className="mb-2 text-sm text-muted">Sugerencias rapidas</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  className="cursor-pointer rounded-full bg-cream-dark/50 px-3 py-1.5 text-xs text-dark/70 transition-all duration-300 hover:bg-forest/10 hover:text-forest"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Input libre */}
          <div>
            <label className="mb-1.5 block text-sm text-muted">
              O escribe tus ajustes
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: Quiero mas contenido sobre startups y menos sobre politica. Tono mas informal."
              rows={3}
              className="glass-input w-full resize-none text-sm"
            />
          </div>

          {/* Boton de accion */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerando...
              </>
            ) : (
              "🔄 Regenerar con ajustes"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
