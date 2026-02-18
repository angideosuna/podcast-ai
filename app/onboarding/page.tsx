"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOPICS, MIN_TOPICS, MAX_TOPICS } from "@/lib/topics";
import { TopicCard } from "@/components/topic-card";
import { DurationPicker } from "@/components/duration-picker";
import { TonePicker } from "@/components/tone-picker";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [tone, setTone] = useState<string | null>(null);

  // Alternar selección de tema
  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      }
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, topicId];
    });
  };

  // Validaciones
  const canGoNext = selectedTopics.length >= MIN_TOPICS;
  const canFinish = duration !== null && tone !== null;

  // Guardar preferencias en localStorage + Supabase y redirigir
  const handleFinish = async () => {
    const preferences = {
      topics: selectedTopics,
      duration,
      tone,
      createdAt: new Date().toISOString(),
    };

    // Guardar siempre en localStorage (caché local)
    localStorage.setItem("podcast-ai-preferences", JSON.stringify(preferences));

    // Intentar guardar en Supabase (no bloquea si falla)
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: selectedTopics, duration, tone }),
      });
    } catch {
      // Silencioso: localStorage sirve como fallback
    }

    router.push("/onboarding/confirmacion");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Barra de progreso */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">
              <span className="text-blue-400">PodCast</span>
              <span className="text-violet-400">.ai</span>
            </h1>
            <span className="text-sm text-slate-400">Paso {step} de 2</span>
          </div>
          {/* Barra visual */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* ========== PASO 1: Elegir temas ========== */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Elige tus temas de interés</h2>
              <p className="mt-2 text-slate-400">
                Selecciona entre {MIN_TOPICS} y {MAX_TOPICS} temas para personalizar tu podcast diario
              </p>
            </div>

            {/* Contador de selección */}
            <div className="flex justify-center">
              <span
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  selectedTopics.length >= MIN_TOPICS
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {selectedTopics.length} de {MAX_TOPICS} seleccionados
                {selectedTopics.length < MIN_TOPICS && ` (mínimo ${MIN_TOPICS})`}
              </span>
            </div>

            {/* Grid de temas */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOPICS.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  selected={selectedTopics.includes(topic.id)}
                  disabled={selectedTopics.length >= MAX_TOPICS}
                  onClick={() => toggleTopic(topic.id)}
                />
              ))}
            </div>

            {/* Botón siguiente */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!canGoNext}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-200
                  ${
                    canGoNext
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:from-blue-600 hover:to-violet-600 shadow-lg shadow-blue-500/25 cursor-pointer"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }
                `}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 2: Duración y tono ========== */}
        {step === 2 && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Configura tu podcast</h2>
              <p className="mt-2 text-slate-400">
                Elige la duración y el estilo que prefieras
              </p>
            </div>

            <DurationPicker selected={duration} onSelect={setDuration} />
            <TonePicker selected={tone} onSelect={setTone} />

            {/* Botones de navegación */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-700 px-6 py-3 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
              >
                ← Atrás
              </button>
              <button
                onClick={handleFinish}
                disabled={!canFinish}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-200
                  ${
                    canFinish
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:from-blue-600 hover:to-violet-600 shadow-lg shadow-blue-500/25 cursor-pointer"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }
                `}
              >
                Generar mi primer podcast 🎙️
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
