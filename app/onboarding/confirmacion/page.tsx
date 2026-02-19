"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TOPICS } from "@/lib/topics";
import type { Preferences, Profile } from "@/lib/types";
import {
  TONE_LABELS,
  VOICE_LABELS,
  NIVEL_CONOCIMIENTO_LABELS,
  OBJETIVO_PODCAST_LABELS,
} from "@/lib/types";

function loadPreferencesFromStorage(): Preferences | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("podcast-ai-preferences");
  if (!saved) return null;
  return JSON.parse(saved) as Preferences;
}

export default function ConfirmacionPage() {
  const router = useRouter();
  const [preferences] = useState<Preferences | null>(loadPreferencesFromStorage);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!preferences) {
      router.push("/onboarding");
      return;
    }

    // Cargar perfil del usuario
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      } catch {
        // Silencioso
      }
    }
    loadProfile();
  }, [preferences, router]);

  if (!preferences) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <div className="text-stone-500">Cargando...</div>
      </div>
    );
  }

  // Obtener los nombres de los temas seleccionados
  const selectedTopicNames = preferences.topics.map((id) => {
    const topic = TOPICS.find((t) => t.id === id);
    return topic ? `${topic.emoji} ${topic.nombre}` : id;
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 text-stone-900">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Icono de éxito */}
        <div className="text-6xl">🎉</div>

        <div>
          <h1 className="text-3xl font-bold">¡Todo listo!</h1>
          <p className="mt-2 text-stone-500">
            Tu podcast personalizado está siendo preparado
          </p>
        </div>

        {/* Resumen del perfil */}
        {profile && profile.survey_completed && (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 text-left">
            <h2 className="text-lg font-semibold text-stone-800">Tu perfil</h2>
            <div className="flex flex-wrap gap-2">
              {profile.nombre && (
                <span className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900">
                  👤 {profile.nombre}
                </span>
              )}
              {profile.nivel_conocimiento && (
                <span className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900">
                  📊 {NIVEL_CONOCIMIENTO_LABELS[profile.nivel_conocimiento] || profile.nivel_conocimiento}
                </span>
              )}
              {profile.objetivo_podcast && (
                <span className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900">
                  🎯 {OBJETIVO_PODCAST_LABELS[profile.objetivo_podcast] || profile.objetivo_podcast}
                </span>
              )}
              {profile.rol && (
                <span className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900">
                  💼 {profile.rol}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Resumen de preferencias */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 text-left">
          <h2 className="text-lg font-semibold text-stone-800">Tu configuración</h2>

          <div>
            <p className="text-sm font-medium text-stone-500">Temas</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {selectedTopicNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-sm font-medium text-stone-500">Duración</p>
              <p className="mt-1 text-lg text-stone-900">{preferences.duration} minutos</p>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500">Tono</p>
              <p className="mt-1 text-lg text-stone-900">
                {TONE_LABELS[preferences.tone] || preferences.tone}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500">Voz</p>
              <p className="mt-1 text-lg text-stone-900">
                {VOICE_LABELS[preferences.voice] || preferences.voice}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/podcast")}
            className="rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            🎙️ Generar mi primer podcast
          </button>
          <button
            onClick={() => router.push("/onboarding")}
            className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 cursor-pointer"
          >
            Modificar preferencias
          </button>
        </div>

        <p className="text-xs text-stone-400">
          Tus preferencias se han guardado localmente. En futuras versiones se sincronizarán con tu cuenta.
        </p>
      </div>
    </div>
  );
}
