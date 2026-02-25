"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSubtopicsByCategory } from "@/lib/topics";
import { StepTopics } from "@/components/onboarding/step-topics";
import { StepConfig } from "@/components/onboarding/step-config";

const TOTAL_STEPS = 2;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;

  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);

  // Step 1 — Temas (categorías con subtemas)
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [suggestingTopics, setSuggestingTopics] = useState(false);
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);

  // Step 2 — Configuración + nombre
  const [duration, setDuration] = useState<number | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");

  // Cargar preferencias existentes (por si vuelve al onboarding)
  useEffect(() => {
    async function loadExisting() {
      try {
        const [prefsRes, profileRes] = await Promise.all([
          fetch("/api/preferences"),
          fetch("/api/profile"),
        ]);

        if (prefsRes.ok) {
          const data = await prefsRes.json();
          if (data.preferences) {
            const p = data.preferences;
            if (p.topics?.length) setSelectedSubtopics(p.topics.filter((t: string) => !t.startsWith("custom:")));
            if (p.topics?.length) setCustomTopics(p.topics.filter((t: string) => t.startsWith("custom:")).map((t: string) => t.replace("custom:", "")));
            if (p.duration) setDuration(p.duration);
            if (p.tone) setTone(p.tone);
            if (p.voice) setVoice(p.voice);
          }
        }

        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile?.nombre) setNombre(data.profile.nombre);
        }
      } catch {
        // Silencioso
      }
    }
    loadExisting();
  }, []);

  // --- Handlers Step 1 (Temas) ---

  const handleSuggestTopics = async () => {
    setSuggestingTopics(true);
    try {
      const res = await fetch("/api/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        const categories: string[] = data.categories || [];

        if (categories.length > 0) {
          setSuggestedCategories(categories);

          const newSubtopics: string[] = [];
          for (const catId of categories) {
            const catSubs = getSubtopicsByCategory(catId);
            for (const subId of catSubs) {
              if (!selectedSubtopics.includes(subId) && !newSubtopics.includes(subId)) {
                newSubtopics.push(subId);
              }
            }
          }
          setSelectedSubtopics((prev) => [...prev, ...newSubtopics]);

          setExpandedCategories((prev) => [
            ...prev,
            ...categories.filter((id) => !prev.includes(id)),
          ]);

          setSuggestionsApplied(true);
        }
      }
    } catch {
      // Silencioso
    } finally {
      setSuggestingTopics(false);
    }
  };

  const toggleSubtopic = (subtopicId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopicId)
        ? prev.filter((id) => id !== subtopicId)
        : [...prev, subtopicId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    const catSubtopicIds = getSubtopicsByCategory(categoryId);
    const allSelected = catSubtopicIds.every((id) => selectedSubtopics.includes(id));

    if (allSelected) {
      setSelectedSubtopics((prev) => prev.filter((id) => !catSubtopicIds.includes(id)));
    } else {
      setSelectedSubtopics((prev) => [
        ...prev,
        ...catSubtopicIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addCustomTopic = (label: string) => {
    setCustomTopics((prev) => [...prev, label]);
  };

  const removeCustomTopic = (label: string) => {
    setCustomTopics((prev) => prev.filter((t) => t !== label));
  };

  const totalSelected = selectedSubtopics.length + customTopics.length;
  const canGoToStep2 = totalSelected >= 1;

  const goToStep2 = () => {
    setStep(2);
  };

  // --- Handlers Step 2 (Config + nombre) ---

  const canFinish = duration !== null && tone !== null && voice !== null;

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);

    const allTopics = [
      ...selectedSubtopics,
      ...customTopics.map((t) => `custom:${t}`),
    ];

    const preferences = {
      topics: allTopics,
      duration,
      tone,
      voice,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("podcast-ai-preferences", JSON.stringify(preferences));

    try {
      // Guardar preferencias + nombre en paralelo
      const requests: Promise<Response>[] = [
        fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: allTopics, duration, tone, voice }),
        }),
      ];

      // Guardar nombre si el usuario lo proporcionó
      if (nombre.trim()) {
        requests.push(
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre.trim() }),
          })
        );
      }

      await Promise.all(requests);
    } catch {
      // Silencioso: localStorage sirve como fallback
    }

    // Set onboarding complete cookie (1 year)
    document.cookie = "wavecast_onboarding_complete=true; path=/; max-age=31536000; SameSite=Lax";

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-cream text-dark">
      {/* Barra de progreso */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">
              WaveCast
            </h1>
            <span className="text-sm text-muted">Paso {step} de {TOTAL_STEPS}</span>
          </div>
          {/* Barra visual */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-full rounded-full bg-forest transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        {step === 1 && (
          <StepTopics
            selectedSubtopics={selectedSubtopics}
            customTopics={customTopics}
            expandedCategories={expandedCategories}
            suggestedCategories={suggestedCategories}
            suggestingTopics={suggestingTopics}
            suggestionsApplied={suggestionsApplied}
            totalSelected={totalSelected}
            onToggleExpanded={toggleExpanded}
            onToggleCategory={toggleCategory}
            onToggleSubtopic={toggleSubtopic}
            onAddCustomTopic={addCustomTopic}
            onRemoveCustomTopic={removeCustomTopic}
            onSuggestTopics={handleSuggestTopics}
            canGoNext={canGoToStep2}
            onNext={goToStep2}
          />
        )}

        {step === 2 && (
          <StepConfig
            duration={duration}
            setDuration={setDuration}
            tone={tone}
            setTone={setTone}
            voice={voice}
            setVoice={setVoice}
            nombre={nombre}
            setNombre={setNombre}
            canFinish={canFinish}
            saving={saving}
            onFinish={handleFinish}
            onBack={() => setStep(1)}
          />
        )}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="text-muted">Cargando...</div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
