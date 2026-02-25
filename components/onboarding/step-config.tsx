"use client";

import { Loader2 } from "lucide-react";
import { DurationPicker } from "@/components/duration-picker";
import { TonePicker } from "@/components/tone-picker";
import { VoicePicker } from "@/components/voice-picker";

interface StepConfigProps {
  duration: number | null;
  setDuration: (v: number | null) => void;
  tone: string | null;
  setTone: (v: string | null) => void;
  voice: string | null;
  setVoice: (v: string | null) => void;
  nombre: string;
  setNombre: (v: string) => void;
  recommendedTone?: string | null;
  canFinish: boolean;
  saving?: boolean;
  onFinish: () => void;
  onBack: () => void;
}

export function StepConfig({
  duration,
  setDuration,
  tone,
  setTone,
  voice,
  setVoice,
  nombre,
  setNombre,
  recommendedTone,
  canFinish,
  saving,
  onFinish,
  onBack,
}: StepConfigProps) {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold font-sans text-forest">Configura tu podcast</h2>
        <p className="mt-2 text-muted">
          Elige la duración y el estilo que prefieras
        </p>
      </div>

      <DurationPicker selected={duration} onSelect={setDuration} />
      <TonePicker selected={tone} onSelect={setTone} recommended={recommendedTone ?? null} />
      <VoicePicker selected={voice} onSelect={setVoice} />

      {/* Nombre del usuario */}
      <div className="space-y-3">
        <div className="text-center">
          <h3 className="text-lg font-semibold">¿Cómo te llamas?</h3>
          <p className="mt-1 text-sm text-muted">Para personalizar tu podcast con un saludo cercano</p>
        </div>
        <div className="mx-auto max-w-sm">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre (opcional)"
            className="glass-input w-full text-center text-lg"
            maxLength={50}
          />
        </div>
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={onBack}
          className="rounded-full border border-white/[0.08] px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest cursor-pointer"
        >
          ← Atrás
        </button>
        <button
          onClick={onFinish}
          disabled={!canFinish || saving}
          className={`
            rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
            ${
              canFinish && !saving
                ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                : "bg-cream-dark text-muted-light cursor-not-allowed"
            }
          `}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </span>
          ) : (
            "Crear mi podcast"
          )}
        </button>
      </div>
    </div>
  );
}
