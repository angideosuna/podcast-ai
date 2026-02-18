"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TOPICS } from "@/lib/topics";

interface Preferences {
  topics: string[];
  duration: number;
  tone: string;
  createdAt: string;
}

const TONE_LABELS: Record<string, string> = {
  casual: "Casual",
  profesional: "Profesional",
  "deep-dive": "Deep-dive",
};

export default function ConfirmacionPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("podcast-ai-preferences");
    if (!saved) {
      router.push("/onboarding");
      return;
    }
    setPreferences(JSON.parse(saved));
  }, [router]);

  if (!preferences) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }

  // Obtener los nombres de los temas seleccionados
  const selectedTopicNames = preferences.topics.map((id) => {
    const topic = TOPICS.find((t) => t.id === id);
    return topic ? `${topic.emoji} ${topic.nombre}` : id;
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Icono de éxito */}
        <div className="text-6xl">🎉</div>

        <div>
          <h1 className="text-3xl font-bold">¡Todo listo!</h1>
          <p className="mt-2 text-slate-400">
            Tu podcast personalizado está siendo preparado
          </p>
        </div>

        {/* Resumen de preferencias */}
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-left">
          <h2 className="text-lg font-semibold text-slate-200">Tu configuración</h2>

          <div>
            <p className="text-sm font-medium text-slate-400">Temas</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {selectedTopicNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-blue-500/15 px-3 py-1 text-sm text-blue-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-sm font-medium text-slate-400">Duración</p>
              <p className="mt-1 text-lg text-white">{preferences.duration} minutos</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Tono</p>
              <p className="mt-1 text-lg text-white">
                {TONE_LABELS[preferences.tone] || preferences.tone}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/podcast")}
            className="rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            🎙️ Generar mi primer podcast
          </button>
          <button
            onClick={() => router.push("/onboarding")}
            className="rounded-full border border-slate-700 px-6 py-3 font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
          >
            Modificar preferencias
          </button>
        </div>

        <p className="text-xs text-slate-600">
          Tus preferencias se han guardado localmente. En futuras versiones se sincronizarán con tu cuenta.
        </p>
      </div>
    </div>
  );
}
