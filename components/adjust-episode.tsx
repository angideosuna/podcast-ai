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
        <button className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 px-6 py-3 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
          <Sliders className="h-4 w-4" />
          Ajustar episodio
        </button>
      </DialogTrigger>
      <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar el episodio de hoy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Sugerencias rapidas */}
          <div>
            <p className="mb-2 text-sm text-slate-400">Sugerencias rapidas</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  className="cursor-pointer rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Input libre */}
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">
              O escribe tus ajustes
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: Quiero mas contenido sobre startups y menos sobre politica. Tono mas informal."
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Boton de accion */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
